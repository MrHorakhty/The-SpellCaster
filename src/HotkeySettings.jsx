import { useEffect, useRef, useState } from 'react'
import { emptyHotkeys, hotkeyEventAllowed, hotkeyModifiers, hotkeySignature, hotkeyLabel, resolveHotkey } from './hotkeys.js'
import { globalChordError, globalSignature, nativeShortcutCode } from './globalKeys.js'

export default function HotkeySettings({ state, targets, onSave, createId, globalState = {} }) {
    const [draft, setDraft] = useState(null)
    const [recording, setRecording] = useState(false)
    const [notice, setNotice] = useState('')
    const [query, setQuery] = useState('')
    const matchingTargets = targets.filter(entry => entry.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    const targetCounts = new Map()
    for (const entry of targets) targetCounts.set(entry.sound.id, (targetCounts.get(entry.sound.id) || 0) + 1)
    const recordButton = useRef(null)
    const addButton = useRef(null)
    const origin = useRef(null)
    const { payload, error, locked } = state
    const cancelRecording = () => { setRecording(false); recordButton.current?.focus() }
    useEffect(() => {
        if (!draft && origin.current) (origin.current.isConnected ? origin.current : addButton.current)?.focus()
    }, [draft, locked])

    useEffect(() => {
        if (!recording) return
        const cancel = () => setRecording(false)
        const key = event => {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); setRecording(false); recordButton.current?.focus(); return
            }
            if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(event.key)) return
            if (!hotkeyEventAllowed(event, { recording: true })) {
                setNotice('Use a letter, number, punctuation, numpad operator or F1–F4 / F6–F10, optionally with Ctrl, Alt or Shift. Navigation, Meta, AltGraph and browser/system shortcuts are reserved.')
                return
            }
            event.preventDefault(); event.stopPropagation()
            const conflict = payload.bindings.find(row => row.id !== draft.id && hotkeySignature(row) === hotkeySignature({ code: event.code, modifiers: hotkeyModifiers(event) }))
            if (conflict) { setNotice(`${hotkeyLabel(event.code, event.key, hotkeyModifiers(event))} is already assigned to ${conflict.displayName}.`); return }
            const nativeCode = globalState.available ? nativeShortcutCode(event) : null
            const captured = { code: event.code, modifiers: hotkeyModifiers(event),
                label: hotkeyLabel(event.code, event.key, hotkeyModifiers(event)), global: !!draft.global,
                ...(nativeCode ? { globalCode: nativeCode } : {}) }
            const nativeError = globalChordError(captured)
            if (nativeError) { setNotice(nativeError); return }
            if (captured.global && payload.bindings.some(row => row.id !== draft.id && row.global && globalSignature(row) === globalSignature(captured))) {
                setNotice('That Windows shortcut is already assigned. Record another key.'); return
            }
            setDraft(current => { const next = { ...current, ...captured }; if (!nativeCode) delete next.globalCode; return next })
            setNotice(''); setRecording(false); recordButton.current?.focus()
        }
        const visibility = () => { if (document.visibilityState === 'hidden') cancel() }
        document.addEventListener('keydown', key, true)
        window.addEventListener('blur', cancel)
        document.addEventListener('visibilitychange', visibility)
        return () => {
            document.removeEventListener('keydown', key, true)
            window.removeEventListener('blur', cancel)
            document.removeEventListener('visibilitychange', visibility)
        }
    }, [recording, draft, payload, globalState.available])

    const save = () => {
        const chosen = targets.filter(entry => entry.sound.id === draft.soundId)
        if (!draft.code || chosen.length !== 1) { setNotice('Record a key and choose a unique sound.'); return }
        if (payload.bindings.some(row => row.id !== draft.id && hotkeySignature(row) === hotkeySignature(draft))) {
            setNotice('That key is already assigned. Record a different key.'); return
        }
        const binding = { id: draft.id || createId(), code: draft.code, modifiers: draft.modifiers || 0,
            label: draft.label, displayName: chosen[0].sound.name || 'Unnamed sound', target: chosen[0].target,
            global: !!draft.global, ...(draft.globalCode ? { globalCode: draft.globalCode } : {}) }
        const nativeError = globalChordError(binding)
        if (nativeError) { setNotice(nativeError); return }
        if (binding.global && payload.bindings.some(row => row.id !== binding.id && row.global && globalSignature(row) === globalSignature(binding))) {
            setNotice('That Windows shortcut is already assigned.'); return
        }
        const next = { version: 3, bindings: [...payload.bindings.filter(row => row.id !== binding.id), binding] }
        if (onSave(next)) { setDraft(null); setNotice('Hotkey saved.'); }
    }
    const button = 'min-h-[44px] px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm disabled:opacity-40'
    return <section className="pt-4 border-t border-dark-700 space-y-3" data-hotkeys-section>
        <h3 className="text-lg font-medium">Hotkeys</h3>
        <p className="text-xs text-slate-400">Keys can use Ctrl, Alt and Shift combinations while this app is focused. Letters, numbers, punctuation, numpad operators and F1–F4 / F6–F10 are supported. Navigation, Meta, AltGraph and browser/system shortcuts stay reserved. Bindings belong to this profile. Typing, editing and open dialogs pause hotkeys. Keys follow their physical keyboard position; numpad digits need Num Lock.</p>
        <p className="text-xs text-slate-400">Global shortcuts work while another app is focused on Windows. They follow the recorded Windows key for your keyboard layout. Settings, editing and dialogs pause them. Ctrl+Alt is reserved for AltGr; use Ctrl+Shift or Alt+Shift instead. {globalState.available ? 'Close settings to register saved global keys.' : 'On this platform, saved global bindings work as in-app keys.'}</p>
        {error && <div role="alert" className="text-sm text-amber-300">{error}</div>}
        {globalState.availabilityError && <div role="alert" className="text-sm text-amber-300">{globalState.availabilityError}</div>}
        {state.saveError && <div role="alert" data-hotkey-save-error className="text-sm text-red-300">{state.saveError} Your previous bindings are unchanged. Try saving again.</div>}
        {notice && <p role="status" className="text-sm text-slate-300">{notice}</p>}
        {!payload.bindings.length && <p className="text-sm text-slate-400">No hotkeys assigned.</p>}
        {payload.bindings.map(row => {
            const resolved = resolveHotkey(row, targets)
            return <div key={row.id} data-hotkey-row={row.id} data-hotkey-code={row.code} className="p-3 rounded-lg bg-dark-900 flex flex-wrap items-center gap-2">
                <div className="text-sm break-words flex-1 min-w-0"><kbd>{row.label}</kbd> <span className="text-slate-400">({row.code})</span> — {resolved?.sound.name || row.displayName}</div>
                <p className={`w-full order-last text-xs ${resolved ? 'text-slate-400' : 'text-amber-300'}`} data-hotkey-status>{resolved?.label || 'Unresolved — sound missing or its ID is duplicated. Choose a sound to repair.'}</p>
                {row.global && <p className="w-full order-last text-xs text-amber-200" data-global-shortcut-status>{globalState.errors?.[row.id] || (globalState.available ? globalState.paused ? 'Global — paused while settings are open' : globalState.statuses?.[row.id]?.state || 'Global — waiting' : 'Global — in-app only on this platform')}</p>}
                <div className="flex gap-2">
                    <button type="button" className={button} data-hotkey-edit disabled={!!draft} onClick={event => { origin.current = event.currentTarget; setDraft({ ...row, soundId: row.target.soundId }); setQuery(''); setNotice('') }}>Edit / repair</button>
                    <button type="button" className={button} data-hotkey-remove disabled={!!draft} onClick={() => { if (onSave({ version: 3, bindings: payload.bindings.filter(item => item.id !== row.id) })) addButton.current?.focus() }}>Remove</button>
                </div>
            </div>
        })}
        <button type="button" ref={addButton} className={button} data-hotkey-add disabled={locked || !!draft} onClick={event => { origin.current = event.currentTarget; setDraft({ id: null, code: '', label: '', soundId: '' }); setQuery(''); setNotice('') }}>Add hotkey</button>
        {draft && <div className="p-3 border border-lime-700 rounded-lg space-y-3" data-hotkey-draft>
            <label className="flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" data-hotkey-global checked={!!draft.global} disabled={recording || !globalState.available && !draft.global} onChange={event => { setDraft({ ...draft, global: event.target.checked }); setNotice(event.target.checked ? 'Record a Ctrl or Alt combination on Windows. Ctrl+Alt is reserved for AltGr.' : '') }} />Global on Windows</label>
            <button type="button" ref={recordButton} className={button} data-hotkey-record onClick={() => { setRecording(true); setNotice('Hold Ctrl, Alt or Shift if wanted, then press the trigger key. Escape cancels recording.') }}>{recording ? 'Press a key…' : draft.code ? `Key: ${draft.label} (${draft.code}) — record again` : 'Record key'}</button>
            {recording && <button type="button" className={button} onClick={cancelRecording}>Cancel recording</button>}
            <div className="space-y-2" data-hotkey-picker>
                <label className="block text-sm">Find a sound
                    <input type="search" data-hotkey-search className="block w-full mt-1 p-2 bg-dark-700 rounded-lg" placeholder="Search sound or location…" value={query} disabled={recording} onChange={event => setQuery(event.target.value)} />
                </label>
                <p className="text-xs text-slate-400" role="status">{matchingTargets.length} sounds found. Search by name or location.</p>
                <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-dark-700 p-1" aria-label="Matching sounds">
                    {matchingTargets.map((entry, index) => <button key={index} type="button" data-hotkey-target={entry.sound.id} disabled={recording || targetCounts.get(entry.sound.id) !== 1} aria-pressed={draft.soundId === entry.sound.id} className={`block w-full text-left p-2 rounded-lg disabled:opacity-40 ${draft.soundId === entry.sound.id ? 'bg-lime-900 ring-1 ring-lime-500' : 'bg-dark-800 hover:bg-dark-700'}`} onClick={() => setDraft({ ...draft, soundId: entry.sound.id })}>
                        <span className="block text-sm break-words">{entry.sound.name || 'Unnamed sound'}{draft.soundId === entry.sound.id ? ' ✓' : ''}</span>
                        <span className="block text-xs text-slate-400 break-words">{entry.label}{targetCounts.get(entry.sound.id) !== 1 ? ' — duplicate sound ID; unavailable' : ''}</span>
                    </button>)}
                    {!matchingTargets.length && <p className="p-3 text-sm text-slate-400">No sounds match. Try another name or location.</p>}
                </div>
                <p className="text-xs text-slate-300" data-hotkey-selection>Selected: {targets.find(entry => entry.sound.id === draft.soundId)?.label || 'Choose a sound above'}</p>
            </div>
            <div className="flex gap-2">
                <button type="button" className={button} data-hotkey-save disabled={recording || !draft.code || !draft.soundId} onClick={save}>{error ? 'Save repair' : 'Save hotkey'}</button>
                <button type="button" className={button} data-hotkey-cancel onClick={() => { setRecording(false); setDraft(null); setNotice('') }}>Cancel</button>
            </div>
        </div>}
        {error && <button type="button" className={button} data-hotkey-reset onClick={() => {
            if (window.confirm('Reset all hotkeys in this profile? The saved hotkey data will be replaced.')) {
                origin.current = addButton.current
                if (onSave(emptyHotkeys())) { setDraft(null); setNotice('Hotkeys reset.') }
            }
        }}>Reset hotkeys</button>}
    </section>
}
