import { mintRecordId } from './profileRecords.js'

const children = ['characters', 'categories', 'sounds']
export const sameTransferRef = (a, b) => !!a && !!b &&
    a.containerType === b.containerType && a.containerId === b.containerId &&
    (a.groupId || null) === (b.groupId || null)
const keyOf = ref => JSON.stringify([ref.containerType, ref.groupId || null, ref.containerId || null])
const live = items => (items || []).filter(item => !item.deletedAt)
const isCharacter = ref => ['character', 'groupCharacter'].includes(ref.containerType)
const isCategory = ref => ['environment', 'group'].includes(ref.containerType)
const modeFor = type => type === 'characters' ? 'characters' : 'environment'
const emptyGroup = group => !live(group.characters).length && !live(group.categories).length && !live(group.sounds).length
const accepts = (group, type) => (group.mode || 'environment') === modeFor(type) || emptyGroup(group)

function locate(board, ref) {
    if (!ref) throw new Error('Choose a source container.')
    let parent
    if (ref.containerType === 'character') parent = board.characters
    else if (ref.containerType === 'environment') parent = board.environmentSounds
    else if (ref.containerType === 'groupRoot') parent = board.groups
    else {
        const group = board.groups.find(g => g.id === ref.groupId && !g.deletedAt)
        if (!group) throw new Error('That group no longer exists.')
        if (ref.containerType === 'groupCharacter') parent = group.characters || []
        else if (ref.containerType === 'group') parent = group.categories || []
        else if (ref.containerType === 'groupTop') return { record: group, parent: board.groups }
    }
    const matches = (parent || []).filter(item => !item.deletedAt &&
        (isCategory(ref) ? item.category === ref.containerId : item.id === ref.containerId))
    if (matches.length !== 1) throw new Error('That container is missing or ambiguous. Choose it again.')
    return { record: matches[0], parent }
}

function soundLists(record, ref) {
    if (ref.containerType !== 'groupRoot') return [record.sounds || []]
    return [...live(record.characters).map(c => c.sounds || []),
        ...live(record.categories).map(c => c.sounds || []), record.sounds || []]
}

export function transferSource(board, ref) {
    const { record } = locate(board, ref)
    return { name: record.name || record.category || 'Container',
        count: soundLists(record, ref).flat().filter(s => !s.deletedAt).length,
        isGroup: ref.containerType === 'groupRoot', isCharacter: isCharacter(ref) }
}

/** The five persisted sound-container shapes, including empty destinations. */
export function transferContainers(board) {
    const rows = []
    const add = (record, ref, section) => rows.push({ key: keyOf(ref), label: record.name || record.category,
        ref, section, sounds: live(record.sounds) })
    for (const c of live(board.characters)) add(c, { containerType: 'character', containerId: c.id, groupId: null }, 'Characters')
    for (const g of live(board.groups)) {
        for (const c of live(g.categories)) add(c, { containerType: 'group', containerId: c.category, groupId: g.id }, g.name)
        for (const c of live(g.characters)) add(c, { containerType: 'groupCharacter', containerId: c.id, groupId: g.id }, g.name)
        if (live(g.sounds).length) add(g, { containerType: 'groupTop', containerId: g.id, groupId: g.id }, g.name)
    }
    for (const c of live(board.environmentSounds)) add(c, { containerType: 'environment', containerId: c.category, groupId: null }, 'Environments')
    return rows
}

function sameParent(source, target) {
    const types = { character: 'characterList', environment: 'environmentList',
        groupCharacter: 'groupCharacterList', group: 'groupCategoryList', groupRoot: 'groupList' }
    return types[source.containerType] === target.containerType && (source.groupId || null) === (target.groupId || null)
}

export function transferSections(board, source, scope) {
    let rows
    if (scope !== 'container') {
        rows = transferContainers(board).map(row => ({ ...row, current: sameTransferRef(source, row.ref) ||
            (source.containerType === 'groupRoot' && row.ref.groupId === source.containerId) }))
    } else if (source.containerType === 'groupRoot') {
        rows = [{ key: 'groupList', label: 'Top-level groups', section: 'Duplicate group',
            ref: { containerType: 'groupList', groupId: null }, current: true }]
    } else {
        const character = isCharacter(source)
        const type = character ? 'characters' : 'categories'
        const root = { containerType: character ? 'characterList' : 'environmentList', groupId: null }
        rows = [{ key: keyOf(root), label: character ? 'Main characters' : 'Main environments',
            section: 'Main sections', ref: root, current: sameParent(source, root) }]
        for (const g of live(board.groups).filter(g => accepts(g, type))) {
            const ref = { containerType: character ? 'groupCharacterList' : 'groupCategoryList', groupId: g.id }
            rows.push({ key: keyOf(ref), label: g.name, section: 'Groups', ref, current: sameParent(source, ref) })
        }
    }
    // Use stable section identities, not names: separate groups can share names.
    const sections = []
    for (const row of rows) {
        const key = scope === 'container' ? row.section : row.ref.groupId || row.section
        let section = sections.find(s => s.key === key)
        if (!section) { section = { key, label: row.section, rows: [] }; sections.push(section) }
        section.rows.push(row)
    }
    return sections
}

function uniqueName(name, records, field, suffix) {
    const names = new Set(live(records).map(r => r[field]))
    let next = `${name} (${suffix})`, index = 2
    while (names.has(next)) next = `${name} (${suffix} ${index++})`
    return next
}

function makeIds(board, mint) {
    const ids = new Set()
    const visit = records => { for (const r of records || []) { if (r.id) ids.add(r.id); for (const k of children) visit(r[k]) } }
    visit(board.characters); visit(board.environmentSounds); visit(board.groups)
    return kind => {
        for (let i = 0; i < 32; i++) {
            const id = mint(kind)
            if (typeof id === 'string' && id && !ids.has(id)) { ids.add(id); return id }
        }
        throw new Error('Could not create a unique identity. Please try again.')
    }
}

function copyRecord(record, kind, id) {
    const result = globalThis.structuredClone(record)
    delete result.syncId; delete result.updatedAt; delete result.deletedAt
    if (kind !== 'category') result.id = id(kind)
    else if (result.id) result.id = id(kind)
    for (const field of children) if (Array.isArray(record[field])) {
        const childKind = { characters: 'char', categories: 'category', sounds: 'sound' }[field]
        result[field] = live(record[field]).map(child => copyRecord(child, childKind, id))
    }
    return result
}

function wrapperList(board, target, character) {
    if (target.containerType === 'characterList' && character) return board.characters
    if (target.containerType === 'environmentList' && !character) return board.environmentSounds
    const expected = character ? 'groupCharacterList' : 'groupCategoryList'
    if (target.containerType !== expected) throw new Error('Choose a destination for the same type of container.')
    const group = board.groups.find(g => g.id === target.groupId)
    const type = character ? 'characters' : 'categories'
    if (!group || !accepts(group, type)) throw new Error('That group cannot accept this container type.')
    group.mode = modeFor(type)
    return (group[type] ||= [])
}

function createDestination(board, create, source, scope, id) {
    const name = String(create.name || '').trim()
    if (!name) throw new Error('Enter a destination name.')
    const wrapper = scope === 'container'
    if (wrapper && source.containerType === 'groupRoot') throw new Error('Groups stay at the top level. Choose Duplicate group.')
    const character = wrapper ? isCharacter(source) : ['character', 'groupCharacter', 'newGroupCharacter'].includes(create.kind)
    let groupId = create.groupId
    if (['newGroup', 'newGroupCharacter', 'newGroupCategory'].includes(create.kind)) {
        const groupName = wrapper ? name : String(create.groupName || '').trim()
        if (!groupName) throw new Error('Enter a group name.')
        if (board.groups.some(g => g.name === groupName)) throw new Error('A group with that name already exists.')
        groupId = id('group')
        board.groups.push({ id: groupId, name: groupName, icon: '', mode: character ? 'characters' : 'environment', characters: [], categories: [], sounds: [] })
    }
    if (wrapper) {
        if (create.kind !== 'newGroup') throw new Error('Choose a group or a main section for a whole container.')
        return { containerType: character ? 'groupCharacterList' : 'groupCategoryList', groupId }
    }
    const inGroup = ['groupCharacter', 'groupCategory', 'newGroupCharacter', 'newGroupCategory'].includes(create.kind)
    if (!inGroup && !['character', 'environment'].includes(create.kind)) throw new Error('Choose a destination type.')
    const listRef = { containerType: inGroup ? (character ? 'groupCharacterList' : 'groupCategoryList') :
        (character ? 'characterList' : 'environmentList'), groupId: inGroup ? groupId : null }
    const list = wrapperList(board, listRef, character)
    const field = character ? 'name' : 'category'
    if (live(list).some(item => item[field] === name)) throw new Error('That destination name already exists here.')
    const record = { [field]: name, icon: create.icon || '', sounds: [] }
    if (character) record.id = id('char')
    list.push(record)
    return { containerType: inGroup ? (character ? 'groupCharacter' : 'group') :
        (character ? 'character' : 'environment'), containerId: character ? record.id : name, groupId: inGroup ? groupId : null }
}

/** Pure visible-board operation. The existing record setters retain tombstones. */
export function applyTransfer(board, request, { mint = kind => `${kind}_${mintRecordId()}` } = {}) {
    if (!['move', 'copy'].includes(request.mode)) throw new Error('Choose Move or Copy.')
    if (!['sound', 'sounds', 'container'].includes(request.scope)) throw new Error('Choose what to transfer.')
    const next = globalThis.structuredClone(board)
    const id = makeIds(next, mint)
    const source = locate(next, request.source)
    const lists = soundLists(source.record, request.source)
    const sounds = request.scope === 'sound'
        ? lists.flat().filter(s => !s.deletedAt && s.id === request.soundId)
        : lists.flat().filter(s => !s.deletedAt)
    if (request.scope === 'sound' && sounds.length !== 1) throw new Error('That sound is missing or ambiguous. Choose it again.')
    if (request.scope === 'sounds' && !sounds.length) throw new Error('This container has no sounds to transfer. Choose Container to transfer the empty container.')
    const target = request.create ? createDestination(next, request.create, request.source, request.scope, id) : request.target
    if (!target) throw new Error('Choose a destination.')
    const copy = request.mode === 'copy'
    if (request.scope === 'container') {
        if (!isCharacter(request.source) && !isCategory(request.source) && request.source.containerType !== 'groupRoot') throw new Error('This source has no movable container.')
        const group = request.source.containerType === 'groupRoot'
        if (group && (target.containerType !== 'groupList' || !copy)) throw new Error('Groups stay top-level; use Copy to duplicate the group.')
        if (!copy && sameParent(request.source, target)) throw new Error('The container is already in that location.')
        const character = isCharacter(request.source)
        const destination = group ? next.groups : wrapperList(next, target, character)
        const field = character || group ? 'name' : 'category'
        const record = copy ? copyRecord(source.record, group ? 'group' : character ? 'char' : 'category', id) : source.record
        if (copy) record[field] = uniqueName(record[field], destination, field, 'copy')
        else if (field === 'category' && destination.some(r => r.category === record.category)) record.category = uniqueName(record.category, destination, field, 'moved')
        // Wrapper ids are scoped by parent in older profiles. Resolve a collision
        // at the new parent without changing any sound ids used by hotkeys.
        if (!copy && character && destination.some(r => r.id === record.id)) record.id = id('char')
        if (!copy) source.parent.splice(source.parent.indexOf(source.record), 1)
        destination.push(record)
        const destinationRef = { containerType: group ? 'groupRoot' : target.containerType === 'characterList' ? 'character'
            : target.containerType === 'environmentList' ? 'environment' : character ? 'groupCharacter' : 'group',
            containerId: character || group ? record.id : record.category, groupId: group ? record.id : target.groupId || null }
        return { board: next, target, destinationRef, count: sounds.length, name: record[field] }
    }
    if (!copy && (sameTransferRef(request.source, target) ||
        (request.source.containerType === 'groupRoot' && target.groupId === request.source.containerId))) throw new Error('Choose a destination outside the source container.')
    const destination = locate(next, target).record
    destination.sounds ||= []
    if (!copy && (new Set(sounds.map(s => s.id)).size !== sounds.length || sounds.some(s => destination.sounds.some(other => other.id === s.id)))) throw new Error('Duplicate sound identities prevent this move. Choose a different destination.')
    for (const sound of sounds) {
        const record = copy ? copyRecord(sound, 'sound', id) : sound
        if (copy) record.name = uniqueName(record.name, destination.sounds, 'name', 'copy')
        destination.sounds.push(record)
    }
    if (!copy) for (const list of lists) {
        const moved = new Set(sounds)
        for (let i = list.length - 1; i >= 0; i--) if (moved.has(list[i])) list.splice(i, 1)
    }
    return { board: next, target, count: sounds.length, name: destination.name || destination.category }
}
