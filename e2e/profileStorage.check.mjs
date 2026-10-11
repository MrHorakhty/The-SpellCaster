// Quick node sanity check for src/profileStorage.js. Not part of the E2E suite -
// it exercises the migration/switch logic against a fake localStorage so a logic
// bug shows up in a second rather than after a 3-minute browser run.
// Run: node e2e/profileStorage.check.mjs
import assert from 'node:assert/strict'

// Minimal localStorage stand-in.
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

const m = await import('../src/profileStorage.js')

let pass = 0
const pending = [];
const ok = (name, fn) => {
  // Async-aware: a rejected promise must FAIL the check, not slip out as an
  // unhandled rejection while the summary says everything passed.
  const run = (() => { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } })();
  pending.push(run.then(
    () => { pass++; console.log(`  PASS  ${name}`) },
    e => { console.log(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1 },
  ));
}

console.log('\nprofileStorage check\n')

// ---- first run adopts legacy keys -----------------------------------------
ls.clear()
ls.setItem('ttrpg_characters', JSON.stringify([{ id: 'c1', name: 'Legacy Paladin', sounds: [] }]))
ls.setItem('ttrpg_groups', JSON.stringify([{ id: 'g1', name: 'Legacy Pack', categories: [] }]))
ls.setItem('boxSize', '1.5')
ls.setItem('backgroundSettings', JSON.stringify({ theme: 'Forest' }))
ls.setItem('ttrpg_characters_icon', 'Shield')
ls.setItem('sound_file_abc.mp3', 'data:audio/mp3;base64,AAAA')
ls.setItem('localStorageMigrationCompleted', 'true')

const id = m.ensureProfileStore()
ok('first run creates a profile id', () => assert.match(id, /^p_[0-9a-z]+$/))
ok('legacy characters adopted into the profile', () =>
  assert.equal(ls.getItem(`profile:${id}:ttrpg_characters`), JSON.stringify([{ id: 'c1', name: 'Legacy Paladin', sounds: [] }])))
ok('legacy key removed from the global namespace', () => assert.equal(ls.getItem('ttrpg_characters'), null))
ok('legacy audio adopted', () => assert.equal(ls.getItem(`profile:${id}:sound_file_abc.mp3`), 'data:audio/mp3;base64,AAAA'))
ok('localStorageMigrationCompleted stays GLOBAL', () => assert.equal(ls.getItem('localStorageMigrationCompleted'), 'true'))
ok('boxSize / icons / background adopted', () => {
  assert.equal(ls.getItem(`profile:${id}:boxSize`), '1.5')
  assert.equal(ls.getItem(`profile:${id}:ttrpg_characters_icon`), 'Shield')
  assert.equal(ls.getItem(`profile:${id}:backgroundSettings`), JSON.stringify({ theme: 'Forest' }))
})

// ---- second call is idempotent ---------------------------------------------
const before = JSON.stringify(ls.snapshot())
m.ensureProfileStore()
ok('ensureProfileStore is idempotent', () => assert.equal(JSON.stringify(ls.snapshot()), before))

// ---- profile isolation -----------------------------------------------------
const bId = m.createProfile('Second Board')
ok('second profile created', () => assert.notEqual(bId, id))
ok('new profile starts empty', () => assert.equal(ls.getItem(`profile:${bId}:ttrpg_characters`), null))
m.writeProfileValue(bId, 'ttrpg_characters', JSON.stringify([{ id: 'b1', name: 'B Hero', sounds: [] }]))
ok('profile A is untouched by a write to B', () =>
  assert.equal(ls.getItem(`profile:${id}:ttrpg_characters`), JSON.stringify([{ id: 'c1', name: 'Legacy Paladin', sounds: [] }])))

// ---- version skew MIGRATES, never resets ------------------------------------
const normalize = (key, list) => (Array.isArray(list) ? list : [])
ls.setItem(`profile:${id}:ttrpg_data_version`, '1')
const repaired = m.readProfileData(id, 'ttrpg_characters', [], normalize, '3')
ok('a version mismatch keeps the board (migrates, does not reset)', () =>
  assert.equal(repaired.length, 1))
ok('the migrated board is the user\'s, not the fallback', () =>
  assert.equal(repaired[0].name, 'Legacy Paladin'))
ok('version recorded at the current value', () => assert.equal(ls.getItem(`profile:${id}:ttrpg_data_version`), '3'))
ok('a missing version snapshots the old value once', () => {
  ls.removeItem(`profile:${id}:ttrpg_data_version`)
  m.readProfileData(id, 'ttrpg_groups', [], normalize, '3')
  assert.ok(ls.getItem(`profile:${id}:ttrpg_groups_old`), 'expected a _old snapshot')
})

// ---- unparseable is the one case that falls back ---------------------------
ls.setItem(`profile:${bId}:ttrpg_characters`, '{not json')
ok('unparseable data falls back to defaults and is kept for inspection', () => {
  const out = m.readProfileData(bId, 'ttrpg_characters', [{ id: 'fb' }], normalize, '3')
  assert.deepEqual(out, [{ id: 'fb' }])
  assert.ok(ls.getItem(`profile:${bId}:ttrpg_characters_old`), 'expected the bad value kept')
})

// ---- deletion is scoped, and refuses the last profile ----------------------
m.setActiveProfile(bId)
let notified = null
const off = m.subscribeProfileSwitch(x => { notified = x })
const cId = m.createProfile('Third')
m.setActiveProfile(cId)
ok('switching notifies subscribers', () => assert.equal(notified, cId))
ok('switching points the index at the new profile', () => assert.equal(m.getActiveProfileId(), cId))

m.setActiveProfile(id)
const fallback = m.deleteProfile(bId)
ok('deleting a profile returns the fallback', () => assert.equal(fallback, id))
ok('deleted profile keys are gone', () => assert.equal(ls.getItem(`profile:${bId}:ttrpg_characters`), null))
ok('deleting a profile leaves the others alone', () =>
  assert.equal(ls.getItem(`profile:${id}:ttrpg_characters`), JSON.stringify([{ id: 'c1', name: 'Legacy Paladin', sounds: [] }])))
ok('the last profile cannot be deleted', () => {
  m.deleteProfile(cId)
  assert.equal(m.readProfileIndex().profiles.length, 1)
  assert.equal(m.deleteProfile(id), null, 'deleting the final profile must be refused')
  assert.equal(m.readProfileIndex().profiles.length, 1, 'and it must still be there')
})
off()

// ---- upload paths ----------------------------------------------------------
ok('upload path is per profile', () => {
  assert.equal(m.profileUploadPath('p_abc', 'x.mp3'), 'uploads/p_abc/x.mp3')
  assert.equal(m.profileUploadPath(null, 'x.mp3'), 'uploads/x.mp3')
})

// ---- the uploads migration plan -------------------------------------------
// This is the piece that preserves a real user's existing audio, so the path
// arithmetic gets tested directly. Web cannot cover it (web audio lives in
// localStorage) and it only runs on Tauri, so without this the Windows/Android
// gates are the ONLY thing standing between it and someone's sound files.
ok('migration moves every FILE flat in uploads/', () => {
  const plan = m.planUploadMigration(
    [{ name: 'sound_1.mp3', isDirectory: false }, { name: 'icon_2.png', isDirectory: false }],
    'p_xyz');
  assert.deepEqual(plan.map(p => p.from), ['uploads/sound_1.mp3', 'uploads/icon_2.png']);
  assert.deepEqual(plan.map(p => p.to), ['uploads/p_xyz/sound_1.mp3', 'uploads/p_xyz/icon_2.png']);
});

ok('migration SKIPS directories (renaming one would nest a subtree)', () => {
  const plan = m.planUploadMigration(
    [{ name: 'p_other', isDirectory: true }, { name: 'x.mp3', isDirectory: false }],
    'p_xyz');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].name, 'x.mp3');
});

ok('migration over an already-migrated dir is an empty plan (idempotent by structure)', () => {
  assert.deepEqual(m.planUploadMigration([{ name: 'p_xyz', isDirectory: true }], 'p_xyz'), []);
  assert.deepEqual(m.planUploadMigration([], 'p_xyz'), []);
  assert.deepEqual(m.planUploadMigration(undefined, 'p_xyz'), []);
});

ok('migration runs before any file lookup, and is a no-op off Tauri', async () => {
  // Not a Tauri build (no __TAURI_INTERNALS__), so it must resolve without
  // touching fs rather than throwing.
  assert.deepEqual(await m.migrateUploadsToProfile('p_xyz'), { moved: 0, skipped: 0, failed: 0 });
});

await Promise.all(pending);
console.log(`\n${pass} passed${process.exitCode ? ', with failures' : ''}\n`)