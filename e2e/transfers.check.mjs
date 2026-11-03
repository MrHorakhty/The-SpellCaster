import assert from 'node:assert/strict'
import { applyTransfer, transferContainers, transferSections, transferSource } from '../src/transfers.js'
import { normalizeRecords, liveRecords, reconcileRecords } from '../src/profileRecords.js'
import { mergeProfileRecords } from '../src/profileMerge.js'

let pass = 0, fail = 0, serial = 0
const mint = kind => `${kind}_test_${++serial}`
function check(name, run) { try { run(); pass++; console.log(`PASS ${name}`) } catch (error) { fail++; console.error(`FAIL ${name}: ${error.stack}`) } }
const sound = id => ({ id, name: 'Bow', icon: 'shared.png', files: [{ name: 'bow.wav', storedName: 'shared.wav', fadeIn: 2 }], volume: 0.3, loop: true })
const fixture = () => ({
    characters: [{ id: 'c1', name: 'Mage', icon: '🧙', sounds: [sound('a')] }],
    environmentSounds: [{ category: 'Rain', icon: '☔', sounds: [sound('b')] }],
    groups: [{ id: 'g1', name: 'Weather', mode: 'environment', categories: [{ category: 'Cloud', sounds: [sound('c')] }], characters: [], sounds: [] },
        { id: 'g2', name: 'Party', mode: 'characters', characters: [{ id: 'gc', name: 'Rogue', sounds: [sound('d')] }], categories: [], sounds: [] },
        { id: 'g3', name: 'Legacy', mode: 'environment', sounds: [sound('e')], categories: [], characters: [] }],
})
const refs = [
    { containerType: 'character', containerId: 'c1', groupId: null },
    { containerType: 'environment', containerId: 'Rain', groupId: null },
    { containerType: 'group', containerId: 'Cloud', groupId: 'g1' },
    { containerType: 'groupCharacter', containerId: 'gc', groupId: 'g2' },
    { containerType: 'groupTop', containerId: 'g3', groupId: 'g3' },
]
const allSounds = board => transferContainers(board).flatMap(c => c.sounds)
const find = (board, ref) => transferContainers(board).find(c => c.ref.containerType === ref.containerType && c.ref.containerId === ref.containerId && c.ref.groupId === ref.groupId)
for (const [i, source] of refs.entries()) for (const [j, target] of refs.entries()) {
    check(`copy shape ${source.containerType} → ${target.containerType} shares bytes, mints identity and keeps source`, () => {
        const board = fixture(), before = structuredClone(board), original = find(board, source).sounds[0]
        const result = applyTransfer(board, { source, target, soundId: original.id, scope: 'sound', mode: 'copy' }, { mint })
        assert.deepEqual(board, before)
        assert.equal(allSounds(result.board).length, 6)
        assert.equal(find(result.board, source).sounds.some(s => s.id === original.id), true)
        const copy = find(result.board, target).sounds.at(-1)
        assert.notEqual(copy.id, original.id); assert.equal(copy.name, 'Bow (copy)')
        assert.deepEqual(copy.files, original.files); assert.equal(copy.icon, original.icon)
        assert.equal(copy.volume, 0.3); assert.equal(copy.loop, true)
    })
    if (i !== j) check(`move shape ${source.containerType} → ${target.containerType} preserves sound and source wrapper`, () => {
        const board = fixture(), original = find(board, source).sounds[0]
        const result = applyTransfer(board, { source, target, soundId: original.id, scope: 'sound', mode: 'move' }, { mint })
        assert.equal(allSounds(result.board).length, 5)
        const remaining = source.containerType === 'groupTop'
            ? result.board.groups.find(g => g.id === source.groupId) : find(result.board, source)
        assert.equal(remaining.sounds.length, 0)
        assert.deepEqual(find(result.board, target).sounds.at(-1), original)
        assert.equal(find(board, source).sounds.length, 1)
    })
}
check('bulk copies retain order and choose sequential unique names', () => {
    const board = fixture(); board.characters[0].sounds.push(sound('a2'))
    const result = applyTransfer(board, { source: refs[0], target: refs[1], scope: 'sounds', mode: 'copy' }, { mint })
    assert.deepEqual(result.board.environmentSounds[0].sounds.map(s => s.name), ['Bow', 'Bow (copy)', 'Bow (copy 2)'])
    assert.equal(new Set(allSounds(result.board).map(s => s.id)).size, 8)
})
check('bulk move empties source without deleting its name or icon', () => {
    const result = applyTransfer(fixture(), { source: refs[0], target: refs[1], scope: 'sounds', mode: 'move' }, { mint })
    assert.deepEqual(result.board.characters[0], { id: 'c1', name: 'Mage', icon: '🧙', sounds: [] })
})
check('copies have independent file settings while retaining shared stored bytes', () => {
    const result = applyTransfer(fixture(), { source: refs[0], target: refs[1], scope: 'sound', soundId: 'a', mode: 'copy' }, { mint })
    const original = result.board.characters[0].sounds[0], copy = result.board.environmentSounds[0].sounds.at(-1)
    copy.files[0].fadeIn = 9
    assert.equal(original.files[0].fadeIn, 2)
    assert.equal(copy.files[0].storedName, original.files[0].storedName)
})
check('whole-group bulk actions walk categories, characters and legacy sounds', () => {
    const board = fixture(); board.groups[0].characters = [{ id: 'mixed', name: 'Hidden', sounds: [sound('mixed')] }]; board.groups[0].sounds = [sound('legacy')]
    const source = { containerType: 'groupRoot', containerId: 'g1', groupId: 'g1' }
    assert.equal(transferSource(board, source).count, 3)
    const result = applyTransfer(board, { source, target: refs[0], scope: 'sounds', mode: 'move' }, { mint })
    assert.equal(result.count, 3); assert.equal(result.board.characters[0].sounds.length, 4)
    assert.equal(transferSource(result.board, source).count, 0)
    assert.equal(result.board.groups[0].categories.length, 1)
})
for (const [source, target] of [[refs[0], { containerType: 'groupCharacterList', groupId: 'g2' }],
    [refs[3], { containerType: 'characterList', groupId: null }],
    [refs[1], { containerType: 'groupCategoryList', groupId: 'g1' }],
    [refs[2], { containerType: 'environmentList', groupId: null }]]) {
    for (const mode of ['move', 'copy']) check(`whole ${source.containerType} ${mode} keeps icon/settings and has valid merge history`, () => {
        const scopes = { characters: 'ttrpg_characters', environmentSounds: 'ttrpg_environment', groups: 'ttrpg_groups' }
        const raw = Object.fromEntries(Object.entries(scopes).map(([key, scope]) => [key, normalizeRecords(fixture()[key], scope)]))
        const board = Object.fromEntries(Object.entries(raw).map(([key, records]) => [key, liveRecords(records)]))
        const old = find(board, source).sounds[0]
        const result = applyTransfer(board, { source, target, scope: 'container', mode }, { mint })
        const persisted = Object.fromEntries(Object.entries(raw).map(([key, records]) => [key, reconcileRecords(records, result.board[key], { now: 100 })]))
        const merged = mergeProfileRecords(persisted, raw)
        const visible = Object.fromEntries(Object.entries(scopes).map(([key]) => [key, liveRecords(merged[key])]))
        if (mode === 'move') {
            assert.equal(allSounds(visible).filter(s => s.id === old.id).length, 1)
            assert.equal(allSounds(result.board).length, 5)
        } else {
            assert.equal(allSounds(result.board).length, 6)
            assert.equal(new Set(allSounds(result.board).map(s => s.id)).size, 6)
        }
        const destination = target.containerType === 'characterList' ? result.board.characters
            : target.containerType === 'environmentList' ? result.board.environmentSounds
                : result.board.groups.find(g => g.id === target.groupId)[target.containerType === 'groupCharacterList' ? 'characters' : 'categories']
        const moved = destination.at(-1).sounds[0]
        assert.equal(moved.volume, old.volume); assert.equal(moved.loop, old.loop)
        assert.deepEqual(moved.files, old.files); assert.equal(moved.icon, old.icon)
        assert.equal(mode === 'move' ? moved.id === old.id : moved.id !== old.id, true)
    })
}
check('category collision gets a unique moved name without overwriting', () => {
    const board = fixture(); board.environmentSounds.push({ category: 'Cloud', sounds: [] })
    const result = applyTransfer(board, { source: refs[2], target: { containerType: 'environmentList', groupId: null }, scope: 'container', mode: 'move' }, { mint })
    assert.deepEqual(result.board.environmentSounds.map(c => c.category), ['Rain', 'Cloud', 'Cloud (moved)'])
})
check('wrapper move resolves a destination UI-id collision while preserving sound identities', () => {
    const board = fixture(); board.groups[1].characters[0].id = 'c1'
    const result = applyTransfer(board, { source: refs[0], target: { containerType: 'groupCharacterList', groupId: 'g2' }, scope: 'container', mode: 'move' }, { mint })
    const destination = result.board.groups[1].characters
    assert.equal(new Set(destination.map(c => c.id)).size, 2)
    assert.equal(destination[0].name, 'Rogue'); assert.equal(destination[0].id, 'c1')
    assert.equal(destination[1].name, 'Mage'); assert.equal(destination[1].sounds[0].id, 'a')
    assert.equal(result.destinationRef.containerId, destination[1].id)
})
check('group duplication recursively mints UI identities and retains structure', () => {
    const board = fixture(), source = { containerType: 'groupRoot', containerId: 'g1', groupId: 'g1' }
    const result = applyTransfer(board, { source, target: { containerType: 'groupList', groupId: null }, scope: 'container', mode: 'copy' }, { mint })
    const copy = result.board.groups.at(-1)
    assert.equal(copy.name, 'Weather (copy)'); assert.notEqual(copy.id, 'g1')
    assert.equal(copy.categories[0].category, 'Cloud'); assert.notEqual(copy.categories[0].sounds[0].id, 'c')
    assert.equal(copy.categories[0].sounds[0].files[0].storedName, 'shared.wav')
})
for (const kind of ['character', 'environment', 'groupCharacter', 'groupCategory', 'newGroupCharacter', 'newGroupCategory']) {
    check(`create ${kind} and transfer is one immutable board operation`, () => {
        const board = fixture(), before = structuredClone(board)
        const result = applyTransfer(board, { source: refs[0], soundId: 'a', scope: 'sound', mode: 'move',
            create: { kind, name: 'New destination', groupName: 'New group', groupId: kind === 'groupCharacter' ? 'g2' : 'g1' } }, { mint })
        assert.deepEqual(board, before); assert.equal(allSounds(result.board).length, 5)
        assert.equal(find(result.board, result.target).sounds[0].id, 'a')
    })
}
check('create a new group and move the whole wrapper without a redundant empty member', () => {
    const result = applyTransfer(fixture(), { source: refs[0], scope: 'container', mode: 'move', create: { kind: 'newGroup', name: 'New party' } }, { mint })
    assert.equal(result.board.characters.length, 0)
    assert.equal(result.board.groups.at(-1).characters.length, 1)
    assert.equal(result.board.groups.at(-1).characters[0].id, 'c1')
})
check('empty group can adopt the first character container', () => {
    const board = fixture(); board.groups.push({ id: 'empty', name: 'Empty', mode: 'environment', categories: [], characters: [] })
    const result = applyTransfer(board, { source: refs[0], scope: 'container', mode: 'move', target: { containerType: 'groupCharacterList', groupId: 'empty' } }, { mint })
    assert.equal(result.board.groups.at(-1).mode, 'characters')
})
check('empty wrapper can move but empty bulk transfer cannot create a destination', () => {
    const board = fixture(); board.characters[0].sounds = []
    assert.equal(applyTransfer(board, { source: refs[0], scope: 'container', mode: 'move', target: { containerType: 'groupCharacterList', groupId: 'g2' } }, { mint }).count, 0)
    assert.throws(() => applyTransfer(board, { source: refs[0], scope: 'sounds', mode: 'copy', create: { kind: 'character', name: 'Not created' } }, { mint }), /no sounds/)
    assert.equal(board.characters.length, 1)
})
check('same location only offers duplication for whole containers', () => {
    const row = transferSections(fixture(), refs[0], 'container')[0].rows[0]
    assert.equal(row.current, true)
    assert.throws(() => applyTransfer(fixture(), { source: refs[0], target: row.ref, scope: 'container', mode: 'move' }, { mint }), /already/)
})
for (const [label, request] of [
    ['self move', { source: refs[0], target: refs[0], scope: 'sound', soundId: 'a', mode: 'move' }],
    ['missing source', { source: { ...refs[0], containerId: 'missing' }, target: refs[1], scope: 'sounds', mode: 'move' }],
    ['missing target', { source: refs[0], target: { ...refs[1], containerId: 'missing' }, scope: 'sounds', mode: 'move' }],
    ['wrong wrapper type', { source: refs[0], target: { containerType: 'environmentList' }, scope: 'container', mode: 'move' }],
    ['hidden character in nonempty environment group', { source: refs[0], target: { containerType: 'groupCharacterList', groupId: 'g1' }, scope: 'container', mode: 'move' }],
    ['nested group', { source: { containerType: 'groupRoot', containerId: 'g1', groupId: 'g1' }, target: { containerType: 'groupList' }, scope: 'container', mode: 'move' }],
    ['bulk group into itself', { source: { containerType: 'groupRoot', containerId: 'g1', groupId: 'g1' }, target: refs[2], scope: 'sounds', mode: 'move' }],
    ['blank destination name', { source: refs[0], soundId: 'a', scope: 'sound', mode: 'move', create: { kind: 'character', name: '  ' } }],
    ['duplicate destination name', { source: refs[0], soundId: 'a', scope: 'sound', mode: 'move', create: { kind: 'environment', name: 'Rain' } }],
]) check(`${label} refuses without changing input`, () => {
    const board = fixture(), before = structuredClone(board)
    assert.throws(() => applyTransfer(board, request, { mint })); assert.deepEqual(board, before)
})
check('copy refuses an identity generator that only returns existing IDs', () => assert.throws(() => applyTransfer(fixture(), { source: refs[0], target: refs[1], scope: 'sounds', mode: 'copy' }, { mint: () => 'a' }), /unique identity/))
console.log(`transfers: ${pass}/${pass + fail} PASS, ${fail} FAIL`)
process.exitCode = fail ? 1 : 0
