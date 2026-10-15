// ---------------------------------------------------------------------------
// Profile bundles - the portable `.spellcaster` file.
//
// (PROFILE_SYNC_SPEC.md steps 3-6: §3 provenance, §5 format, §7 export,
// §8 import, §9.3 testability.)
//
// FOUR RULES this module exists to keep:
//
//   1. PROVENANCE IS STRUCTURAL, NOT A HEURISTIC (§3). A `files[]` entry with a
//      `storedName` is an upload; one without is a bundled asset that resolves
//      from /assets and is identical on every install. There is deliberately NO
//      write-time provenance flag - the data already says which is which, and a
//      second source of truth would only be something to keep in sync. Every
//      classification funnels through `classifySoundReferences` so the audio
//      path and the icon path cannot drift apart.
//
//   2. SOUND OBJECTS TRAVEL VERBATIM (§5.2). They are spread and their
//      *reference fields* rewritten - never rebuilt field by field - because
//      the new-sound save path is an explicit allowlist and anything missing
//      from it is dropped silently. That is how `volume` rides along today and
//      how a future sound field will ride along without a schema edit.
//
//   3. BYTES GO OUT AS A `Uint8Array` (§7, §11 risk 8). Desktop IPC sends the
//      `write_file` body through `fetch`, which coerces a plain `Array` to a
//      comma-joined string: the write RESOLVES, the file is ~3x too large and
//      unopenable, and nothing errors. `exportBundle` returns a Uint8Array and
//      `assertUint8Array` is called at the single call site.
//
//   4. THE KEY WRITE IS THE COMMIT POINT (§8 step 6). `fs:allow-remove-dir`
//      does not exist in plugin-fs 2.5.2, so a temp-directory swap - the
//      textbook atomic replace - is not available. What IS available is an
//      ordering: verify every checksum, write every blob, and only then touch
//      the namespaced keys. A failure anywhere before that leaves the previous
//      board byte-for-byte intact and the half-written blobs as orphans, which
//      is harmless. A failure after it cannot happen, because it is the last
//      thing the import does.
//
// NOT IN THE BUNDLE, ON PURPOSE (§5.2, §6): the custom background image (a
// per-device display preference that can be 5 MB of inline base64), and
// priming (one-shot and session-only by decision - a user who primes on one
// device and expects it on another has misunderstood, and the README says so).
// ---------------------------------------------------------------------------

import { Zip, ZipPassThrough, unzipSync } from 'fflate'
import { sha256 } from '@noble/hashes/sha2.js'

import {
    profileScopedKey,
    profileKeys,
    readProfileValue,
    writeProfileValue,
    removeProfileValue,
    profileUploadPath,
    createProfile,
    setActiveProfile,
    requestProfileRemount,
    getActiveProfileId,
} from './profileStorage.js'

export const BUNDLE_FORMAT_VERSION = 1
export const BUNDLE_EXTENSION = '.spellcaster'

/** Zip chunk size. Large enough to matter, small enough to yield. */
const CHUNK = 64 * 1024

// Where importBundle parks its summary for the UI to pick up after the remount
// (§9.2, step 7). Named once, and deliberately exported: the harness pins this
// exact string in KNOWN_KEYS (e2e/lib/page.mjs), and a typo would fail the
// key-inventory assertions for a reason nobody could read - which is exactly how
// spellcaster_import_backups was missed on 2026-10-14.
export const IMPORT_NOTICE_KEY = 'spellcaster_import_notice'

/** Content-addressed names use this many hex chars of the digest (64 bits). */
const HASH_PREFIX_LEN = 16

// --- errors -----------------------------------------------------------------

/**
 * A refusal the user should be told about verbatim. Anything thrown that is NOT
 * one of these is a bug, and the UI shows a generic failure rather than
 * `err.message` - so a leaked stack or a path never reaches the screen.
 */
export class BundleError extends Error {
    constructor(message, code) {
        super(message)
        this.name = 'BundleError'
        this.code = code || 'bundle'
    }
}

// --- step 3: provenance -----------------------------------------------------

/**
 * Is this `files[]` entry a reference to an UPLOAD rather than a bundled asset?
 *
 * `src/data.json` ships `{ "name": "Caustic_Blast_Acid_1.mp3" }` and nothing
 * else; `handleMultipleAudioUpload` always writes `storedName` alongside `name`.
 * That difference is the whole classifier - no flag, no filename pattern, and
 * nothing to migrate.
 */
export function isUploadedReference(fileRef) {
    return Boolean(fileRef && typeof fileRef === 'object' && fileRef.storedName)
}

/**
 * Is this sound's icon a custom upload?
 *
 * `sound.icon` is a bare string in both cases - a bundled `Forest.png` and an
 * uploaded `icon_9f2c1a_Tentacular.png` look the same to a shape test, and the
 * spec is explicit that provenance must not be guessed from filenames. So the
 * evidence is `iconDisplayName`, which `handleIconUpload` writes in the same
 * setState that installs the storedName and which `src/data.json` never has.
 */
export function isUploadedIcon(sound) {
    return Boolean(sound && typeof sound === 'object' && sound.icon && sound.iconDisplayName)
}

/**
 * Every upload one sound points at, as `{kind, storedName, displayName}`.
 *
 * The single classification site. The icon path and the audio path are both
 * here, which is the only way to guarantee they agree (§3).
 *
 * The legacy `file: "Name.mp3"` shape is walked too, because §3 says both
 * coexist - but it is classified as bundled and so contributes nothing. That is
 * not an assumption: `src/data.json` is its only writer, and every upload path
 * in the app goes through `files[]` + `storedName`.
 */
export function classifySoundReferences(sound) {
    if (!sound || typeof sound !== 'object') return { uploads: [], bundledCount: 0 }

    const uploads = []
    let bundledCount = 0

    for (const entry of Array.isArray(sound.files) ? sound.files : []) {
        if (isUploadedReference(entry)) {
            uploads.push({
                kind: 'audio',
                storedName: entry.storedName,
                displayName: entry.displayName || entry.name || entry.storedName,
            })
        } else {
            bundledCount++
        }
    }

    if (sound.file) bundledCount++

    if (isUploadedIcon(sound)) {
        uploads.push({
            kind: 'icon',
            storedName: sound.icon,
            displayName: sound.iconDisplayName || sound.icon,
        })
    } else if (sound.icon) {
        bundledCount++
    }

    return { uploads, bundledCount }
}

/**
 * EVERY upload a profile owns, de-duplicated by `storedName`.
 *
 * De-duplicating by name here (before hashing) is only a size optimisation -
 * the mandatory dedupe is by CONTENT hash, in `buildBundleBlobs`, because move
 * and copy legitimately let two sounds share one `storedName` and the reverse
 * also happens: the same clip uploaded twice gets two `storedName`s.
 *
 * Each entry also carries `soundName` and `where` (the container's label, and the
 * group name when the container lives in one). They exist for ONE reason: the
 * export refusal used to name a `storedName`, which is not actionable. A GM
 * holding "sound_9wy7vtpo_e2e_silence.wav" cannot tell which card to open -
 * "'Divine Smite' on Human Paladin" they can. Found by the user's hand-test on
 * 2026-10-15: a board whose file had vanished could not be exported, and the
 * message left them guessing which sound it was.
 */
export function collectProfileUploads(data) {
    const byName = new Map()
    for (const container of walkSoundContainers(data)) {
        const groupName = container.groupId ? groupNameOf(data, container.groupId) : ''
        for (const sound of container.sounds) {
            for (const upload of classifySoundReferences(sound).uploads) {
                if (byName.has(upload.storedName)) continue
                byName.set(upload.storedName, {
                    ...upload,
                    soundName: (sound && sound.name) || 'Unnamed sound',
                    where: groupName ? `${container.label} (in ${groupName})` : container.label,
                    groupName,
                })
            }
        }
    }
    return [...byName.values()]
}

// Group names are not carried on the container (it has the group ID, because that
// is what the app's own walker uses), and a missing upload is exactly the case
// where a bare category name would be ambiguous - two groups can both have a
// "Forest". One lookup, only on the failure path's behalf.
function groupNameOf(data, groupId) {
    const group = (data.groups || []).find(g => g && g.id === groupId)
    return (group && group.name) || ''
}

/**
 * Walk ALL FIVE container shapes (PROFILE_SYNC_SPEC.md §3, and the note in
 * App.jsx beside `allSoundContainers`).
 *
 * A four-shape walker looks correct and is not: the fifth is `groups[].sounds`,
 * a vestigial array that `addGroup` allocates and nothing ever pushes into. A
 * sound sitting there is a sound that silently never gets exported.
 *
 * Note environment categories carry NO id - `category` IS the key - so the
 * category name is used as the id here, exactly as the app does.
 */
export function walkSoundContainers(data) {
    const containers = []
    const add = (kind, id, groupId, label, sounds) => {
        containers.push({ kind, id, groupId, label, sounds: Array.isArray(sounds) ? sounds : [] })
    }
    const source = data || {}

    for (const character of source.characters || []) {
        if (!character) continue
        add('character', character.id, null, character.name, character.sounds)
    }
    for (const category of source.environmentSounds || []) {
        if (!category) continue
        add('environment', category.category, null, category.category, category.sounds)
    }
    for (const group of source.groups || []) {
        if (!group) continue
        for (const category of group.categories || []) {
            if (!category) continue
            add('groupCategory', category.category, group.id, category.category, category.sounds)
        }
        for (const character of group.characters || []) {
            if (!character) continue
            add('groupCharacter', character.id, group.id, character.name, character.sounds)
        }
        add('groupTop', group.id, group.id, group.name, group.sounds)
    }

    return containers
}

/**
 * The export refusal the user actually reads, when a board references audio that
 * is no longer on disk.
 *
 * Refusing is correct and stays (§7: a bundle with a hole in it is worse than no
 * bundle - the far end would install a board with silently dead sounds). What was
 * wrong is the *content*: it named `storedName`s, which is an internal identifier
 * carrying a random prefix, and it gave the user nothing to act on. The 2026-10-15
 * hand-test hit exactly this - a board holding one orphaned reference could not be
 * exported and the message left the user guessing which sound it was, which they
 * could only resolve by trial and error.
 *
 * So the message names the sound and where it lives, and says what to do next.
 * Exported so the assertions can pin the text rather than a regex over prose.
 */
export function missingBlobsMessage(missing) {
    const list = missing.map(entry => {
        const name = entry.soundName || entry.displayName || entry.storedName
        const where = entry.where ? ` on ${entry.where}` : ''
        const noun = entry.kind === 'icon' ? 'icon' : 'audio file'
        return `"${name}" (${where.replace(/^ on /, '')}) - its ${noun} is missing`
    })
    const shown = list.slice(0, 3).join('; ')
    const more = list.length > 3 ? ` and ${list.length - 3} more` : ''
    const noun = missing.length === 1 ? 'sound has' : 'sounds have'
    return `${missing.length} ${noun} an audio file that is no longer on disk, so the export was stopped before it could produce an incomplete bundle: ${shown}${more}. Delete ${missing.length === 1 ? 'it' : 'them'}, or upload the audio again, then export.`
}

// --- blob IO: Tauri files vs web data-URLs ---------------------------------
//
// One shape, two backends, so nothing above this line branches on platform.
// The `options` override exists so `e2e/profileBundle.check.mjs` can drive the
// whole pipeline in node against a fake store.

export function defaultBlobStore(profileId) {
    const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined

    if (isTauri) {
        return {
            async read(storedName) {
                const { readFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                const path = profileUploadPath(profileId, storedName)
                if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return null
                return readFile(path, { baseDir: BaseDirectory.AppData })
            },
            async write(storedName, bytes) {
                const { writeFile, mkdir, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                const { dirname } = await import('@tauri-apps/api/path')
                const fullPath = profileUploadPath(profileId, storedName)
                // `dirname` is ASYNC in @tauri-apps/api v2 - it is a Tauri command,
                // not a path-string helper. Without the await, `dir` is a Promise,
                // `exists()` receives it as an object, and the IPC layer rejects with
                // "invalid args `path` for command `exists`: invalid type: map,
                // expected a string". That made EVERY import carrying an uploaded
                // file fail with `write-failed` on desktop AND Android, so a bundle
                // of shipped sounds imported fine and hid it - which is why the
                // hand-test passed. Found by e2e/specs/bundle.mjs I11 on 2026-10-14.
                const dir = await dirname(fullPath)
                if (!(await exists(dir, { baseDir: BaseDirectory.AppData }))) {
                    await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true })
                }
                await writeFile(fullPath, bytes, { baseDir: BaseDirectory.AppData })
            },
            async list() {
                const { readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                try {
                    const entries = await readDir(`uploads/${profileId}`, { baseDir: BaseDirectory.AppData })
                    return entries.filter(e => e && !e.isDirectory).map(e => e.name)
                } catch {
                    return []
                }
            },
            // Existence only, and that is deliberate (§8 step 7). `stat` is not
            // granted, so a size check would mean reading the whole file - which is
            // the cost `skipped` exists to avoid. `storedName` is
            // sound_<rand>_<safeName>, so a name collision means the same upload.
            async has(storedName) {
                const { exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                return exists(profileUploadPath(profileId, storedName), { baseDir: BaseDirectory.AppData })
            },
        }
    }

    return webBlobStore(profileId)
}

function webBlobStore(profileId) {
    return {
        async read(storedName) {
            const value = readProfileValue(profileId, `sound_file_${storedName}`)
            if (!value) return null
            return dataUrlToBytes(value)
        },
        async write(storedName, bytes) {
            writeProfileValue(profileId, `sound_file_${storedName}`, bytesToDataUrl(bytes))
        },
        async list() {
            return webAudioKeys(profileId)
        },
        async has(storedName) {
            return readProfileValue(profileId, `sound_file_${storedName}`) != null
        },
    }
}

function webAudioKeys(profileId) {
    const prefix = `${profileScopedKey(profileId, '')}sound_file_`
    const ls = typeof window !== 'undefined' ? window.localStorage : null
    if (!ls) return []
    const found = []
    for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i)
        if (key && key.startsWith(prefix)) found.push(key.slice(prefix.length))
    }
    return found
}

export function dataUrlToBytes(dataUrl) {
    const comma = String(dataUrl).indexOf(',')
    if (comma === -1) throw new BundleError('Stored audio is not a data URL.', 'corrupt-audio')
    const binary = atob(String(dataUrl).slice(comma + 1))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

export function bytesToDataUrl(bytes, mimeType = 'application/octet-stream') {
    // Chunked so a multi-MB file does not blow the argument limit of
    // `String.fromCharCode(...bytes)`.
    let binary = ''
    const STEP = 0x8000
    for (let i = 0; i < bytes.length; i += STEP) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + STEP))
    }
    return `data:${mimeType};base64,${btoa(binary)}`
}

// --- hashing / naming -------------------------------------------------------

export function sha256Hex(bytes) {
    let hex = ''
    for (const byte of sha256(bytes)) hex += byte.toString(16).padStart(2, '0')
    return hex
}

function extensionOf(storedName) {
    const dot = String(storedName || '').lastIndexOf('.')
    if (dot === -1) return ''
    const ext = storedName.slice(dot + 1)
    return /^[A-Za-z0-9]{1,8}$/.test(ext) ? `.${ext.toLowerCase()}` : ''
}

/** `profile-2026-10-13-hhmm.spellcaster` - safe on every platform's filesystem. */
export function bundleFileName(profileName, date = new Date()) {
    const slug = String(profileName || 'profile')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'profile'
    const stamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
        '-',
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0'),
    ].join('')
    return `${slug}-${stamp}${BUNDLE_EXTENSION}`
}

// --- step 4: build the bundle ----------------------------------------------

/**
 * Read one blob, hash it, and assign it a content-addressed home.
 *
 * Dedupe is BY HASH and that is mandatory rather than an optimisation (§5):
 *   - move/copy lets two sounds name the same `storedName`, and
 *   - the same clip uploaded twice gets two different `storedName`s,
 * so the reference count and the blob count are not 1:1 in either direction.
 * Keying by `storedName` would emit the same bytes twice.
 */
export async function buildBundleBlobs(uploads, store) {
    const byHash = new Map()
    const byStoredName = new Map()
    const missing = []

    for (const upload of uploads) {
        const bytes = await store.read(upload.storedName)
        if (!bytes) {
            // Keep the sound and its container, not just the storedName: this is
            // the whole content of the refusal message the user reads (2026-10-15).
            missing.push({
                storedName: upload.storedName,
                kind: upload.kind,
                soundName: upload.soundName,
                where: upload.where,
            })
            continue
        }
        const digest = sha256Hex(bytes)
        const ext = extensionOf(upload.displayName || upload.storedName)
        const path = `${upload.kind === 'icon' ? 'icons' : 'audio'}/${digest.slice(0, HASH_PREFIX_LEN)}${ext}`
        const storedName = `${digest.slice(0, HASH_PREFIX_LEN)}${ext}`

        if (!byHash.has(digest)) {
            byHash.set(digest, { path, storedName, kind: upload.kind, sha256: digest, bytes: bytes.length, originalName: upload.displayName, data: bytes })
        } else {
            // Same bytes under a second reference: keep the first entry, and
            // remember that this name maps to it.
            byHash.get(digest).bytes = Math.max(byHash.get(digest).bytes, bytes.length)
        }
        byStoredName.set(upload.storedName, { path, storedName })
    }

    return { entries: [...byHash.values()], remap: byStoredName, missing }
}

/** Rewrite one sound's reference fields, spreading everything else untouched. */
function rewriteSound(sound, remap) {
    if (!sound || typeof sound !== 'object') return sound
    const out = { ...sound }

    if (Array.isArray(sound.files)) {
        out.files = sound.files.map(entry => {
            if (!isUploadedReference(entry)) return { ...entry }
            const target = remap.get(entry.storedName)
            // A reference with no blob was reported as missing upstream; leaving
            // it alone here would import a dangling storedName, so it is dropped
            // by `pruneUnresolvableSounds` instead.
            if (!target) return { ...entry }
            return {
                ...entry,
                name: target.storedName,
                storedName: target.storedName,
                url: target.storedName,
                displayName: entry.displayName || entry.name || entry.originalName || target.originalName,
            }
        })
    }

    if (isUploadedIcon(sound)) {
        const target = remap.get(sound.icon)
        if (target) out.icon = target.storedName
        // `iconDisplayName` is left as the user typed it - it is also the
        // provenance signal `isUploadedIcon` reads on the next export.
    }

    return out
}

function rewriteContainerShapes(slice, remap) {
    if (!Array.isArray(slice)) return []
    return slice.map(item => {
        if (!item || typeof item !== 'object') return item
        const out = { ...item }
        if (Array.isArray(item.sounds)) out.sounds = item.sounds.map(s => rewriteSound(s, remap))
        if (Array.isArray(item.categories)) {
            out.categories = item.categories.map(cat => (cat && typeof cat === 'object'
                ? { ...cat, sounds: Array.isArray(cat.sounds) ? cat.sounds.map(s => rewriteSound(s, remap)) : [] }
                : cat))
        }
        if (Array.isArray(item.characters)) {
            out.characters = item.characters.map(ch => (ch && typeof ch === 'object'
                ? { ...ch, sounds: Array.isArray(ch.sounds) ? ch.sounds.map(s => rewriteSound(s, remap)) : [] }
                : ch))
        }
        return out
    })
}

/**
 * The `data.json` payload.
 *
 * `background.imagePreview` is FORCED to `''` rather than merely omitted: the
 * setting block is written whole, and a leftover 5 MB base64 string is exactly
 * what §5.2 and §13 say must never happen. An image background degrades to the
 * theme colour on the importing device, which is the documented behaviour.
 */
export function buildBundleData({ data, settings, remap }) {
    const background = (settings && settings.background) || {}
    return {
        characters: rewriteContainerShapes(data.characters, remap),
        environmentSounds: rewriteContainerShapes(data.environmentSounds, remap),
        groups: rewriteContainerShapes(data.groups, remap),
        settings: {
            boxSize: settings && settings.boxSize != null ? settings.boxSize : 1,
            background: {
                type: background.type === 'image' ? 'color' : (background.type || 'color'),
                theme: background.theme || 'default',
                color: background.color || '#84cc16',
            },
            // §4.2 lists both section-icon keys as profile content, but §5.2's
            // settings block did not carry them. Added here so a round trip
            // cannot silently drop a custom Characters/Environment icon.
            sectionIcons: (settings && settings.sectionIcons) || {},
        },
    }
}

function countSounds(data) {
    let sounds = 0
    for (const container of walkSoundContainers(data)) sounds += container.sounds.length
    return sounds
}

/** `manifest.json`. Plain and unencrypted by design (§6) - no crypto fields. */
export function buildManifest({ profileId, profileName, appVersion, dataVersion, data, entries, exportedAt }) {
    return {
        formatVersion: BUNDLE_FORMAT_VERSION,
        appVersion: appVersion || '0.0.0',
        profile: { id: profileId, name: profileName },
        exportedAt,
        dataVersion,
        files: entries.map(entry => ({
            path: entry.path,
            kind: entry.kind,
            sha256: entry.sha256,
            bytes: entry.bytes,
            originalName: entry.originalName,
        })),
        counts: {
            characters: (data.characters || []).length,
            environmentCategories: (data.environmentSounds || []).length,
            groups: (data.groups || []).length,
            sounds: countSounds(data),
            files: entries.length,
        },
    }
}

// --- zip --------------------------------------------------------------------

/**
 * Write the zip with fflate's streaming API rather than `zipSync`.
 *
 * The point is that a blob can be released once it has been pushed, so a
 * 500-sound library is not resident twice over. The OUTPUT is still accumulated
 * into a single `Uint8Array`, because `exportBundle` returns bytes (§9.3) and
 * `writeFile` takes one buffer - that part is unavoidable and is why rule 3
 * exists.
 */
export function zipEntries(entries) {
    return new Promise((resolve, reject) => {
        const chunks = []
        const zip = new Zip((err, chunk, final) => {
            if (err) { reject(err); return }
            if (chunk) chunks.push(chunk)
            if (!final) return
            let total = 0
            for (const c of chunks) total += c.length
            const out = new Uint8Array(total)
            let offset = 0
            for (const c of chunks) { out.set(c, offset); offset += c.length }
            resolve(out)
        })

        for (const { name, data } of entries) {
            const pass = new ZipPassThrough(name)
            zip.add(pass)
            if (!data.length) {
                pass.push(new Uint8Array(0), true)
                continue
            }
            for (let offset = 0; offset < data.length; offset += CHUNK) {
                const end = Math.min(offset + CHUNK, data.length)
                pass.push(data.subarray(offset, end), end >= data.length)
            }
        }
        zip.end()
    })
}

/**
 * `exportBundle(options) -> Uint8Array` (§9.3).
 *
 * The UI's only job is to have read the profile's data and to hand the result to
 * `writeFile`. Nothing here knows about pickers, React or the filesystem layout.
 */
export async function exportBundle({
    profileId,
    profileName,
    data,
    settings,
    readFile,
    store,
    appVersion,
    dataVersion,
    now = Date.now(),
}) {
    const blobStore = store || defaultBlobStore(profileId)
    const read = readFile || (storedName => blobStore.read(storedName))

    const uploads = collectProfileUploads(data)
    const { entries, remap, missing } = await buildBundleBlobs(uploads, { read })

    if (missing.length > 0) {
        throw new BundleError(missingBlobsMessage(missing), 'missing-blobs')
    }

    const bundleData = buildBundleData({ data, settings, remap })
    const manifest = buildManifest({
        profileId, profileName, appVersion, dataVersion,
        data: bundleData, entries, exportedAt: now,
    })

    const encoder = new TextEncoder()
    const zipEntriesInOrder = [
        { name: 'manifest.json', data: encoder.encode(JSON.stringify(manifest, null, 2)) },
        { name: 'data.json', data: encoder.encode(JSON.stringify(bundleData, null, 2)) },
        ...entries.map(entry => ({ name: entry.path, data: entry.data })),
    ]

    const bytes = await zipEntries(zipEntriesInOrder)
    return { bytes, manifest, data: bundleData }
}

/**
 * The §11 risk 8 guard, at the one call site that hands bytes to `writeFile`.
 * A plain `Array` here produces a file ~3x too large and NO error.
 */
export function assertUint8Array(bytes) {
    if (!(bytes instanceof Uint8Array)) {
        throw new BundleError('Bundle bytes must be a Uint8Array (an Array is silently corrupted on desktop).', 'internal')
    }
    return bytes
}

// --- step 5: read + import ---------------------------------------------------

/**
 * Unpack, refuse anything we cannot fully trust, and verify EVERY checksum
 * before a single byte is written (§8 steps 2-3).
 *
 * Throws `BundleError` and writes nothing at all on: a missing manifest, a
 * `formatVersion` from a newer build (both versions named), a missing payload,
 * or a digest mismatch (the offending file named).
 */
export function parseBundle(bytes) {
    let entries
    try {
        entries = unzipSync(assertUint8Array(bytes))
    } catch (err) {
        throw new BundleError(`That file is not a readable .spellcaster bundle (${err.message}).`, 'not-a-bundle')
    }

    if (!entries['manifest.json']) {
        throw new BundleError('That bundle has no manifest.json, so it is not a profile export.', 'no-manifest')
    }

    let manifest
    try {
        manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    } catch {
        throw new BundleError('That bundle has a corrupt manifest.json.', 'corrupt-manifest')
    }

    if (typeof manifest.formatVersion !== 'number') {
        throw new BundleError('That bundle has no formatVersion, so this build cannot tell how to read it.', 'no-version')
    }
    if (manifest.formatVersion > BUNDLE_FORMAT_VERSION) {
        throw new BundleError(
            `That bundle uses bundle format ${manifest.formatVersion}, but this build of The SpellCaster only understands up to format ${BUNDLE_FORMAT_VERSION}. Update the app and try again.`,
            'too-new'
        )
    }

    if (!entries['data.json']) {
        throw new BundleError('That bundle has no data.json, so it carries no board.', 'no-data')
    }
    let data
    try {
        data = JSON.parse(new TextDecoder().decode(entries['data.json']))
    } catch {
        throw new BundleError('That bundle has a corrupt data.json.', 'corrupt-data')
    }

    const files = new Map()
    for (const file of manifest.files || []) {
        const payload = entries[file.path]
        if (!payload) {
            throw new BundleError(`${labelOf(file)} is listed in the manifest but missing from the bundle. Nothing was imported.`, 'missing-payload')
        }
        const actual = sha256Hex(payload)
        if (actual !== file.sha256) {
            throw new BundleError(`${labelOf(file)} is corrupt (checksum mismatch) - expected ${short(file.sha256)}, got ${short(actual)}. Nothing was imported.`, 'corrupt-payload')
        }
        files.set(file.path, payload)
    }

    return { manifest, data, files }
}

function labelOf(file) {
    return file.originalName || file.path || 'a file'
}

function short(hex) {
    return String(hex || '').slice(0, 12)
}

/**
 * Drop sounds whose audio the bundle does not actually contain (§8).
 *
 * Policy is "keep the container, drop the sound, report the count": an imported
 * profile can reference a bundled asset missing from this build, a sound added
 * by a newer version, or an upload that failed to transfer. Nothing is ever
 * installed half-broken, and one missing file never fails the whole import.
 *
 * `manifestFiles` is the manifest's own `files[]` array - the available set is
 * derived from its paths, which is what actually travelled in the zip.
 */
export function pruneUnresolvableSounds(data, manifestFiles) {
    const dropped = []
    const available = new Set()
    for (const file of manifestFiles || []) {
        if (!file || typeof file.path !== 'string') continue
        available.add(file.path.slice(file.path.lastIndexOf('/') + 1))
    }

    const soundIsResolvable = (sound) => {
        if (!sound || typeof sound !== 'object') return false
        const refs = Array.isArray(sound.files) ? sound.files.filter(isUploadedReference) : []
        if (refs.length > 0 && !refs.every(ref => available.has(ref.storedName))) return false
        if (isUploadedIcon(sound) && !available.has(sound.icon)) return false
        return true
    }

    const mapSounds = (sounds, label) => (sounds || []).filter(sound => {
        if (soundIsResolvable(sound)) return true
        dropped.push({ name: sound.name, label })
        return false
    })

    const out = {
        // `settings` is carried through untouched. It is not sound content, but
        // it is profile content - dropping it here would silently reset the box
        // size and the background theme on every import.
        settings: data.settings,
        characters: [],
        environmentSounds: [],
        groups: [],
    }

    for (const character of data.characters || []) {
        if (!character) continue
        out.characters.push({ ...character, sounds: mapSounds(character.sounds, character.name) })
    }
    for (const category of data.environmentSounds || []) {
        if (!category) continue
        out.environmentSounds.push({ ...category, sounds: mapSounds(category.sounds, category.category) })
    }
    for (const group of data.groups || []) {
        if (!group) continue
        const next = { ...group }
        if (Array.isArray(group.categories)) {
            next.categories = group.categories.map(cat => (cat && typeof cat === 'object'
                ? { ...cat, sounds: mapSounds(cat.sounds, `${group.name} / ${cat.category}`) }
                : cat))
        }
        if (Array.isArray(group.characters)) {
            next.characters = group.characters.map(ch => (ch && typeof ch === 'object'
                ? { ...ch, sounds: mapSounds(ch.sounds, `${group.name} / ${ch.name}`) }
                : ch))
        }
        next.sounds = mapSounds(group.sounds, group.name)
        out.groups.push(next)
    }

    return { data: out, dropped }
}

// --- the pre-import snapshot (the "Replace active" safety story) ------------

const BACKUP_KEY = 'spellcaster_import_backups'
const BACKUP_LIMIT = 3

/**
 * Copy every key a profile owns into ONE global key before "Replace active"
 * wipes it, so the previous board is recoverable rather than merely promised to
 * be (§8).
 *
 * Deliberately GLOBAL, not profile-scoped: the whole point is to read it back
 * when the profile it describes no longer holds what it said it did.
 *
 * Blobs are NOT copied. Installed files are content-addressed, so re-importing
 * writes the same name for the same bytes - it cannot overwrite different
 * content - and the old references simply stop being referenced. Orphaned
 * bytes are waste, not data loss, which is the cheap side of that trade.
 */
export function snapshotProfile(profileId) {
    const keys = profileKeys(profileId)
    const ls = typeof window !== 'undefined' ? window.localStorage : null
    if (!ls) return null

    const captured = {}
    for (const key of keys) {
        const value = readProfileValue(profileId, key)
        if (value !== null) captured[key] = value
    }

    let existing = []
    try {
        const raw = ls.getItem(BACKUP_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        if (Array.isArray(parsed)) existing = parsed
    } catch {
        existing = []
    }

    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    existing.push({ profileId, stamp, keys: captured })
    while (existing.length > BACKUP_LIMIT) existing.shift()

    try {
        ls.setItem(BACKUP_KEY, JSON.stringify(existing))
    } catch (err) {
        console.error('[profiles] could not write the pre-import snapshot:', err)
        throw new BundleError('There was not enough room to snapshot this profile, so nothing was imported.', 'no-snapshot')
    }

    return { profileId, stamp, keys: captured }
}

/** Restore a snapshot taken by `snapshotProfile`. */
export function restoreProfileSnapshot(snapshot) {
    if (!snapshot || !snapshot.profileId) return false
    for (const key of profileKeys(snapshot.profileId)) {
        removeProfileValue(snapshot.profileId, key)
    }
    for (const [key, value] of Object.entries(snapshot.keys)) {
        writeProfileValue(snapshot.profileId, key, value)
    }
    return true
}

// --- commit -----------------------------------------------------------------

/**
 * Write the board's keys. This is the commit point - it runs LAST, after every
 * blob is on disk (rule 4).
 */
function commitKeys(profileId, { data, settings, normalize, dataVersion }) {
    const normalized = {
        characters: normalize('ttrpg_characters', data.characters || []),
        environmentSounds: normalize('ttrpg_environment', data.environmentSounds || []),
        groups: normalize('ttrpg_groups', data.groups || []),
    }

    // Whatever keys the target already had that we are not setting must go, or
    // a stale icon from the previous board survives the import.
    const written = new Set(['ttrpg_characters', 'ttrpg_environment', 'ttrpg_groups', 'ttrpg_data_version', 'boxSize', 'backgroundSettings', 'ttrpg_characters_icon', 'ttrpg_environment_icon'])
    for (const key of profileKeys(profileId)) {
        if (!written.has(key)) removeProfileValue(profileId, key)
    }

    writeProfileValue(profileId, 'ttrpg_characters', JSON.stringify(normalized.characters))
    writeProfileValue(profileId, 'ttrpg_environment', JSON.stringify(normalized.environmentSounds))
    writeProfileValue(profileId, 'ttrpg_groups', JSON.stringify(normalized.groups))

    const boxSize = settings && settings.boxSize != null ? settings.boxSize : 1
    writeProfileValue(profileId, 'boxSize', String(boxSize))

    const background = (settings && settings.background) || {}
    writeProfileValue(profileId, 'backgroundSettings', JSON.stringify({
        type: background.type || 'color',
        theme: background.theme || 'default',
        color: background.color || '#84cc16',
        imageFile: null,
        // The custom background image is NOT synced (§6). An empty string means
        // "no image chosen", which is what the app reads as its fallback.
        imagePreview: '',
        isLoading: false,
    }))

    const sectionIcons = (settings && settings.sectionIcons) || {}
    writeProfileValue(profileId, 'ttrpg_characters_icon', sectionIcons.characters || '')
    writeProfileValue(profileId, 'ttrpg_environment_icon', sectionIcons.environment || '')

    // Stamp the version LAST. `readProfileData` treats a MISSING version stamp as
    // a key written before versioning and snapshots it to `<key>_old`, so
    // writing this after the data avoids a spurious backup on first read.
    if (dataVersion) writeProfileValue(profileId, 'ttrpg_data_version', dataVersion)

    return normalized
}

/**
 * `importBundle(bytes, options) -> report` (§9.3).
 *
 * Order matters and is the whole atomicity story (rule 4):
 *   1. parse + verify every checksum        - throws, writes nothing
 *   2. snapshot, if replacing the live profile
 *   3. write every blob                     - a failure here aborts before
 *                                             any key is touched
 *   4. commit the keys
 *   5. remount
 *
 * The returned report carries a per-file status list (§8 step 7): every manifest
 * file appears as `imported`, `skipped` or `failed`. `failed` aborts everything
 * before it, so in practice a returned report has no `failed` entry in it.
 */
export async function importBundle(bytes, {
    mode = 'new',
    targetProfileId,
    profileName,
    store,
    normalize,
    dataVersion,
    setActive = true,
} = {}) {
    if (typeof normalize !== 'function') {
        throw new BundleError('importBundle needs the app\'s normalizeStoredData to repair imported shapes.', 'internal')
    }

    const { manifest, data, files } = parseBundle(bytes)
    const manifestFiles = manifest.files || []

    const bundleProfileName = (manifest.profile && manifest.profile.name) || profileName || 'Imported profile'

    let profileId = targetProfileId
    let snapshot = null

    if (mode === 'replace') {
        profileId = targetProfileId || getActiveProfileId()
        if (!profileId) throw new BundleError('There is no active profile to replace.', 'no-active')
        snapshot = snapshotProfile(profileId)
    } else {
        profileId = createProfile(bundleProfileName)
        if (!profileId) throw new BundleError('Could not create a profile for this bundle.', 'no-profile')
    }

    // The blob store is bound to the TARGET profile, so this line must come
    // after the profile id is settled - for "new" that means after createProfile.
    const blobStore = store || defaultBlobStore(profileId)

    let written = 0
    let skipped = 0
    const failed = []
    const fileReport = []
    // `has` is optional on an injected store, so a store that predates it (the
    // node check's fake, a caller supplying their own) simply always writes.
    const canSkip = typeof blobStore.has === 'function'
    for (const file of manifestFiles) {
        const storedName = file.path.slice(file.path.lastIndexOf('/') + 1)
        const label = labelOf(file)
        try {
            if (canSkip && await blobStore.has(storedName)) {
                // §8 step 7's "skipped (already present)". Re-writing a byte-identical
                // blob is the common case for "replace active" on a board that came
                // from its own export, and it is the slowest part of the import.
                skipped++
                fileReport.push({ path: file.path, label, status: 'skipped' })
                continue
            }
            await blobStore.write(storedName, files.get(file.path))
            written++
            fileReport.push({ path: file.path, label, status: 'imported' })
        } catch (err) {
            console.error(`[profiles] could not import ${label}:`, err)
            failed.push(label)
            fileReport.push({ path: file.path, label, status: 'failed' })
        }
    }

    if (failed.length > 0) {
        // Roll the key write forward is impossible and unnecessary: no key has
        // been touched yet. Restore the snapshot so "replace" is a no-op too.
        if (snapshot) restoreProfileSnapshot(snapshot)
        throw new BundleError(
            `${failed.length} file(s) could not be written, so nothing was imported: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ', …' : ''}`,
            'write-failed'
        )
    }

    const { data: pruned, dropped } = pruneUnresolvableSounds(data, manifestFiles)

    commitKeys(profileId, {
        data: pruned,
        settings: pruned.settings,
        normalize,
        dataVersion,
    })

    if (setActive) {
        if (mode === 'replace') {
            // The live profile just changed under the app's feet. A remount is
            // the only thing that makes the auto-save effects agree with the
            // profile they are about to write to - §11 risk 10's residual case,
            // and the one path the remount-on-switch does not cover by itself.
            requestProfileRemount()
        } else {
            setActiveProfile(profileId)
        }

        // Park the summary for the UI, because the remount above destroys the
        // modal that would otherwise report it (§9.2). This lives here, not in
        // the UI, for two reasons: the engine is the only thing that knows the
        // report, and a UI-side write would sit behind a native picker and so
        // could never be covered by a test at all - whereas this line is covered
        // by profileBundle.check.mjs and by specs/bundle.mjs for free.
        //
        // GLOBAL, like the index and like spellcaster_import_backups above: an
        // import can create a new profile, so this must not be namespaced under
        // the profile it just replaced. The app reads and removes it on the next
        // mount, so it is one-shot.
        try {
            const ls = typeof window !== 'undefined' ? window.localStorage : null
            if (ls) {
                ls.setItem(IMPORT_NOTICE_KEY, JSON.stringify({
                    profileId,
                    profileName: bundleProfileName,
                    mode,
                    imported: written,
                    skipped,
                    files: fileReport,
                    dropped,
                    dataVersionSkew: manifest.dataVersion && dataVersion && manifest.dataVersion !== dataVersion
                        ? { bundle: manifest.dataVersion, app: dataVersion }
                        : null,
                }))
            }
        } catch (err) {
            // A notice that cannot be stored is a lost nicety, never a failed
            // import - the import itself has already committed by this point.
            console.warn('[profiles] could not store the import notice:', err)
        }
    }

    return {
        profileId,
        profileName: bundleProfileName,
        mode,
        imported: written,
        skipped,
        files: fileReport,
        dropped,
        dataVersionSkew: manifest.dataVersion && dataVersion && manifest.dataVersion !== dataVersion
            ? { bundle: manifest.dataVersion, app: dataVersion }
            : null,
        snapshot,
    }
}

// --- reading a profile for export -------------------------------------------

/**
 * Assemble the `{data, settings}` pair `exportBundle` wants, from profile-
 * scoped storage. Lives here so the UI passes one object and knows nothing
 * about which keys exist.
 *
 * `readValue`/`parse` are injected because the caller already has the live
 * React state - exporting what is ON SCREEN, not a re-read of storage that
 * might lag a keystroke behind it.
 */
export function collectProfileForExport({ characters, environmentSounds, groups, boxSize, backgroundSettings, charSectionIcon, envSectionIcon, parse }) {
    const readJson = (key, fallback) => {
        const raw = parse(key)
        if (raw == null) return fallback
        try {
            const value = typeof raw === 'string' ? JSON.parse(raw) : raw
            return Array.isArray(value) ? value : fallback
        } catch {
            return fallback
        }
    }

    return {
        data: {
            characters: characters || readJson('ttrpg_characters', []),
            environmentSounds: environmentSounds || readJson('ttrpg_environment', []),
            groups: groups || readJson('ttrpg_groups', []),
        },
        settings: {
            boxSize: boxSize != null ? boxSize : 1,
            background: backgroundSettings || {},
            sectionIcons: { characters: charSectionIcon || '', environment: envSectionIcon || '' },
        },
    }
}