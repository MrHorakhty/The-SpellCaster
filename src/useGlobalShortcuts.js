import { useEffect, useRef, useState } from 'react'
import { globalShortcutRegistry } from './globalShortcuts.js'

export default function useGlobalShortcuts({ native, profileId, rows, blocked, onTrigger }) {
    const owner = useRef(Symbol(profileId))
    const trigger = useRef(onTrigger)
    trigger.current = onTrigger
    const [available, setAvailable] = useState(false)
    const [availabilityError, setAvailabilityError] = useState('')
    const focused = useRef(false)
    const [statuses, setStatuses] = useState({})
    const [errors, setErrors] = useState({})
    useEffect(() => {
        if (!native) return
        let alive = true
        import('@tauri-apps/api/core').then(({ invoke }) => invoke('global_shortcuts_available'))
            .then(value => { if (alive) setAvailable(value === true) })
            .catch(() => { if (alive) setAvailabilityError('Windows shortcut availability could not be checked. Restart the app and try again.') })
        return () => { alive = false }
    }, [native])
    useEffect(() => {
        if (!available) return
        let alive = true, unlisten
        import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
            const appWindow = getCurrentWindow()
            unlisten = await appWindow.onFocusChanged(event => { focused.current = event.payload })
            if (!alive) { unlisten(); return }
            focused.current = await appWindow.isFocused()
        }).catch(() => { focused.current = document.hasFocus() })
        return () => { alive = false; unlisten?.() }
    }, [available])
    const signature = JSON.stringify(available && !blocked ? rows : [])
    useEffect(() => {
        if (!available) return
        return globalShortcutRegistry.request(owner.current, JSON.parse(signature), id => trigger.current(id), next => {
            setStatuses(next)
            setErrors(current => {
                const result = { ...current }
                for (const [id, entry] of Object.entries(next)) {
                    if (entry.state === 'error') result[id] = entry.message
                    if (entry.state === 'active') delete result[id]
                }
                return result
            })
        })
    }, [available, signature])
    return { available, statuses, errors, availabilityError, paused: blocked, focused: () => focused.current,
        owns: event => available && globalShortcutRegistry.owns(owner.current, event) }
}
