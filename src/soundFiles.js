// Per-file entry normalisation, and the PROVENANCE rule that goes with it.
//
// `storedName` is not an identity - it is a PROVENANCE marker:
//
//   - an entry WITH a `storedName` is an UPLOAD. Its bytes live in the uploads
//     store under that name, and a profile bundle has to carry them.
//   - an entry WITHOUT one is a BUNDLED asset. Its bytes ship with the app and
//     resolve from `/assets`.
//
// The rule used to be broken in one direction, and it was broken by the
// normaliser itself: it copied `name` into `storedName`, so **editing any sound
// with bundled files turned those bundled assets into fake uploads**. The
// bundle export then tried to include them, could not find them in the uploads
// store, and refused to export - a profile that had been edited could no
// longer be backed up. The field is COPIED here, never derived from the name.
//
// Every reader in the app already falls back to `name` (`storedName || name`),
// so an empty `storedName` is safe: it means "bundled", and the file still has
// an identity.
//
// Split out of App.jsx so a node check can reach it, the same reason
// `fadeMath.js` is its own module.

import { normalizeFadeSeconds } from './fadeMath.js'

/**
 * Repair the editor's old icon provenance bug. It copied a bundled icon's
 * filename into iconDisplayName, which marks an upload to the bundle engine.
 * Only repair that exact pair against the shipped catalogue; missing uploads
 * and their display names must remain uploads, even when their bytes are gone.
 */
export const normalizeIconDisplayName = (sound, bundledIcons) => {
    const displayName = sound.iconDisplayName || ''
    return displayName === sound.icon && bundledIcons.has(sound.icon) ? '' : displayName
}

/** Repair the older audio marker bug using catalogue membership as evidence. */
export const repairBundledAudioReferences = (sound, bundledAudio) => {
    if (!Array.isArray(sound.files)) return sound
    let changed = false
    const files = sound.files.map(file => {
        if (!file || !file.storedName || file.storedName !== file.name || !bundledAudio.has(file.storedName)) return file
        changed = true
        return { ...file, storedName: '' }
    })
    return changed ? { ...sound, files } : sound
}

/** Normalise one `files[]` entry. An absent fade field reads as 0. */
export const normalizeStoredFileEntry = (fileEntry) => {
    if (!fileEntry || typeof fileEntry !== 'object') {
        return { name: '', storedName: '', displayName: '', url: '', fadeIn: 0, fadeOut: 0, playUntil: 0 }
    }

    // PROVENANCE is copied, never invented.
    const storedName = fileEntry.storedName || ''
    const name = fileEntry.name || storedName || ''
    const displayName = fileEntry.displayName || fileEntry.originalName || name || ''
    const url = fileEntry.url || storedName || name || ''

    return {
        ...fileEntry,
        name,
        storedName,
        displayName,
        url,
        fadeIn: normalizeFadeSeconds(fileEntry.fadeIn),
        fadeOut: normalizeFadeSeconds(fileEntry.fadeOut),
        playUntil: normalizeFadeSeconds(fileEntry.playUntil),
    }
}

export const normalizeStoredFileList = (files = []) => {
    if (!Array.isArray(files)) return []
    return files.map(normalizeStoredFileEntry)
}

/**
 * The legacy single-file shape - `file: "Forest_Ambience.mp3"`, which is how
 * every shipped ENVIRONMENT sound is stored - as one file entry.
 *
 * The shipped environment sounds predate `files[]`, so the edit modal would
 * otherwise open them with no file rows at all, and no file rows means no
 * fades and no Play Until, because those are per-file controls. Synthesising
 * the entry the legacy shape implies makes a legacy sound editable exactly
 * like a modern one.
 *
 * It carries NO `storedName`: a bundled asset is not an upload, and a sound
 * that has been edited must not start claiming its bundled file is one.
 */
export const legacyFileEntry = (fileName) => {
    if (!fileName || typeof fileName !== 'string') return null
    return normalizeStoredFileEntry({ name: fileName, displayName: fileName, url: fileName })
}
