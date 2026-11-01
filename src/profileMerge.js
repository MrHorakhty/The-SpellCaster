import { mergeRecords, normalizeRecords, stableRecordJSON } from './profileRecords.js'

export const RECORD_SLICES = { characters: 'ttrpg_characters', environmentSounds: 'ttrpg_environment', groups: 'ttrpg_groups' }

// Independent new records may have colliding UI ids or category names. Keep
// sync identity intact and deterministically disambiguate the display identity.
// This also prevents duplicate sound ids from making hotkeys/playback ambiguous.
function suffix(identity) {
    let hash = 2166136261
    for (const char of identity) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    return (hash >>> 0).toString(16)
}

function repairNames(records, globalSoundIds) {
    const seen = new Set()
    return records.map(record => {
        if (record.deletedAt) return record
        const result = { ...record }
        const key = record.category !== undefined ? 'category' : 'id'
        const base = result[key]
        if (base !== undefined) {
            let candidate = base, index = 1
            while (seen.has(candidate)) candidate = key === 'category'
                ? `${base} (merged ${++index})` : `${base}_${suffix(record.syncId)}_${index++}`
            result[key] = candidate
            seen.add(candidate)
        }
        if (Array.isArray(record.sounds)) {
            result.sounds = record.sounds.map(sound => {
                if (sound.deletedAt) return sound
                let id = sound.id, index = 0
                while (globalSoundIds.has(id)) id = `${sound.id}_${suffix(sound.syncId)}_${++index}`
                globalSoundIds.add(id)
                return { ...sound, id }
            })
        }
        for (const key of ['characters', 'categories']) if (Array.isArray(record[key])) result[key] = repairNames(record[key], globalSoundIds)
        return result
    })
}

export function mergeProfileRecords(local, incoming) {
    const result = { ...local }
    const soundIds = new Set()
    const validate = board => {
        const seen = new Set()
        const visit = records => {
            for (const record of records) {
                if (seen.has(record.syncId)) throw new Error('Duplicate record sync identities; merge refused.')
                seen.add(record.syncId)
                for (const key of ['sounds', 'characters', 'categories']) visit(record[key] || [])
            }
        }
        for (const [field, scope] of Object.entries(RECORD_SLICES)) visit(normalizeRecords(board[field], scope))
    }
    validate(local); validate(incoming)
    for (const [field, scope] of Object.entries(RECORD_SLICES)) {
        result[field] = repairNames(mergeRecords(normalizeRecords(local[field], scope), normalizeRecords(incoming[field], scope)), soundIds)
    }
    const before = new Map(), after = new Map()
    const walk = (records, visit) => {
        for (const record of records) {
            if (record.deletedAt) continue
            for (const sound of record.sounds || []) if (!sound.deletedAt) visit(sound)
            for (const key of ['characters', 'categories']) walk(record[key] || [], visit)
        }
    }
    for (const [field, scope] of Object.entries(RECORD_SLICES)) {
        walk(normalizeRecords(local[field], scope), sound => {
            const matches = before.get(sound.id) || []
            matches.push(sound.syncId); before.set(sound.id, matches)
        })
        walk(result[field], sound => after.set(sound.syncId, sound.id))
    }
    if (local.hotkeys) result.hotkeys = { ...local.hotkeys, bindings: local.hotkeys.bindings.map(binding => {
        const matches = before.get(binding.target.soundId)
        const id = matches?.length === 1 && after.get(matches[0])
        return id ? { ...binding, target: { ...binding.target, soundId: id } } : binding
    }) }
    // Manual merge only touches the board. Local settings/hotkeys are explicitly
    // retained; automatic settings conflict resolution needs separate clocks.
    return result
}

export function summarizeMerge(local, merged) {
    const before = new Map(), after = new Map()
    const walk = (records, map) => {
        for (const record of records) {
            map.set(record.syncId, record)
            for (const key of ['sounds', 'characters', 'categories']) walk(record[key] || [], map)
        }
    }
    for (const [field, scope] of Object.entries(RECORD_SLICES)) {
        walk(normalizeRecords(local[field], scope), before)
        walk(merged[field] || [], after)
    }
    const summary = { added: 0, updated: 0, deleted: 0 }
    for (const [id, record] of after) {
        const old = before.get(id)
        if (record.deletedAt) { if (old && !old.deletedAt) summary.deleted++; continue }
        if (!old || old.deletedAt) summary.added++
        else if (stableRecordJSON(record) !== stableRecordJSON(old)) summary.updated++
    }
    // Children removed by a deleted parent are deletions too.
    for (const [id, record] of before) if (!record.deletedAt && !after.has(id)) summary.deleted++
    return summary
}
