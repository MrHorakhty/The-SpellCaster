// Synchronous undo journal. The journal's removal is the sole commit point.
export const TRANSACTION_KEY = '__profile_transaction'

function journal(ls, prefix) {
    const raw = ls.getItem(prefix + TRANSACTION_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1 || !Array.isArray(parsed.before) ||
        parsed.before.some(entry => !Array.isArray(entry) || entry.length !== 2 ||
            typeof entry[0] !== 'string' || entry[0] === TRANSACTION_KEY ||
            (entry[1] !== null && typeof entry[1] !== 'string')) ||
        new Set(parsed.before.map(([key]) => key)).size !== parsed.before.length) {
        throw new Error('Invalid profile recovery journal. Preserve storage for recovery.')
    }
    return parsed.before
}

export function recoverTransaction(ls, prefix) {
    const before = journal(ls, prefix)
    if (!before) return
    for (const [key, value] of before) {
        if (value === null) ls.removeItem(prefix + key)
        else ls.setItem(prefix + key, value)
    }
    ls.removeItem(prefix + TRANSACTION_KEY)
}

export function readTransactionValue(ls, prefix, key) {
    const before = journal(ls, prefix)
    const entry = before?.find(([name]) => name === key)
    return entry ? entry[1] : ls.getItem(prefix + key)
}

export function transactionKeys(ls, prefix, keys) {
    const logical = new Set(keys.filter(key => key !== TRANSACTION_KEY))
    for (const [key, value] of journal(ls, prefix) || []) {
        if (value === null) logical.delete(key)
        else logical.add(key)
    }
    return [...logical]
}

export function commitTransaction(ls, prefix, values) {
    const entries = Object.entries(values)
    if (entries.some(([key, value]) => key === TRANSACTION_KEY ||
        (value !== null && typeof value !== 'string'))) {
        throw new Error('Profile transactions require string values or null removals')
    }
    recoverTransaction(ls, prefix)
    const changed = entries.filter(([key, value]) => ls.getItem(prefix + key) !== value)
    if (!changed.length) return
    const before = changed.map(([key]) => [key, ls.getItem(prefix + key)])
    ls.setItem(prefix + TRANSACTION_KEY, JSON.stringify({ version: 1, before }))
    try {
        for (const [key, value] of changed) {
            if (value === null) ls.removeItem(prefix + key)
            else ls.setItem(prefix + key, value)
        }
        ls.removeItem(prefix + TRANSACTION_KEY)
    } catch (error) {
        try { recoverTransaction(ls, prefix) } catch {
            // Keep the journal authoritative while writes remain unavailable.
            // Reads still expose the complete previous state, not partial data.
        }
        throw error
    }
}
