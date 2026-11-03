import { globalAccelerator, globalSignature, nativeShortcutCode } from './globalKeys.js'

// One registry per page, shared across profile remounts. Native operations stay
// serialized even if IPC stalls. Changing ownership fences callbacks immediately.
export function createGlobalShortcutRegistry(loadApi, { timeoutMs = 5000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    let desired = null, draining = false, handled = null, apiPromise
    let active = new Set(), statuses = {}
    const publish = target => { if (desired === target) target.status({ ...statuses }) }
    const updateStatus = (target, id, state, message = '') => {
        if (desired !== target) return
        statuses = { ...statuses, [id]: { state, message } }; publish(target)
    }
    const call = async (target, operation) => {
        const timer = setTimer(() => {
            if (desired !== target) return
            for (const row of target.rows) updateStatus(target, row.id, 'error', 'Windows shortcut setup is not responding. Restart the app if it does not recover.')
        }, timeoutMs)
        try { return await operation() } finally { clearTimer(timer) }
    }
    const drain = async () => {
        if (draining) return
        draining = true
        try {
            while (desired && handled !== desired) {
                const target = desired
                handled = target
                active = new Set()
                try {
                    const api = await (apiPromise ||= loadApi().catch(error => { apiPromise = null; throw error }))
                    // Always clear the departing owner's native channels first.
                    // A failed cleanup must prevent registration of a new owner.
                    await call(target, () => api.unregisterAll())
                    if (desired !== target) continue
                    updateStatus(target, '__system', 'active')
                    for (const row of target.rows) {
                        try {
                            await call(target, () => api.register(globalAccelerator(row), event => {
                                if (desired === target && active.has(row.id) && event.state === 'Pressed') target.fire(row.id)
                            }))
                            if (desired !== target) break
                            active.add(row.id); updateStatus(target, row.id, 'active')
                        } catch {
                            updateStatus(target, row.id, 'error', 'Windows could not register this shortcut. It may be in use by another app. Change the key or try again.')
                        }
                    }
                } catch {
                    updateStatus(target, '__system', 'error', 'Windows shortcuts could not be cleared. Restart the app if retrying does not recover them.')
                    for (const row of target.rows) updateStatus(target, row.id, 'error', 'Windows shortcuts could not be initialized or cleared. Reopen settings to retry; restart the app if this persists.')
                }
            }
        } finally {
            draining = false
            if (desired && handled !== desired) void drain()
        }
    }
    return {
        request(owner, rows, fire, status) {
            const target = { owner, rows, fire, status }
            desired = target; active = new Set()
            statuses = Object.fromEntries(rows.map(row => [row.id, { state: 'pending', message: '' }]))
            publish(target); void drain()
            return () => {
                if (desired !== target) return
                desired = { owner: null, rows: [], fire: () => {}, status: () => {} }
                active = new Set(); statuses = {}; void drain()
            }
        },
        owns(owner, event) {
            if (desired?.owner !== owner) return false
            const signature = globalSignature({ globalCode: nativeShortcutCode(event), modifiers:
                (event.ctrlKey ? 1 : 0) | (event.altKey ? 2 : 0) | (event.shiftKey ? 4 : 0) })
            return desired.rows.some(row => globalSignature(row) === signature && ['pending', 'active'].includes(statuses[row.id]?.state))
        },
    }
}

const registryKey = Symbol.for('spellcaster.globalShortcutRegistry')
export const globalShortcutRegistry = globalThis[registryKey] ||= createGlobalShortcutRegistry(() => import('@tauri-apps/plugin-global-shortcut'))
