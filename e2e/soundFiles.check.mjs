// The per-file entry normaliser, and the PROVENANCE rule that goes with it.
//
// The rule is: `storedName` marks an UPLOAD (its bytes live in the uploads
// store, and a profile bundle has to carry them). An entry WITHOUT one is a
// BUNDLED asset (its bytes ship with the app, and resolve from /assets).
//
// It is worth a check of its own because the normaliser used to BREAK it: it
// copied `name` into `storedName`, so editing any sound with bundled files
// turned those bundled assets into fake uploads - and the bundle export then
// refused to export the profile. Nothing crashed; the bundle just stopped
// working for anyone who had touched a sound.

import {
    normalizeStoredFileEntry,
    normalizeStoredFileList,
    legacyFileEntry,
    normalizeIconDisplayName,
    repairBundledAudioReferences,
} from '../src/soundFiles.js'
import { readFileSync } from 'node:fs'
import { classifySoundReferences, exportBundle } from '../src/profileBundle.js'

let passed = 0
let failed = 0

const check = (name, cond) => {
    if (cond) {
        passed++
        console.log(`  ok   ${name}`)
    } else {
        failed++
        console.log(`  FAIL ${name}`)
    }
}

console.log('soundFiles: the per-file entry normaliser and its provenance rule\n')

// --- provenance ------------------------------------------------------------
const bundled = normalizeStoredFileEntry({ name: 'Forest_Ambience.mp3' })
check('a bundled entry (no storedName) does NOT gain one', bundled.storedName === '')
check('a bundled entry keeps its name', bundled.name === 'Forest_Ambience.mp3')
check('a bundled entry resolves to an /assets url', bundled.url === 'Forest_Ambience.mp3')

const upload = normalizeStoredFileEntry({ name: 'sound_file_abc.wav', storedName: 'sound_file_abc.wav', displayName: 'my sound.wav' })
check('an upload entry keeps its storedName', upload.storedName === 'sound_file_abc.wav')
check('an upload entry keeps its display name', upload.displayName === 'my sound.wav')
check('an upload entry resolves to its storedName', upload.url === 'sound_file_abc.wav')

const withUrl = normalizeStoredFileEntry({ name: 'X.mp3', storedName: 'sound_file_x.mp3', url: 'sound_file_x.mp3' })
check('an explicit url wins', withUrl.url === 'sound_file_x.mp3')

// --- the legacy single-file shape -----------------------------------------
const legacy = legacyFileEntry('Tavern_Music.mp3')
check('the legacy file shape becomes one entry', !!legacy && legacy.name === 'Tavern_Music.mp3')
check('the legacy entry carries NO storedName (bundled, not an upload)', legacy.storedName === '')
check('the legacy entry is not a storedName clone of its name', legacy.storedName !== legacy.name)
check('a missing legacy file name yields null', legacyFileEntry('') === null && legacyFileEntry(undefined) === null)

// --- fades ------------------------------------------------------------------
check('an absent fade reads as 0', bundled.fadeIn === 0 && bundled.fadeOut === 0 && bundled.playUntil === 0)
check('a negative fade reads as 0', normalizeStoredFileEntry({ name: 'a.mp3', fadeIn: -3 }).fadeIn === 0)
check('a fade survives normalisation', normalizeStoredFileEntry({ name: 'a.mp3', fadeIn: 2.5, fadeOut: 1 }).fadeIn === 2.5)
check('playUntil survives normalisation', normalizeStoredFileEntry({ name: 'a.mp3', playUntil: 12 }).playUntil === 12)

// --- list -------------------------------------------------------------------
check('a non-array list is empty', normalizeStoredFileList('nope').length === 0)
check('a list maps every entry', normalizeStoredFileList([{ name: 'a.mp3' }, { name: 'b.mp3' }]).length === 2)
check('no entry in a list gains a storedName', normalizeStoredFileList([{ name: 'a.mp3' }, { name: 'b.mp3' }]).every(f => f.storedName === ''))

// --- the shape that broke the bundle ---------------------------------------
// The exact payload a saved character sound carries after an edit: a bundled
// file with no provenance. It must stay a bundled asset.
const savedCharacterSound = normalizeStoredFileList([{ name: 'Divine_Smite_1.mp3', displayName: 'Divine_Smite_1.mp3', fadeIn: 1, fadeOut: 0, playUntil: 0 }])
check('an edited bundled sound is still a bundled asset', savedCharacterSound[0].storedName === '')
check('an edited bundled sound keeps its name', savedCharacterSound[0].name === 'Divine_Smite_1.mp3')

// A fade edit used to invent iconDisplayName for bundled icons. Repair only
// the exact invalid marker, using real shipped data rather than name patterns.
const defaults = JSON.parse(readFileSync(new URL('../src/data.json', import.meta.url), 'utf8'))
const shippedSounds = [...defaults.characters, ...defaults.environmentSounds].flatMap(c => c.sounds || [])
const icons = new Set(shippedSounds.map(s => s.icon).filter(Boolean))
const caustic = shippedSounds.find(s => s.icon === 'Caustic_Blast_Acid.png')
const forest = shippedSounds.find(s => s.icon === 'Forest.png')
const damaged = [caustic, forest].map(s => ({ ...s, iconDisplayName: s.icon }))
check('both reported bundled sounds reproduce the fake icon upload', damaged.every(s => classifySoundReferences(s).uploads.some(f => f.kind === 'icon')))
const audio = new Set(shippedSounds.flatMap(s => [s.file, ...(s.files || []).map(f => f.name)].filter(Boolean)))
const repaired = damaged.map(s => ({ ...s, iconDisplayName: normalizeIconDisplayName(s, icons) }))
check('known bundled icons lose the exact invalid upload marker', repaired.every(s => s.iconDisplayName === ''))
check('repair preserves all audio references', repaired.every((s, i) => s.files === damaged[i].files && s.file === damaged[i].file))
check('custom uploaded icons retain provenance', normalizeIconDisplayName({ icon: 'icon_123_Forest.png', iconDisplayName: 'Forest.png' }, icons) === 'Forest.png')
check('an unknown missing icon is not reclassified', normalizeIconDisplayName({ icon: 'missing.png', iconDisplayName: 'missing.png' }, icons) === 'missing.png')
check('a bundled icon without a marker stays bundled', normalizeIconDisplayName(forest, icons) === '')
const damagedAudio = { ...repaired[0], files: [{ name: 'Caustic_Blast_Acid_1.mp3', storedName: 'Caustic_Blast_Acid_1.mp3', fadeIn: 0.19, playUntil: 0.2 }] }
const repairedAudio = repairBundledAudioReferences(damagedAudio, audio)
check('historical false audio upload marker is repaired', repairedAudio.files[0].storedName === '')
check('audio repair preserves file identity and fades', repairedAudio.files[0].name === damagedAudio.files[0].name && repairedAudio.files[0].fadeIn === 0.19 && repairedAudio.files[0].playUntil === 0.2)
const realUpload = { files: [{ name: 'sound_123_Forest_Ambience.mp3', storedName: 'sound_123_Forest_Ambience.mp3', displayName: 'Forest_Ambience.mp3' }] }
check('a real upload with a bundled display name stays an upload', repairBundledAudioReferences(realUpload, audio) === realUpload)
const missingUpload = { files: [{ name: 'missing.mp3', storedName: 'missing.mp3' }] }
check('an unknown missing audio file stays an upload', repairBundledAudioReferences(missingUpload, audio) === missingUpload)
check('audio repair does not mutate the original profile data', damagedAudio.files[0].storedName === 'Caustic_Blast_Acid_1.mp3')
let exported = null
let reads = 0
try {
    exported = await exportBundle({
        profileId: 'regression', profileName: 'regression', appVersion: 'test', dataVersion: '3',
        data: { characters: [{ id: 'c', name: 'Reported sounds', sounds: [repairedAudio, repaired[1]] }], environmentSounds: [], groups: [] },
        settings: {}, store: { read: async () => { reads++; return null } },
    })
} catch (err) { console.log(`  export failed: ${err.message}`) }
check('both repaired sounds export without reading uploads or changing their icons', exported?.bytes instanceof Uint8Array && reads === 0 && repaired.every((s, i) => s.icon === damaged[i].icon))

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
