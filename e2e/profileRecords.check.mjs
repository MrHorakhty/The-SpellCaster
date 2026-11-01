import assert from 'node:assert/strict'
import { mergeProfileRecords } from '../src/profileMerge.js'
import { normalizeRecords, liveRecords, reconcileRecords, stableRecordJSON, mergeRecords, mintRecordId } from '../src/profileRecords.js'

let pass = 0, fail = 0, serial = 0
const options = { now: 100, mint: () => `new_${++serial}` }
function check(name, run) {
    try { run(); pass++; console.log(`PASS ${name}`) }
    catch (err) { fail++; console.error(`FAIL ${name}: ${err.stack}`) }
}
const legacy = [{ id: 'char_1', name: 'Mage', sounds: [{ id: 's_1', name: 'Fire', files: [{ storedName: 'fire.mp3' }] }] }]
const initial = () => normalizeRecords(legacy, 'characters')
check('legacy migration uses epoch, never migration time', () => assert.equal(initial()[0].sounds[0].updatedAt, 0))
check('legacy migration is deterministic across devices', () => assert.deepEqual(initial(), initial()))
check('migration is idempotent', () => assert.deepEqual(normalizeRecords(initial(), 'characters'), initial()))
check('identities are scoped by parent and collection', () => assert.notEqual(initial()[0].syncId, normalizeRecords(legacy, 'groups')[0].syncId))
check('migration leaves source unchanged', () => assert.equal(legacy[0].syncId, undefined))
check('timestamps reject non-finite/fractional/negative input', () => {
    for (const updatedAt of [NaN, Infinity, -1, 1.5, '5']) assert.equal(normalizeRecords([{ id: 'x', updatedAt }], 'x')[0].updatedAt, 0)
})
check('no-op setter preserves all timestamps', () => assert.deepEqual(reconcileRecords(initial(), liveRecords(initial()), options), initial()))
check('editing a sound stamps only the sound', () => {
    const next = liveRecords(initial()); next[0].sounds[0].name = 'Ice'
    const result = reconcileRecords(initial(), next, options)
    assert.equal(result[0].sounds[0].updatedAt, 100); assert.equal(result[0].updatedAt, 0)
})
check('container rename preserves sound identity and timestamp', () => {
    const next = liveRecords(initial()); next[0].name = 'Wizard'
    const result = reconcileRecords(initial(), next, options)
    assert.equal(result[0].updatedAt, 100); assert.deepEqual(result[0].sounds, initial()[0].sounds)
})
check('category rename preserves stable identity', () => {
    const previous = normalizeRecords([{ category: 'Rain', sounds: [] }], 'environment')
    const next = liveRecords(previous); next[0].category = 'Storm'
    assert.equal(reconcileRecords(previous, next, options)[0].syncId, previous[0].syncId)
})
check('deletion persists a timestamped marker', () => {
    const result = reconcileRecords(initial(), [], options)
    assert.equal(result[0].deletedAt, 100); assert.equal(result[0].syncId, initial()[0].syncId)
})
check('deleted containers retain no upload references', () => assert.equal(reconcileRecords(initial(), [], options)[0].sounds, undefined))
check('tombstones never appear in the live projection', () => assert.deepEqual(liveRecords(reconcileRecords(initial(), [], options)), []))
check('repeated saves retain tombstones unchanged', () => {
    const deleted = reconcileRecords(initial(), [], options)
    assert.deepEqual(reconcileRecords(deleted, [], { ...options, now: 200 }), deleted)
})
check('nested deletion removes blob fields from marker', () => {
    const next = liveRecords(initial()); next[0].sounds = []
    const result = reconcileRecords(initial(), next, options)
    assert.equal(result[0].sounds[0].files, undefined); assert.equal(result[0].sounds[0].deletedAt, 100)
})
check('nested tombstones stay out of live sound arrays', () => {
    const next = liveRecords(initial()); next[0].sounds = []
    assert.deepEqual(liveRecords(reconcileRecords(initial(), next, options))[0].sounds, [])
})
check('fresh records get fresh identity and current time', () => {
    const result = reconcileRecords([], legacy, options)
    assert.match(result[0].syncId, /^new_/); assert.equal(result[0].updatedAt, 100)
    assert.equal(result[0].sounds[0].updatedAt, 100)
})
check('copies cannot inherit source sync identity', () => {
    const next = liveRecords(initial()); next[0].sounds.push({ ...next[0].sounds[0], id: 'copy' })
    const result = reconcileRecords(initial(), next, options)
    assert.notEqual(result[0].sounds[0].syncId, result[0].sounds[1].syncId)
})
check('restore defaults creates a new identity after deletion', () => {
    const deleted = reconcileRecords(initial(), [], options)
    const result = reconcileRecords(deleted, legacy, { ...options, now: 200 })
    assert.equal(result.length, 2); assert.notEqual(result[0].syncId, result[1].syncId)
    assert.equal(liveRecords(result).length, 1)
})
check('backward clock still advances a modified record', () => {
    const previous = initial(); previous[0].updatedAt = 500
    const next = liveRecords(previous); next[0].name = 'Changed'
    assert.equal(reconcileRecords(previous, next, options)[0].updatedAt, 501)
})
check('normalization strips stale blob references from imported markers', () => {
    const previous = initial(); previous[0].deletedAt = 20
    assert.equal(normalizeRecords(previous, 'characters')[0].sounds, undefined)
})
check('canonical comparison ignores object property insertion order', () => assert.equal(stableRecordJSON({ b: 2, a: 1 }), stableRecordJSON({ a: 1, b: 2 })))
check('canonical comparison preserves array order', () => assert.notEqual(stableRecordJSON([1, 2]), stableRecordJSON([2, 1])))
check('group descendants get metadata and project recursively', () => {
    const group = normalizeRecords([{ id: 'g', categories: [{ category: 'C', sounds: legacy[0].sounds }], characters: legacy }], 'groups')
    const next = liveRecords(group); next[0].categories[0].sounds = []; next[0].characters = []
    const result = reconcileRecords(group, next, options)
    assert.equal(result[0].categories[0].sounds[0].deletedAt, 100)
    assert.equal(result[0].characters[0].deletedAt, 100)
    assert.deepEqual(liveRecords(result)[0].characters, [])
})
const edited = (name, updatedAt) => [{ ...initial()[0], name, updatedAt }]
check('merge chooses newer edits', () => assert.equal(mergeRecords(edited('old', 10), edited('new', 20))[0].name, 'new'))
check('merge is commutative for divergent equal-clock edits', () => assert.deepEqual(mergeRecords(edited('A', 10), edited('B', 10)), mergeRecords(edited('B', 10), edited('A', 10))))
check('merge is idempotent', () => assert.deepEqual(mergeRecords(initial(), initial()), initial()))
check('deletion prevents an older export resurrecting a container', () => {
    const deleted = reconcileRecords(initial(), [], options)
    assert.deepEqual(liveRecords(mergeRecords(initial(), deleted)), [])
})
check('deletion wins an equal-clock tie', () => {
    const deleted = reconcileRecords(initial(), [], options)
    assert.equal(mergeRecords(edited('edited', 100), deleted)[0].deletedAt, 100)
})
check('independent child edit survives a container rename', () => {
    const a = edited('Renamed', 200), b = initial(); b[0].sounds[0].name = 'Ice'; b[0].sounds[0].updatedAt = 100
    const result = mergeRecords(a, b)
    assert.equal(result[0].name, 'Renamed'); assert.equal(result[0].sounds[0].name, 'Ice')
})
check('deleted parent suppresses descendant edits', () => {
    const a = initial(); a[0].sounds[0].updatedAt = 900
    assert.equal(mergeRecords(a, reconcileRecords(initial(), [], options))[0].sounds, undefined)
})
check('duplicate sync identities are refused', () => assert.throws(() => mergeRecords([...initial(), ...initial()], []), /Duplicate/))
check('independent records with colliding UI ids both survive', () => {
    const a = initial(), b = initial(); b[0].syncId = 'different'; b[0].sounds[0].syncId = 'other-sound'
    const result = mergeProfileRecords({ characters: a }, { characters: b })
    assert.equal(result.characters.length, 2)
    assert.notEqual(result.characters[0].id, result.characters[1].id)
    assert.notEqual(result.characters[0].sounds[0].id, result.characters[1].sounds[0].id)
})
check('independent duplicate category names are disambiguated', () => {
    const result = mergeProfileRecords({ environmentSounds: [{ category: 'Rain', syncId: 'a' }] }, { environmentSounds: [{ category: 'Rain', syncId: 'b' }] })
    assert.deepEqual(result.environmentSounds.map(r => r.category), ['Rain', 'Rain (merged 2)'])
})
check('manual merge preserves local settings', () => {
    assert.deepEqual(mergeProfileRecords({ settings: { boxSize: 2 } }, { settings: { boxSize: 5 } }).settings, { boxSize: 2 })
})
check('merge does not mutate inputs', () => {
    const a = initial(), before = structuredClone(a)
    mergeProfileRecords({ characters: a }, { characters: edited('other', 200) })
    assert.deepEqual(a, before)
})
check('equal-clock parent conflict is associative across child unions', () => {
    const a = edited('A', 20), b = edited('B', 20), c = edited('C', 20)
    a[0].sounds = [{ syncId: 'z', id: 'z', updatedAt: 1, name: 'Z' }]
    b[0].sounds = [{ syncId: 'a', id: 'a', updatedAt: 1, name: 'A' }]
    c[0].sounds = [{ syncId: 'm', id: 'm', updatedAt: 1, name: 'M' }]
    assert.deepEqual(mergeRecords(mergeRecords(a, b), c), mergeRecords(a, mergeRecords(b, c)))
})
check('a later offline edit cannot revive a deleted identity', () => {
    const deleted = reconcileRecords(initial(), [], options)
    assert.equal(mergeRecords(deleted, edited('offline', 999))[0].deletedAt, 100)
})
check('deleted subtrees converge regardless of merge grouping', () => {
    const deleted = reconcileRecords(initial(), [], options), a = edited('before', 50), b = edited('offline', 999)
    assert.deepEqual(mergeRecords(mergeRecords(deleted, a), b), mergeRecords(deleted, mergeRecords(a, b)))
})
check('cross-container sync identity collisions are refused', () => {
    const a = initial(), b = initial(); b[0].syncId = 'second-parent'
    assert.throws(() => mergeProfileRecords({ characters: [...a, ...b] }, {}), /Duplicate/)
})
check('local hotkey follows its record when a colliding sound id is remapped', () => {
    const a = initial(), b = initial()
    a[0].syncId = 'z-parent'; a[0].sounds[0].syncId = 'z-sound'
    b[0].syncId = 'a-parent'; b[0].sounds[0].syncId = 'a-sound'
    const result = mergeProfileRecords({ characters: a, hotkeys: { version: 2, bindings: [{ target: { soundId: 's_1' } }] } }, { characters: b })
    const localSound = result.characters.find(r => r.syncId === 'z-parent').sounds[0]
    assert.notEqual(localSound.id, 's_1')
    assert.equal(result.hotkeys.bindings[0].target.soundId, localSound.id)
})
check('insecure LAN contexts mint identities with getRandomValues', () => {
    assert.equal(mintRecordId({ getRandomValues: bytes => bytes.fill(7) }), 'r_' + '07'.repeat(16))
})
check('hosts without Web Crypto can still create records', () => assert.match(mintRecordId(null), /^r_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/))
console.log(`profileRecords: ${pass}/${pass + fail} PASS, ${fail} FAIL`)
process.exitCode = fail ? 1 : 0
