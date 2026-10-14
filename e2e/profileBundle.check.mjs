// Quick node check for src/profileBundle.js - the bundle format, the provenance
// rule and both import modes. Not part of the E2E suite: it exercises the whole
// pipeline against a fake localStorage and a fake blob store, so a logic bug
// shows up in a second rather than after a 3-minute browser run.
//
// This is the check §12 step 4 asks for BEFORE either half is widened:
// "export a seeded profile, wipe, import, compare".
//
// Run: node e2e/profileBundle.check.mjs
import assert from 'node:assert/strict'

// Minimal localStorage stand-in (same shape as profileStorage.check.mjs).
function makeStore(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    _map: map,
    get length() { return map.size },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: k => { map.delete(k) },
    clear: () => map.clear(),
    snapshot: () => Object.fromEntries(map),
  }
}

globalThis.window = { localStorage: makeStore() }
const ls = globalThis.window.localStorage

const storage = await import('../src/profileStorage.js')
const bundle = await import('../src/profileBundle.js')

let pass = 0, fail = 0
const ok = (name, fn) => {
  const run = (() => { try { return Promise.resolve(fn()) } catch (e) { return Promise.reject(e) } })()
  return run.then(
    () => { pass++; console.log(`  PASS  ${name}`) },
    e => { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) },
  )
}
const okBad = async (name, fn, expectCode) => ok(name, async () => {
  let threw = null
  try { await fn() } catch (e) { threw = e }
  assert.ok(threw, 'expected a rejection, got none')
  assert.ok(threw instanceof bundle.BundleError, `expected a BundleError, got ${threw && threw.name}`)
  assert.equal(threw.code, expectCode)
})

console.log('\nprofileBundle check\n')

// ---------------------------------------------------------------------------
// A fake blob store. Bytes are deterministic so the hashes below are stable.
// ---------------------------------------------------------------------------
function makeBlobs() {
  const map = new Map()
  return {
    map,
    put(name, bytes) { map.set(name, new Uint8Array(bytes)) },
    store: {
      async read(name) { return map.get(name) || null },
      async write(name, bytes) { map.set(name, new Uint8Array(bytes)) },
      async list() { return [...map.keys()] },
    },
  }
}
const txt = s => new TextEncoder().encode(s)

// ---------------------------------------------------------------------------
// 1. Provenance (spec step 3) - structural, not a heuristic
// ---------------------------------------------------------------------------
await ok('a files[] entry WITHOUT storedName is a bundled asset', () =>
  assert.equal(bundle.isUploadedReference({ name: 'Caustic_Blast_Acid_1.mp3' }), false))

await ok('a files[] entry WITH storedName is an upload', () =>
  assert.equal(bundle.isUploadedReference({ name: 'x.mp3', storedName: 'sound_1_x.mp3' }), true))

await ok('a bundled icon (no iconDisplayName) is not an upload', () =>
  assert.equal(bundle.isUploadedIcon({ icon: 'Forest.png' }), false))

await ok('a custom icon (icon + iconDisplayName) IS an upload', () =>
  assert.equal(bundle.isUploadedIcon({ icon: 'icon_9f2_Tentacular.png', iconDisplayName: 'Tentacular.png' }), true))

await ok('classification agrees across the audio and icon paths', () => {
  const r = bundle.classifySoundReferences({
    id: 's', name: 'Both',
    files: [{ name: 'bundled.mp3' }, { storedName: 'sound_1_mine.mp3', displayName: 'mine.mp3' }],
    icon: 'icon_9f2_Tentacular.png', iconDisplayName: 'Tentacular.png',
  })
  assert.deepEqual(r.uploads.map(u => [u.kind, u.storedName]).sort(),
    [['audio', 'sound_1_mine.mp3'], ['icon', 'icon_9f2_Tentacular.png']])
  assert.equal(r.bundledCount, 1)   // one bundled file; the icon here IS an upload
})

await ok('the legacy single-file shape is walked but never claimed as an upload', () => {
  const r = bundle.classifySoundReferences({ id: 'e', name: 'Forest', file: 'Forest_Ambience.mp3' })
  assert.equal(r.uploads.length, 0)
  assert.equal(r.bundledCount, 1)
})

// ---------------------------------------------------------------------------
// 2. All FIVE container shapes are walked (spec §3 / §7 step 2)
// ---------------------------------------------------------------------------
const FIVE_SHAPES = {
  characters: [{ id: 'c1', name: 'Paladin', sounds: [{ id: 'x1', name: 'c1s' }] }],
  environmentSounds: [{ category: 'Forest', sounds: [{ id: 'x2', name: 'envs' }] }],
  groups: [{
    id: 'g1', name: 'Pack',
    categories: [{ category: 'Tavern', sounds: [{ id: 'x3', name: 'gcat' }] }],
    characters: [{ id: 'gc1', name: 'Npc', sounds: [{ id: 'x4', name: 'gchar' }] }],
    sounds: [{ id: 'x5', name: 'vestigial' }],
  }],
}
await ok('all five container shapes are found', () => {
  const found = bundle.walkSoundContainers(FIVE_SHAPES).flatMap(c => c.sounds.map(s => s.id)).sort()
  assert.deepEqual(found, ['x1', 'x2', 'x3', 'x4', 'x5'])
})

await ok('an environment category is keyed by its NAME, not an id', () => {
  const env = bundle.walkSoundContainers(FIVE_SHAPES).find(c => c.kind === 'environment')
  assert.equal(env.id, 'Forest')
})

// ---------------------------------------------------------------------------
// 3. The round trip (spec step 4)
// ---------------------------------------------------------------------------
ls.clear()
const A = storage.ensureProfileStore()
storage.renameProfile(A, 'Home Campaign')

const blobs = makeBlobs()
blobs.put('sound_aa_Fireball.mp3', txt('FIRED-BALL-BYTES'))
blobs.put('sound_bb_Thunder.mp3', txt('THUNDER-BYTES'))
blobs.put('icon_cc_Fireball.png', txt('ICON-BYTES'))

const EXPORT_DATA = {
  characters: [{
    id: 'c1', name: 'Human Paladin', sounds: [
      { id: 's1', name: 'Fireball', type: 'Fire', volume: 0.5, color: '#f97316', loop: false, files: [{ name: 'sound_aa_Fireball.mp3', storedName: 'sound_aa_Fireball.mp3', displayName: 'Fireball.mp3', url: 'sound_aa_Fireball.mp3' }], icon: 'icon_cc_Fireball.png', iconDisplayName: 'Fireball.png' },
      // A sound with no `storedName`: resolves from /assets and must NOT enter the bundle.
      { id: 's2', name: 'Shipped Bow', files: [{ name: 'Longbow_4.mp3' }], icon: 'Bow.png' },
      // volume 0 is a legitimate level, not "absent".
      { id: 's3', name: 'Muted', volume: 0, files: [{ name: 'sound_bb_Thunder.mp3', storedName: 'sound_bb_Thunder.mp3', displayName: 'Thunder.mp3' }] },
      // move/copy: a copy shares the source's storedName, so these two are ONE blob.
      { id: 's4', name: 'Fireball (copy)', files: [{ name: 'sound_aa_Fireball.mp3', storedName: 'sound_aa_Fireball.mp3', displayName: 'Fireball.mp3' }] },
    ],
  }],
  environmentSounds: [{ category: 'Forest', sounds: [{ id: 's5', name: 'Rustle', files: [{ name: 'Forest_Ambience.mp3' }] }] }],
  groups: [],
}

const EXPORT_SETTINGS = {
  boxSize: 1.5,
  // A 5 MB image the user picked must never ride along in the bundle.
  background: { type: 'image', theme: 'Forest', color: '#0d350c', imagePreview: 'data:image/png;base64,' + 'A'.repeat(4096), imageFile: null },
  sectionIcons: { characters: 'Shield', environment: 'Music' },
}

const normalize = (key, list) => (Array.isArray(list) ? list : [])

let exported = null
await ok('exportBundle returns a Uint8Array (the §11 risk 8 contract)', async () => {
  exported = await bundle.exportBundle({
    profileId: A, profileName: 'Home Campaign',
    data: EXPORT_DATA, settings: EXPORT_SETTINGS,
    store: blobs.store, appVersion: '0.1.3', dataVersion: '3',
  })
  assert.ok(exported.bytes instanceof Uint8Array, 'bytes must be a Uint8Array')
})

await ok('the bundle is a PLAIN zip - PK magic, openable by any zip tool', () => {
  assert.equal(exported.bytes[0], 0x50)   // 'P'
  assert.equal(exported.bytes[1], 0x4b)   // 'K'
})

await ok('the manifest lists ONLY uploads - bundled assets never enter a bundle', () => {
  const names = exported.manifest.files.map(f => f.originalName).sort()
  assert.deepEqual(names, ['Fireball.mp3', 'Fireball.png', 'Thunder.mp3'])
  assert.ok(!names.includes('Longbow_4.mp3'), 'a bundled asset leaked into the bundle')
  assert.ok(!names.includes('Bow.png'), 'a bundled icon leaked into the bundle')
})

await ok('a copied sound is ONE blob, not two (dedupe by hash, spec §5)', () => {
  const audio = exported.manifest.files.filter(f => f.kind === 'audio')
  assert.equal(audio.length, 2, `expected 2 audio blobs, got ${audio.length}`)
})

await ok('the bundle stays small - no 5 MB background image rides along', () => {
  assert.ok(exported.bytes.length < 4096, `bundle was ${exported.bytes.length} bytes`)
})

await ok('data.json carries no imagePreview and no background image entry', () => {
  assert.equal(exported.data.settings.background.imagePreview, undefined)
  assert.equal(exported.data.settings.background.type, 'color')
})

await ok('volume rides along verbatim, including the legitimate 0', () => {
  const sounds = exported.data.characters[0].sounds
  assert.equal(sounds.find(s => s.id === 's1').volume, 0.5)
  assert.equal(sounds.find(s => s.id === 's3').volume, 0)
})

await ok('section icons are carried (spec §5.2 did not list them; §4.2 requires them)', () => {
  assert.equal(exported.data.settings.sectionIcons.characters, 'Shield')
})

// ---- wipe and import -------------------------------------------------------
// A fresh profile, empty, to import into. The OLD profile stays in storage -
// that is what proves "New profile leaves the active profile untouched".
const B = storage.createProfile('Scratch Board')
ls.setItem(`profile:${B}:ttrpg_characters`, JSON.stringify([{ id: 'zz', name: 'Do Not Touch', sounds: [] }]))

storage.writeProfileValue(A, 'ttrpg_characters', JSON.stringify(EXPORT_DATA.characters))
storage.writeProfileValue(A, 'ttrpg_environment', JSON.stringify(EXPORT_DATA.environmentSounds))
storage.writeProfileValue(A, 'ttrpg_groups', JSON.stringify([]))

let imported = null
await ok('importBundle installs into a NEW profile', async () => {
  imported = await bundle.importBundle(exported.bytes, {
    mode: 'new', normalize, dataVersion: '3', store: blobs.store,
  })
  assert.equal(imported.mode, 'new')
  assert.notEqual(imported.profileId, A)
})

await ok('the previous profile is untouched by a "new profile" import', () => {
  assert.equal(ls.getItem(`profile:${B}:ttrpg_characters`), JSON.stringify([{ id: 'zz', name: 'Do Not Touch', sounds: [] }]))
  assert.equal(ls.getItem(`profile:${A}:ttrpg_characters`), JSON.stringify(EXPORT_DATA.characters))
})

await ok('every uploaded blob round-tripped, byte-identical', async () => {
  const names = [...blobs.map.keys()]
  for (const n of names) assert.ok(blobs.map.get(n), `missing blob ${n}`)
})

await ok('the imported board deep-compares to the exported one', () => {
  const got = JSON.parse(ls.getItem(`profile:${imported.profileId}:ttrpg_characters`))
  const want = JSON.parse(JSON.stringify(exported.data.characters))
  // storedNames are content-addressed on import, so compare identity-independent.
  const strip = list => list.map(c => ({
    ...c,
    sounds: c.sounds.map(s => ({ ...s, files: s.files.map(f => ({ ...f, name: f.displayName, storedName: f.displayName })) })),
  }))
  assert.deepEqual(strip(got), strip(want))
})

await ok('boxSize, background and section icons all follow the profile', () => {
  assert.equal(ls.getItem(`profile:${imported.profileId}:boxSize`), '1.5')
  const bg = JSON.parse(ls.getItem(`profile:${imported.profileId}:backgroundSettings`))
  assert.equal(bg.theme, 'Forest')
  assert.equal(bg.imagePreview, '', 'the custom background image must NOT have been imported')
  assert.equal(ls.getItem(`profile:${imported.profileId}:ttrpg_characters_icon`), 'Shield')
  assert.equal(ls.getItem(`profile:${imported.profileId}:ttrpg_environment_icon`), 'Music')
})

await ok('environment categories round-tripped', () => {
  const env = JSON.parse(ls.getItem(`profile:${imported.profileId}:ttrpg_environment`))
  assert.equal(env[0].category, 'Forest')
  assert.equal(env[0].sounds[0].name, 'Rustle')
})

await ok('the data version stamp is written so the first read does not fake a backup', () => {
  assert.equal(ls.getItem(`profile:${imported.profileId}:ttrpg_data_version`), '3')
  assert.equal(ls.getItem(`profile:${imported.profileId}:ttrpg_characters_old`), null)
})

// ---------------------------------------------------------------------------
// 4. Refusals (spec §8 steps 2-3, and §13)
// ---------------------------------------------------------------------------
await ok('a corrupt payload is refused on checksum, naming the file', async () => {
  const { unzipSync } = await import('fflate')
  const entries = unzipSync(exported.bytes)
  const target = Object.keys(entries).find(k => k.startsWith('audio/'))
  const tampered = new Uint8Array(entries[target])
  tampered[0] ^= 0xff
  const rebuilt = await bundle.zipEntries(
    Object.keys(entries).map(k => ({
      name: k,
      data: k === target ? tampered : entries[k],
    }))
  )
  let code = null, message = null
  try { bundle.parseBundle(rebuilt) } catch (e) { code = e.code; message = e.message }
  assert.equal(code, 'corrupt-payload')
  assert.match(message, /corrupt \(checksum mismatch\)/, 'the message must name the failure')
  assert.match(message, /Nothing was imported/)
})

await ok('a newer formatVersion is refused, naming BOTH versions', async () => {
  const { unzipSync } = await import('fflate')
  const entries = unzipSync(exported.bytes)
  const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
  manifest.formatVersion = bundle.BUNDLE_FORMAT_VERSION + 1
  const rebuilt = await bundle.zipEntries([
    { name: 'manifest.json', data: txt(JSON.stringify(manifest)) },
    { name: 'data.json', data: entries['data.json'] },
  ])
  let code = null, message = null
  try { bundle.parseBundle(rebuilt) } catch (e) { code = e.code; message = e.message }
  assert.equal(code, 'too-new')
  assert.match(message, new RegExp(`bundle format ${bundle.BUNDLE_FORMAT_VERSION + 1}`))
  assert.match(message, new RegExp(`up to format ${bundle.BUNDLE_FORMAT_VERSION}`))
})

await okBad('a file that is not a zip is refused cleanly', async () =>
  bundle.parseBundle(new Uint8Array(txt('this is not a zip at all'))), 'not-a-bundle')

await ok('a refused bundle writes NOTHING (no half-built profile)', async () => {
  const before = JSON.stringify(ls.snapshot())
  try { bundle.parseBundle(new Uint8Array(txt('nope'))) } catch { /* expected */ }
  assert.equal(JSON.stringify(ls.snapshot()), before)
})

// ---------------------------------------------------------------------------
// 5. Unresolvable audio: keep the container, drop the sound, report it
// ---------------------------------------------------------------------------
await ok('a sound the bundle cannot resolve is DROPPED but its container is kept', async () => {
  const { unzipSync } = await import('fflate')
  const entries = unzipSync(exported.bytes)
  const data = JSON.parse(new TextDecoder().decode(entries['data.json']))
  data.characters[0].sounds.push({
    id: 'ghost', name: 'From The Future',
    files: [{ name: 'deadbeef.mp3', storedName: 'deadbeef.mp3', displayName: 'future.mp3' }],
  })
  // Every OTHER entry travels unchanged - a bundle that dropped its payloads
  // would be refused earlier, for a different and also correct reason.
  const rebuilt = await bundle.zipEntries(
    Object.keys(entries).map(k => ({
      name: k,
      data: k === 'data.json' ? txt(JSON.stringify(data)) : entries[k],
    }))
  )

  const report = await bundle.importBundle(rebuilt, { mode: 'new', normalize, dataVersion: '3', store: blobs.store })
  assert.equal(report.dropped.length, 1, `expected exactly 1 dropped sound, got ${JSON.stringify(report.dropped)}`)
  assert.equal(report.dropped[0].name, 'From The Future')

  const got = JSON.parse(ls.getItem(`profile:${report.profileId}:ttrpg_characters`))
  assert.ok(got[0], 'the character must survive')
  assert.ok(!got[0].sounds.some(s => s.id === 'ghost'), 'the unresolvable sound must not be installed')
  assert.ok(got[0].sounds.some(s => s.id === 's1'), 'the resolvable sounds must all still be there')
})

// ---------------------------------------------------------------------------
// 6. "Replace active" - the risky mode, and the snapshot that makes it safe
// ---------------------------------------------------------------------------
await ok('"replace active" installs into the LIVE profile and snapshots it first', async () => {
  const live = storage.createProfile('Live Board')
  storage.setActiveProfile(live)
  storage.writeProfileValue(live, 'ttrpg_characters', JSON.stringify([{ id: 'old', name: 'Previous Board', sounds: [] }]))
  storage.writeProfileValue(live, 'ttrpg_characters_icon', 'Skull')

  const report = await bundle.importBundle(exported.bytes, {
    mode: 'replace', targetProfileId: live, normalize, dataVersion: '3', store: blobs.store,
  })
  assert.equal(report.profileId, live)
  assert.equal(report.mode, 'replace')

  const got = JSON.parse(ls.getItem(`profile:${live}:ttrpg_characters`))
  assert.equal(got[0].name, 'Human Paladin', 'the bundle board must now be installed')
})

await ok('the replaced profile is RECOVERABLE - a snapshot holds its old board', () => {
  const backups = JSON.parse(ls.getItem('spellcaster_import_backups'))
  assert.ok(Array.isArray(backups) && backups.length > 0, 'no snapshot was taken')
  const snap = backups[backups.length - 1]
  assert.equal(snap.keys.ttrpg_characters, JSON.stringify([{ id: 'old', name: 'Previous Board', sounds: [] }]))
  assert.equal(snap.keys.ttrpg_characters_icon, 'Skull')
})

await ok('restoring the snapshot brings the old board back byte-for-byte', () => {
  const backups = JSON.parse(ls.getItem('spellcaster_import_backups'))
  const snap = backups[backups.length - 1]
  assert.equal(bundle.restoreProfileSnapshot(snap), true)
  assert.equal(ls.getItem(`profile:${snap.profileId}:ttrpg_characters`), JSON.stringify([{ id: 'old', name: 'Previous Board', sounds: [] }]))
  assert.equal(ls.getItem(`profile:${snap.profileId}:ttrpg_characters_icon`), 'Skull')
})

await ok('a failed blob write aborts BEFORE any key is touched', async () => {
  const live = storage.createProfile('Atomic Board')
  storage.setActiveProfile(live)
  storage.writeProfileValue(live, 'ttrpg_characters', JSON.stringify([{ id: 'keep', name: 'Untouched', sounds: [] }]))

  const angryStore = {
    async read(n) { return blobs.map.get(n) || null },
    // Make every write fail, as a full disk would.
    async write() { throw new Error('disk is full') },
    async list() { return [] },
  }
  // Every blob write fails, as a full disk would.
  const realError = console.error
  const quiet = []
  console.error = (...a) => quiet.push(a.map(String).join(' '))
  let code = null
  try {
    await bundle.importBundle(exported.bytes, { mode: 'replace', targetProfileId: live, normalize, dataVersion: '3', store: angryStore })
  } catch (e) { code = e.code }
  console.error = realError

  assert.equal(code, 'write-failed')
  assert.ok(quiet.length > 0, 'the failure should have been logged, not swallowed')
  assert.equal(ls.getItem(`profile:${live}:ttrpg_characters`), JSON.stringify([{ id: 'keep', name: 'Untouched', sounds: [] }]),
    'the live profile must be exactly as it was')
})

await ok('a bundle whose audio is unreadable refuses to export rather than shipping a hole', async () => {
  const emptyStore = { async read() { return null }, async write() {}, async list() { return [] } }
  await okBad('exportBundle', () => bundle.exportBundle({
    profileId: A, profileName: 'Home Campaign',
    data: EXPORT_DATA, settings: EXPORT_SETTINGS,
    store: emptyStore, appVersion: '0.1.3', dataVersion: '3',
  }), 'missing-blobs')
})

// ---------------------------------------------------------------------------
// 7. The bytes contract (§7 / §11 risk 8)
// ---------------------------------------------------------------------------
await ok('assertUint8Array rejects a plain Array (which desktop silently corrupts)', () => {
  assert.throws(() => bundle.assertUint8Array([1, 2, 3]), /Uint8Array/)
  assert.ok(bundle.assertUint8Array(new Uint8Array([1, 2, 3])) instanceof Uint8Array)
})

await ok('bundleFileName is filesystem-safe on every platform', () => {
  const name = bundle.bundleFileName('Home Campaign / Fire & Ice!', new Date(2026, 9, 13, 16, 5))
  assert.match(name, /^home-campaign-fire-ice-20261013-1605\.spellcaster$/)
})

console.log(`\n${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exitCode = 1