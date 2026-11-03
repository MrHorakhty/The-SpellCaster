import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Plus, X } from 'lucide-react'

export default function TransferDialog({ source, scope, allowContainer, sections, groups, error,
    onScope, onTransfer, onCreate, onClose }) {
    const dialog = useRef(null)
    const [creating, setCreating] = useState(false)
    const [kind, setKind] = useState('character')
    const [name, setName] = useState('')
    const [groupName, setGroupName] = useState('')
    const [groupId, setGroupId] = useState('')
    useEffect(() => {
        const before = document.activeElement
        dialog.current?.focus()
        return () => { if (before?.isConnected) before.focus() }
    }, [])
    const wrapper = scope === 'container'
    const compatibleGroups = groups.filter(g => {
        const character = kind === 'groupCharacter'
        return (g.mode || 'environment') === (character ? 'characters' : 'environment') ||
            !(g.characters?.length || g.categories?.length || g.sounds?.length)
    })
    const needsGroup = ['groupCharacter', 'groupCategory'].includes(kind)
    const newGroup = ['newGroupCharacter', 'newGroupCategory'].includes(kind)
    const create = mode => onCreate(wrapper ? { kind: 'newGroup', name } :
        { kind, name, groupName, groupId: groupId || compatibleGroups[0]?.id }, mode)
    const fieldClass = 'w-full rounded-lg border border-dark-600 bg-dark-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500'
    const actionClass = 'min-h-[44px] px-3 py-2 rounded-lg bg-lime-600 hover:bg-lime-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
            <div ref={dialog} role="dialog" aria-modal="true" aria-label="Move or Copy" tabIndex={-1}
                data-transfer-dialog className="w-full max-w-lg rounded-xl bg-dark-800 p-4 shadow-xl max-h-[90dvh] overflow-y-auto"
                onKeyDown={event => {
                    if (event.key !== 'Tab') return
                    const items = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el => el.offsetParent !== null)
                    if (!items.length) return
                    const first = items[0], last = items.at(-1)
                    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
                    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
                }}>
                <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft size={20} />Move or Copy</h2>
                    <button onClick={onClose} aria-label="Close transfer picker" className="p-2 hover:bg-dark-700 rounded-lg"><X size={20} /></button>
                </div>
                <p className="text-sm text-slate-300 mb-3">{source.name} · {source.count} sound{source.count === 1 ? '' : 's'}</p>
                {allowContainer && (
                    <div className="flex gap-2 mb-3" aria-label="Transfer contents or container">
                        {[['sounds', 'All sounds'], ['container', source.isGroup ? 'Entire group' : 'Container']].map(([value, label]) => (
                            <button key={value} data-transfer-scope={value} aria-pressed={scope === value}
                                onClick={() => { setCreating(false); onScope(value) }}
                                className={`px-3 py-2 rounded-lg text-sm ${scope === value ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300'}`}>{label}</button>
                        ))}
                    </div>
                )}
                {wrapper && <p className="text-xs text-slate-400 mb-3">{source.isGroup
                    ? 'Duplicate the group with its characters, categories and sounds. Groups stay at the top level.'
                    : 'Keep the container’s name, icon and sounds. Category name conflicts receive a unique name.'}</p>}
                {error && <p role="alert" className="mb-3 rounded-lg bg-red-950/60 border border-red-700 p-3 text-sm text-red-200">{error}</p>}
                {!creating && <>
                    <div className="max-h-[40dvh] overflow-y-auto mb-3">
                        {sections.map(section => (
                            <div key={section.key} className="mb-3">
                                <p className="px-2 py-2 text-xs font-semibold uppercase text-slate-400">{section.label}</p>
                                {section.rows.map(row => (
                                    <div key={row.key} data-transfer-target={JSON.stringify(row.ref)} className="flex items-center justify-between gap-2 px-2 py-2 hover:bg-dark-700 rounded-lg">
                                        <span className="text-sm truncate">{row.label}{row.current && <span className="ml-2 text-xs text-slate-400">(duplicate here)</span>}</span>
                                        <span className="flex gap-2 shrink-0">
                                            {!row.current && <button data-transfer-action="move" onClick={() => onTransfer(row.ref, 'move')}
                                                title={`Move to ${row.label}`} className={actionClass}>Move</button>}
                                            <button data-transfer-action="copy" onClick={() => onTransfer(row.ref, 'copy')}
                                                title={`Copy to ${row.label}`} className="min-h-[44px] px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-600">Copy</button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {!sections.some(s => s.rows.length) && <p className="p-3 text-sm text-slate-400">No destinations yet. Create one below.</p>}
                    </div>
                    {!(wrapper && source.isGroup) && <button data-transfer-create onClick={() => setCreating(true)} className="flex items-center gap-2 w-full rounded-lg border border-dark-600 bg-dark-700 p-3 text-sm hover:bg-dark-600"><Plus size={16} />New destination</button>}
                </>}
                {creating && <form data-transfer-create-form onSubmit={event => event.preventDefault()} className="space-y-3">
                    {!wrapper && <label className="block text-sm">Destination type
                        <select name="destinationKind" value={kind} onChange={event => { setKind(event.target.value); setGroupId('') }} className={fieldClass}>
                            <option value="character">Character</option><option value="environment">Environment category</option>
                            <option value="groupCharacter">Character in a group</option><option value="groupCategory">Category in a group</option>
                            <option value="newGroupCharacter">New group with a character</option><option value="newGroupCategory">New group with a category</option>
                        </select>
                    </label>}
                    {!wrapper && needsGroup && <label className="block text-sm">Group
                        <select name="destinationGroup" value={groupId || compatibleGroups[0]?.id || ''} onChange={event => setGroupId(event.target.value)} className={fieldClass}>
                            {!compatibleGroups.length && <option value="">No compatible groups</option>}
                            {compatibleGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </label>}
                    {!wrapper && newGroup && <label className="block text-sm">Group name<input name="destinationGroupName" value={groupName} onChange={event => setGroupName(event.target.value)} className={fieldClass} /></label>}
                    <label className="block text-sm">{wrapper ? 'New group name' : 'Character or category name'}
                        <input name="destinationName" value={name} onChange={event => setName(event.target.value)} className={fieldClass} required />
                    </label>
                    <p className="text-xs text-slate-400">The destination is created when you choose Move or Copy. Cancel leaves the board unchanged.</p>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => setCreating(false)} className="px-3 py-2 rounded-lg bg-dark-700">Cancel creation</button>
                        <button type="button" data-transfer-create-action="move" disabled={!name.trim() || (!wrapper && newGroup && !groupName.trim()) || (!wrapper && needsGroup && !compatibleGroups.length)} onClick={() => create('move')} className={actionClass}>Move here</button>
                        <button type="button" data-transfer-create-action="copy" disabled={!name.trim() || (!wrapper && newGroup && !groupName.trim()) || (!wrapper && needsGroup && !compatibleGroups.length)} onClick={() => create('copy')} className={actionClass}>Copy here</button>
                    </div>
                </form>}
            </div>
        </div>
    )
}
