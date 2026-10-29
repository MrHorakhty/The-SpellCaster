// ---------------------------------------------------------------------------
// Profile-scoped storage.
//
// Every board key lives under `profile:<profileId>:<key>`. Before profiles, the
// keys were bare (`ttrpg_characters`, `boxSize`, `sound_file_*`); on first run
// the existing unprefixed keys are moved into a default profile, so a user's
// board survives the upgrade (PROFILE_SYNC_SPEC.md §4.2).
//
// Three rules this module exists to enforce:
//
//   1. NO CALL SITE KEEPS A HARD-CODED KEY. All reads/writes/enumeration go
//      through here, including the `localStorage.length` / `.key(i)` sweep in
//      App.jsx's web->Tauri audio migration - a get/set/remove-only wrapper
//      would leave that loop reading the global namespace.
//
//   2. THE INDEX IS NOT PREFIXED. `spellcaster_profiles` is how you find a
//      profile in the first place, so prefixing it would make it unfindable.
//      `localStorageMigrationCompleted` is also global, deliberately: it records
//      a one-time web->Tauri audio sweep, which is a property of the DEVICE,
//      not of a profile. Prefixing it would re-run that sweep per profile.
//
//   3. A VERSION MISMATCH MIGRATES, IT NEVER RESETS. The pre-profiles path
//      (App.jsx's readStoredData) reset a mismatched key to defaults and renamed
//      the old value to `<key>_old`. That is survivable for one unversioned
//      store and unacceptable once every profile has its own key - the likeliest
//      source of skew is an older bundle, and wiping a board because of it is
//      the worst thing this feature could do. `readProfileData` therefore
//      REPAIRS forward through the existing `normalizeStoredData` and keeps the
//      data. (Decision 3, PROFILE_SYNC_SPEC.md §0.3.)
//
// Tauri note: audio bytes are NOT in localStorage - they are files under
// AppData/uploads/. Those get their profile segment from `profileUploadDir()`
// below, which is the path-side counterpart of this module. The two must stay
// in step: a profile owns its own uploads directory, and blobs are never
// hardlinked or shared between profiles (§11 risk 6).
// ---------------------------------------------------------------------------

export const PROFILE_INDEX_KEY = 'spellcaster_profiles'
export const PROFILE_PREFIX = 'profile:'
export const UPLOADS_ROOT = 'uploads'

// Deliberately NOT namespaced. See rule 2 above.
export const GLOBAL_KEYS = new Set(['localStorageMigrationCompleted', 'spellcaster_reorder_animation'])

// An installation preference, deliberately shared by profiles and absent from bundles.
const REORDER_ANIMATION_KEY = 'spellcaster_reorder_animation'
export function readReorderAnimation() {
    try { return storage()?.getItem(REORDER_ANIMATION_KEY) !== 'false' } catch { return true }
}
export function writeReorderAnimation(enabled) {
    const ls = storage()
    if (!ls) throw new Error('Local storage is unavailable')
    ls.setItem(REORDER_ANIMATION_KEY, String(enabled !== false))
}

// Keys that belong to a profile and existed before profiles did. First-run
// migration moves exactly these (plus any `sound_file_*`) into the default
// profile. Anything not listed stays where it is.
export const LEGACY_PROFILE_KEYS = [
    'ttrpg_characters',
    'ttrpg_environment',
    'ttrpg_groups',
    'ttrpg_data_version',
    'ttrpg_characters_icon',
    'ttrpg_environment_icon',
    'boxSize',
    'backgroundSettings',
]

const WEB_AUDIO_PREFIX = 'sound_file_'

function storage() {
    return typeof window !== 'undefined' ? window.localStorage : null
}

function makeId() {
    // crypto.randomUUID when available, else a randomValues hex, else
    // Math.random. The id only has to be unique on this device - it is never a
    // sync or identity primitive, and it carries no personal data.
    const webCrypto = typeof window !== 'undefined' ? window.crypto : null
    const rand = webCrypto && typeof webCrypto.getRandomValues === 'function'
        ? Array.from(webCrypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('')
        : Math.random().toString(36).slice(2, 10)
    return `p_${rand}`
}

/** `profile:<id>:<key>` - the one place a scoped key is spelled. */
export function profileScopedKey(profileId, key) {
    return `${PROFILE_PREFIX}${profileId}:${key}`
}

/** The profile that owns a scoped key, or null if it is not scoped. */
export function profileIdFromScopedKey(scopedKey) {
    if (!scopedKey.startsWith(PROFILE_PREFIX)) return null
    const rest = scopedKey.slice(PROFILE_PREFIX.length)
    const sep = rest.indexOf(':')
    return sep === -1 ? null : rest.slice(0, sep)
}

// --- the profile index -----------------------------------------------------

const EMPTY_INDEX = { version: 1, activeProfileId: null, profiles: [] }

export function readProfileIndex() {
    const ls = storage()
    if (!ls) return { ...EMPTY_INDEX }
    try {
        const raw = ls.getItem(PROFILE_INDEX_KEY)
        if (!raw) return { ...EMPTY_INDEX }
        const parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.profiles)) return { ...EMPTY_INDEX }
        const profiles = parsed.profiles
            .filter(p => p && typeof p.id === 'string' && p.id)
            .map(p => ({ id: p.id, name: String(p.name || 'Profile') }))
        if (profiles.length === 0) return { ...EMPTY_INDEX }
        const activeProfileId = profiles.some(p => p.id === parsed.activeProfileId)
            ? parsed.activeProfileId
            : profiles[0].id
        return { version: 1, activeProfileId, profiles }
    } catch {
        // A corrupt index must not take the app down; fall back to defaults and
        // let the first-run migration rebuild it.
        return { ...EMPTY_INDEX }
    }
}

export function writeProfileIndex(index) {
    const ls = storage()
    if (!ls) return
    ls.setItem(PROFILE_INDEX_KEY, JSON.stringify(index))
}

// --- first-run migration ---------------------------------------------------

/**
 * Move a legacy unprefixed key into `profileId`. Copy first, verify, then
 * remove: if any step throws the user's data is still in the old key. This is
 * the ordering rule from the backup script, applied to user data.
 */
function adoptLegacyKey(ls, key, profileId) {
    const legacyValue = ls.getItem(key)
    if (legacyValue === null) return false
    const target = profileScopedKey(profileId, key)
    try {
        ls.setItem(target, legacyValue)
        if (ls.getItem(target) !== legacyValue) throw new Error('verify failed')
        ls.removeItem(key)
        return true
    } catch (err) {
        console.error(`[profiles] could not migrate ${key}; left in place:`, err)
        return false
    }
}

/**
 * Ensure a profile exists and the active one is known. Idempotent: after the
 * first call it reads a single key and returns.
 *
 * Migrates the legacy unprefixed keys into the default profile on first run.
 */
/**
 * First-run adoption. Returns the active profile id, creating one if the store
 * has none.
 *
 * ⚠️ `dataVersion` must be passed, for exactly the reason `createProfile` takes
 * one — see the note there. This is the **more important** of the two, because
 * this is the path *every user* takes on their first launch: an unstamped first
 * profile means the shipped defaults the auto-save effect writes on mount have no
 * `ttrpg_data_version`, so the user's **second** launch takes the
 * `storedVersion === null` branch in `readProfileData` and leaves a
 * `ttrpg_characters_old` backup of the app's own defaults behind, permanently.
 *
 * Found 2026-10-15 by the Android restore guard (exit 5), which reported
 * `extra: profile:p_0f23bbd8:ttrpg_characters_old, profile:p_0f23bbd8:ttrpg_data_version`
 * after a *correct* restore — the app had recreated both on boot. Every one of
 * those suites was green; the store guard was the only thing looking.
 */
export function ensureProfileStore(dataVersion) {
    const ls = storage()
    if (!ls) return null

    const existing = readProfileIndex()
    if (existing.profiles.length > 0) return existing.activeProfileId

    const id = makeId()
    const now = Date.now()
    const index = {
        version: 1,
        activeProfileId: id,
        profiles: [{ id, name: 'My Board', createdAt: now, updatedAt: now }],
    }

    let moved = 0
    for (const key of LEGACY_PROFILE_KEYS) {
        if (adoptLegacyKey(ls, key, id)) moved++
    }
    // Web audio data-URLs (`sound_file_*`) are profile content too.
    const audioKeys = keysWithPrefix(WEB_AUDIO_PREFIX)
    for (const key of audioKeys) {
        if (adoptLegacyKey(ls, key, id)) moved++
    }

    writeProfileIndex(index)
    if (dataVersion) {
        try { ls.setItem(profileScopedKey(id, 'ttrpg_data_version'), dataVersion) } catch { /* quota: the read path repairs it */ }
    }
    if (moved > 0) {
        console.log(`[profiles] first run: adopted ${moved} existing key(s) into profile ${id}`)
    }
    return id
}

// --- profile CRUD ----------------------------------------------------------

// Listeners fire whenever the ACTIVE profile changes - an explicit switch, or
// deleting the active one. The app subscribes and remounts; see
// PROFILE_SYNC_SPEC.md §0.3 decision 2 for why a remount, not a state swap.
const switchListeners = new Set()

export function getActiveProfileId() {
    return readProfileIndex().activeProfileId
}

/**
 * `dataVersion` is not optional in practice and the app always passes it. It is
 * here because a new profile must be **version-stamped from birth**.
 *
 * 💡 Without it, creating a profile leaves it UNSTAMPED, and that is a real bug
 * rather than a tidiness one: the app remounts onto the empty profile, the
 * auto-save effect writes the shipped defaults into it, and **nothing writes
 * `ttrpg_data_version`**. The next read of that profile then hits the
 * `storedVersion === null` branch in `readProfileData`, which treats it as "a key
 * written before versioning" and leaves a `<key>_old` backup behind - of the
 * shipped defaults the app itself wrote seconds earlier. So every profile a user
 * ever creates collects a junk backup on its next launch, and the
 * "no `<key>_old` keys" guards (P13/P14a/P31a/O10/M21) fire on it.
 *
 * Found on 2026-10-15: the Android store turned up with
 * `profile:p_b01d9bac:ttrpg_characters_old` on a profile the E2E suite had
 * created, and the suite was reading it on the following run.
 *
 * Existing unstamped profiles still self-heal with one `_old` each - that path is
 * the intended migration and is left alone.
 */
export function createProfile(name, dataVersion) {
    const ls = storage()
    if (!ls) return null
    const index = readProfileIndex()
    const id = makeId()
    const now = Date.now()
    index.profiles.push({ id, name: String(name || 'New Profile').trim() || 'New Profile', createdAt: now, updatedAt: now })
    writeProfileIndex(index)
    if (dataVersion) {
        try { ls.setItem(profileScopedKey(id, 'ttrpg_data_version'), dataVersion) } catch { /* quota: the read path repairs it */ }
    }
    return id
}

export function renameProfile(profileId, name) {
    const ls = storage()
    if (!ls) return false
    const index = readProfileIndex()
    const profile = index.profiles.find(p => p.id === profileId)
    if (!profile) return false
    profile.name = String(name || '').trim() || profile.name
    profile.updatedAt = Date.now()
    writeProfileIndex(index)
    return true
}

/**
 * Delete a profile's keys and the profile itself. Refuses to delete the last
 * one - a board with no profile has nowhere to read from. Never touches another
 * profile's keys or blobs: each profile owns exactly its own namespace.
 *
 * Returns the id to fall back to, or null if nothing was removed.
 */
export function deleteProfile(profileId) {
    const ls = storage()
    if (!ls) return null
    const index = readProfileIndex()
    if (index.profiles.length <= 1) return null
    const next = index.profiles.filter(p => p.id !== profileId)
    if (next.length === index.profiles.length) return null

    // Only this profile's keys. Each profile owns its own namespace, so another
    // profile's board is untouched by construction.
    for (const key of keysWithPrefix(`${PROFILE_PREFIX}${profileId}:`)) {
        ls.removeItem(key)
    }
    const wasActive = index.activeProfileId === profileId
    index.profiles = next
    index.activeProfileId = wasActive ? next[0].id : index.activeProfileId
    writeProfileIndex(index)
    if (wasActive) {
        // Deleting the active profile is a switch too - notify so the app
        // remounts onto the fallback instead of rendering a profile that no
        // longer exists.
        for (const listener of switchListeners) listener(index.activeProfileId)
    }
    return index.activeProfileId
}

/**
 * Point the app at another profile.
 *
 * Only the index is written - no React state is touched here. The caller is
 * expected to remount (PROFILE_SYNC_SPEC.md §0.3 decision 2), and this notifies
 * whoever owns that. A full remount is what makes the switch safe: the new
 * profile becomes the first-load state, so the auto-save effects can never run
 * with one profile's state and another profile's prefix.
 */
export function setActiveProfile(profileId) {
    const index = readProfileIndex()
    if (!index.profiles.some(p => p.id === profileId)) return false
    index.activeProfileId = profileId
    writeProfileIndex(index)
    for (const listener of switchListeners) listener(profileId)
    return true
}

export function subscribeProfileSwitch(listener) {
    switchListeners.add(listener)
    return () => switchListeners.delete(listener)
}

/**
 * Ask the app to remount onto the profile it is ALREADY on.
 *
 * Separate from `setActiveProfile` because that one changes state, and this
 * does not - it is a lie to call it here, and it would stop being the right
 * call the moment the id check tightened.
 *
 * It exists for one case: "Replace active" import writes a new board into the
 * live profile's keys while React still holds the old one. The three auto-save
 * effects then fire on the next state change and write that stale state straight
 * back over the import. A remount is the fix, and it is the same fix a switch
 * uses (PROFILE_SYNC_SPEC.md §11 risk 10's residual case).
 */
export function requestProfileRemount() {
    const active = readProfileIndex().activeProfileId
    for (const listener of switchListeners) listener(active)
    return active
}

// --- scoped value access ---------------------------------------------------

export function readProfileValue(profileId, key) {
    const ls = storage()
    if (!ls || !profileId) return null
    return ls.getItem(profileScopedKey(profileId, key))
}

export function writeProfileValue(profileId, key, value) {
    const ls = storage()
    if (!ls || !profileId) return
    ls.setItem(profileScopedKey(profileId, key), value)
}

export function removeProfileValue(profileId, key) {
    const ls = storage()
    if (!ls || !profileId) return
    ls.removeItem(profileScopedKey(profileId, key))
}

/** Every key in storage beginning with `prefix`, across all namespaces. */
export function keysWithPrefix(prefix) {
    const ls = storage()
    if (!ls) return []
    const found = []
    for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i)
        if (key && key.startsWith(prefix)) found.push(key)
    }
    return found
}

/** Every key belonging to one profile, unprefixed (so it can be re-scoped). */
export function profileKeys(profileId) {
    return keysWithPrefix(`${PROFILE_PREFIX}${profileId}:`)
        .map(k => k.slice(`${PROFILE_PREFIX}${profileId}:`.length))
}

export function removeAllProfileValues(profileId, keys) {
    const ls = storage()
    if (!ls) return
    for (const key of keys) ls.removeItem(profileScopedKey(profileId, key))
}

/**
 * Read a stored collection, repairing it forward rather than discarding it.
 *
 * `normalize` is App.jsx's existing `normalizeStoredData`, which already
 * guarantees array shapes - it is the forward-migration entry point and the
 * reason no DATA_VERSION bump is needed for an additive field. A version
 * mismatch used to mean "rename to <key>_old, delete, return defaults"; here it
 * means "normalize what is there and keep it" (§0.3 decision 3).
 */
export function readProfileData(profileId, key, fallback, normalize, dataVersion) {
    const ls = storage()
    if (!ls || !profileId) return normalize(key, fallback)

    const versionKey = profileScopedKey(profileId, 'ttrpg_data_version')
    const storedVersion = ls.getItem(versionKey)
    const raw = ls.getItem(profileScopedKey(profileId, key))

    if (raw === null) {
        return normalize(key, fallback)
    }

    if (storedVersion !== dataVersion) {
        // Repair forward. The old value is preserved under <key>_old exactly as
        // before, so a user who wants their pre-migration board can still get
        // it - but the board they are looking at is NOT thrown away.
        if (storedVersion === null) {
            // No version recorded at all: a key written before versioning, or an
            // imported bundle. Snapshot it once, then adopt the current version.
            try { ls.setItem(profileScopedKey(profileId, `${key}_old`), raw) } catch { /* quota: keep going */ }
        }
        try { ls.setItem(versionKey, dataVersion) } catch { /* quota: keep going */ }
    }

    let parsed = null
    try {
        parsed = JSON.parse(raw)
    } catch {
        // Unparseable is the one case we cannot repair. Fall back to defaults
        // rather than crash, and keep the bad value for inspection.
        try { ls.setItem(profileScopedKey(profileId, `${key}_old`), raw) } catch { /* quota */ }
        return normalize(key, fallback)
    }

    if (!Array.isArray(parsed)) {
        return normalize(key, fallback)
    }
    return normalize(key, parsed)
}

// --- Tauri upload paths ----------------------------------------------------

/**
 * The uploads directory for a profile: `uploads/<profileId>`.
 *
 * The path-side counterpart to the key scoping above. Per-profile directories
 * are safe even though move/copy lets two sounds share one `storedName`,
 * because `isFileReferencedElsewhere` only scans the active profile's in-memory
 * state - but say so in a comment there, or a future "simplification" will
 * reintroduce cross-profile byte loss (§11 risk 6).
 */
export function profileUploadDir(profileId) {
    return profileId ? `${UPLOADS_ROOT}/${profileId}` : UPLOADS_ROOT
}

/** `uploads/<profileId>/<fileName>` */
export function profileUploadPath(profileId, fileName) {
    return `${profileUploadDir(profileId)}/${fileName}`
}

// --- Tauri uploads: the one-time file migration ----------------------------
//
// THE COMPANION TO ensureProfileStore(). That function adopts pre-profile
// localStorage keys; this adopts the pre-profile AUDIO BYTES. Without it a user
// who already had uploads would keep their board (the storedName references
// survived) but every file would be unreachable, because the lookup path gained
// a profile segment while the bytes on disk did not. Web cannot catch this -
// web audio lives in localStorage and is adopted by ensureProfileStore.
//
// IDEMPOTENT BY STRUCTURE, NOT BY FLAG. The test is "are there any FILES sitting
// directly in uploads/". Once they have been moved the directory holds only
// per-profile subdirectories, so a second run finds nothing and does nothing -
// there is no marker key to get out of step with reality, and no flag that a
// half-finished migration could leave set. A crash mid-move simply leaves the
// remaining files flat, and the next run picks them up.
//
// Per-file and copy-then-delete inside the rename fallback: one unreadable file
// must not abandon the other 111.

function isTauriApp() {
    return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined
}

/**
 * Which files need moving, as {from, to} pairs. Split out as a pure function
 * because this is the part that can be wrong in a way the fs calls will not
 * reveal: the path arithmetic, and the fact that directories are skipped. A
 * directory wrongly treated as a file would be renamed INTO the profile folder
 * and quietly nest a subtree.
 */
export function planUploadMigration(entries, profileId) {
    return (entries || [])
        .filter(e => e && !e.isDirectory)
        .map(e => ({
            name: e.name,
            from: `${UPLOADS_ROOT}/${e.name}`,
            to: `${profileUploadDir(profileId)}/${e.name}`,
        }))
}

/**
 * Move every file sitting flat in `uploads/` into `uploads/<profileId>/`.
 * Returns { moved, skipped, failed }.
 *
 * `skipped` counts files whose destination already exists - that is a re-run
 * after a partial migration, and clobbering the copy already in place would
 * destroy data.
 */
export async function migrateUploadsToProfile(profileId) {
    const empty = { moved: 0, skipped: 0, failed: 0 }
    if (!isTauriApp() || !profileId) return empty

    const { readDir, mkdir, rename, readFile, writeFile, remove, exists, BaseDirectory } =
        await import('@tauri-apps/plugin-fs')

    const targetDir = profileUploadDir(profileId)
    try {
        await mkdir(targetDir, { baseDir: BaseDirectory.AppData, recursive: true })
    } catch (err) {
        console.error('[profiles] could not create the profile uploads dir:', err)
        return empty
    }

    let entries = []
    try {
        entries = await readDir(UPLOADS_ROOT, { baseDir: BaseDirectory.AppData })
    } catch {
        return empty   // no uploads dir yet - nothing to migrate
    }

    const plan = planUploadMigration(entries, profileId)
    if (plan.length === 0) return empty

    let moved = 0, skipped = 0, failed = 0
    for (const { name, from, to } of plan) {
        try {
            if (await exists(to, { baseDir: BaseDirectory.AppData })) { skipped++; continue }
            try {
                await rename(from, to, { baseDir: BaseDirectory.AppData })
            } catch {
                // Fallback for a device where rename is unavailable: copy the
                // bytes, then delete the original. A crash between the two
                // leaves both copies, and the next run skips rather than
                // clobbering.
                const bytes = await readFile(from, { baseDir: BaseDirectory.AppData })
                await writeFile(to, bytes, { baseDir: BaseDirectory.AppData })
                await remove(from, { baseDir: BaseDirectory.AppData })
            }
            moved++
        } catch (err) {
            failed++
            console.error(`[profiles] could not migrate upload "${name}":`, err)
        }
    }

    if (moved || skipped || failed) {
        console.log(`[profiles] uploads -> ${profileId}: ${moved} moved, ${skipped} already present, ${failed} failed`)
    }
    return { moved, skipped, failed }
}

// Memoised per profile: the file operations await this, so a click during the
// migration waits for it instead of failing to find the file.
const uploadsMigrations = new Map()

export function ensureUploadsMigrated(profileId) {
    if (!uploadsMigrations.has(profileId)) {
        uploadsMigrations.set(profileId, migrateUploadsToProfile(profileId).catch(err => {
            console.error('[profiles] uploads migration failed:', err)
            return { moved: 0, skipped: 0, failed: 0 }
        }))
    }
    return uploadsMigrations.get(profileId)
}

/**
 * How many files a profile owns. Used to tell the user what deleting it will
 * cost BEFORE they confirm - deleting audio is not undoable.
 *
 * A COUNT, not a byte total: Tauri exposes no directory listing with file sizes
 * here, and `stat` is not in the granted permission set, so a size figure would
 * need another capability for very little benefit.
 */
export async function profileUploadFileCount(profileId) {
    if (!isTauriApp() || !profileId) return 0
    const { readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    try {
        const entries = await readDir(profileUploadDir(profileId), { baseDir: BaseDirectory.AppData })
        return entries.filter(e => e && !e.isDirectory).length
    } catch {
        return 0
    }
}

/**
 * Delete the audio a profile owns. Files only: `fs:allow-remove-dir` does not
 * exist, so the (now empty) per-profile directory is left in place rather than
 * adding a capability for it.
 *
 * ⚠️ Callers MUST confirm with the user first - this is unrecoverable. The guard
 * here is that it refuses to run for a profile that still has another one to
 * fall back on being active; the UI owns the "are you sure".
 */
export async function removeProfileUploads(profileId) {
    if (!isTauriApp() || !profileId) return { removed: 0 }
    const { readDir, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    let entries = []
    try {
        entries = await readDir(profileUploadDir(profileId), { baseDir: BaseDirectory.AppData })
    } catch {
        return { removed: 0 }
    }
    let removed = 0
    for (const entry of entries) {
        if (!entry || entry.isDirectory) continue
        try {
            await remove(`${profileUploadDir(profileId)}/${entry.name}`, { baseDir: BaseDirectory.AppData })
            removed++
        } catch (err) {
            console.error(`[profiles] could not delete upload "${entry.name}":`, err)
        }
    }
    return { removed }
}
