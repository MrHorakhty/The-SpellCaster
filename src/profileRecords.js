// Sync metadata belongs to persisted records. React renders a live projection;
// removed records remain as small tombstones without audio/icon references.
// Legacy identities are deterministic so two exports of the same old board
// acquire the same identities. New records get fresh identities, even copies.
const CHILDREN = ['sounds', 'categories', 'characters']
const META = new Set(['syncId', 'updatedAt', 'deletedAt', ...CHILDREN])
const time = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
export function mintRecordId(random = globalThis.crypto) {
    if (typeof random?.randomUUID === 'function') return `r_${random.randomUUID()}`
    // randomUUID requires a secure context; LAN web previews still have
    // getRandomValues and must remain able to add/copy sounds.
    if (typeof random?.getRandomValues === 'function') {
        const bytes = random.getRandomValues(new Uint8Array(16))
        return `r_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
    }
    // Identity, not a secret. Retain support for hosts without Web Crypto.
    return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
}
const legacyId = (scope, record, index) => `${scope}/${encodeURIComponent(String(record.id || record.category || `index:${index}`))}`

function properties(record) {
    return Object.fromEntries(Object.entries(record).filter(([key]) => !META.has(key)))
}

// Key ordering is irrelevant; array ordering is content (file playback order,
// container order). Never stamp an edit simply because JSON keys were reordered.
export function stableRecordJSON(value) {
    if (Array.isArray(value)) return `[${value.map(stableRecordJSON).join(',')}]`
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${stableRecordJSON(value[k])}`).join(',')}}`
    return JSON.stringify(value)
}

export function normalizeRecords(records, scope) {
    return (Array.isArray(records) ? records : []).filter(r => r && typeof r === 'object').map((record, index) => {
        const syncId = typeof record.syncId === 'string' && record.syncId ? record.syncId : legacyId(scope, record, index)
        const updatedAt = time(record.updatedAt)
        if (time(record.deletedAt)) return tombstone({ ...record, syncId }, Math.max(updatedAt, time(record.deletedAt)))
        const result = { ...record, syncId, updatedAt }
        delete result.deletedAt
        for (const key of CHILDREN) if (Array.isArray(record[key])) result[key] = normalizeRecords(record[key], `${syncId}/${key}`)
        return result
    })
}

function tombstone(record, stamp) {
    // Retain UI identity for restoration/import matching, but never retain blobs.
    return { syncId: record.syncId, ...(record.id ? { id: record.id } : {}), ...(record.category ? { category: record.category } : {}), updatedAt: stamp, deletedAt: stamp }
}

export function liveRecords(records) {
    return records.filter(r => !r.deletedAt).map(record => {
        const result = { ...record }
        for (const key of CHILDREN) if (Array.isArray(record[key])) result[key] = liveRecords(record[key])
        return result
    })
}

// Called at the state setter boundary, rather than at selected edit handlers:
// volume, drag, restore-defaults, transfers and future edits all pass here.
export function reconcileRecords(previous, next, { now = Date.now(), mint = mintRecordId } = {}) {
    const oldBySync = new Map(previous.map(r => [r.syncId, r]))
    const used = new Set()
    const result = next.map(record => {
        let old = oldBySync.get(record.syncId)
        // A copied sound retains arbitrary spread fields but has a NEW UI id.
        if (old && (old.deletedAt || used.has(old.syncId) || (old.id && record.id !== old.id))) old = undefined
        if (!old && !record.syncId) {
            old = previous.find(r => !r.deletedAt && !used.has(r.syncId) && (record.id ? r.id === record.id : r.category === record.category))
        }
        const syncId = old?.syncId || mint()
        const result = { ...record, syncId }
        delete result.deletedAt
        let changed = !old || stableRecordJSON(properties(old)) !== stableRecordJSON(properties(record))
        for (const key of CHILDREN) {
            if (Array.isArray(record[key]) || Array.isArray(old?.[key])) {
                result[key] = reconcileRecords(old?.[key] || [], record[key] || [], { now, mint })
                // Parent metadata describes its own properties and child order;
                // a child's field edit must not overwrite a concurrent rename.
                const before = (old?.[key] || []).filter(r => !r.deletedAt).map(r => r.syncId)
                const after = result[key].filter(r => !r.deletedAt).map(r => r.syncId)
                if (stableRecordJSON(before) !== stableRecordJSON(after)) changed = true
            }
        }
        result.updatedAt = changed ? Math.max(time(now), time(old?.updatedAt) + 1) : time(old.updatedAt)
        if (old) used.add(old.syncId)
        return result
    })
    for (const old of previous) {
        if (used.has(old.syncId)) continue
        result.push(old.deletedAt ? old : tombstone(old, Math.max(time(now), time(old.updatedAt) + 1)))
    }
    return result
}

// Commutative, deterministic last-write-wins for live records. Deletion is
// permanent for an identity; an explicit restore gets a fresh identity. This
// keeps stale offline edits from reviving deleted subtrees, whose bytes may
// already have been released. Equal-clock edits use canonical own properties.
// Descendant edits merge independently of a container rename. Deleted parents
// suppress their entire subtree and never acquire payload references again.
export function mergeRecords(local, incoming) {
    const left = new Map(local.map(r => [r.syncId, r]))
    const right = new Map(incoming.map(r => [r.syncId, r]))
    if (left.size !== local.length || right.size !== incoming.length) throw new Error('Duplicate record sync identities; merge refused.')
    const ids = [...new Set([...left.keys(), ...right.keys()])].sort()
    return ids.map(id => {
        const a = left.get(id), b = right.get(id)
        if (!a || !b) return globalThis.structuredClone(a || b)
        let winner
        if (!!a.deletedAt !== !!b.deletedAt) winner = a.deletedAt ? a : b
        else if (a.updatedAt !== b.updatedAt) winner = a.updatedAt > b.updatedAt ? a : b
        // Comparing whole subtrees here would make the winner depend on merge
        // grouping: an already-merged child union could change a parent's tie.
        else winner = stableRecordJSON(properties(a)) >= stableRecordJSON(properties(b)) ? a : b
        if (winner.deletedAt) return tombstone(winner, winner.updatedAt)
        const result = globalThis.structuredClone(winner)
        for (const key of CHILDREN) if (Array.isArray(a[key]) || Array.isArray(b[key])) result[key] = mergeRecords(a[key] || [], b[key] || [])
        return result
    })
}
