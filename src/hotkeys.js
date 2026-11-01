// Profile-owned physical keys. Validation is shared by storage, bundles and UI.
export const HOTKEYS_KEY = 'ttrpg_hotkeys'
export const emptyHotkeys = () => ({ version: 2, bindings: [] })
export const allowedHotkeyCode = code => typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Decimal|Comma)|Minus|Equal|BracketLeft|BracketRight|Backslash|IntlBackslash|Semicolon|Quote|Backquote|Comma|Period|Slash|F[1-4]|F[6-9]|F10)$/.test(code)
// Mask bits are durable data: Ctrl=1, Alt=2, Shift=4. Meta and AltGraph stay reserved.
export const hotkeyModifiers = event => (event.ctrlKey ? 1 : 0) | (event.altKey ? 2 : 0) | (event.shiftKey ? 4 : 0)
export const hotkeySignature = binding => `${binding.code}:${binding.modifiers || 0}`
export const hotkeyLabel = (code, key, modifiers = 0) =>
    `${modifiers & 1 ? 'Ctrl+' : ''}${modifiers & 2 ? 'Alt+' : ''}${modifiers & 4 ? 'Shift+' : ''}${key?.length === 1 ? key.toLocaleUpperCase() : key || code}`
export const reservedHotkeyChord = (code, modifiers) =>
    !!((modifiers & 1) && /^(Key[WTRLPOSHJDNFQ]|F4)$/.test(code) ||
        (modifiers & 2) && code === 'F4' ||
        (modifiers & 1) && (modifiers & 4) && /^(Key[IC]|Escape)$/.test(code))
const types = new Set(['character', 'environment', 'groupCharacter', 'group', 'groupTop'])
const reservedKeys = new Set(['Dead', 'Process', 'Unidentified', 'Enter', ' ', 'Escape', 'Tab', 'Home', 'End', 'Insert', 'Delete', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 300

export function inspectHotkeys(raw) {
    if (raw == null) return { payload: emptyHotkeys(), error: '', locked: false }
    let value
    try { value = typeof raw === 'string' ? JSON.parse(raw) : raw } catch {
        return { payload: emptyHotkeys(), error: 'Saved hotkeys could not be read. Reset them to start again.', locked: true }
    }
    if (!value || ![1, 2].includes(value.version) || !Array.isArray(value.bindings)) {
        return { payload: emptyHotkeys(), error: 'This hotkey format is unsupported. Update the app or explicitly reset hotkeys.', locked: true }
    }
    const valid = row => row && text(row.id) && allowedHotkeyCode(row.code) && text(row.label) &&
        text(row.displayName) &&
        (row.modifiers === undefined || Number.isInteger(row.modifiers) && row.modifiers >= 0 && row.modifiers <= 7) &&
        (value.version !== 1 || !row.modifiers) && !reservedHotkeyChord(row.code, row.modifiers || 0) && row.target && text(row.target.soundId) &&
        types.has(row.target.containerType) && text(row.target.containerId) &&
        (row.target.groupId === null || text(row.target.groupId)) &&
        (!['group', 'groupCharacter', 'groupTop'].includes(row.target.containerType) || text(row.target.groupId))
    // Disable ALL participants in a collision, rather than arbitrarily firing one.
    const codes = new Map(), ids = new Map()
    for (const row of value.bindings) {
        if (row && typeof row === 'object') {
            codes.set(hotkeySignature(row), (codes.get(hotkeySignature(row)) || 0) + 1)
            ids.set(row.id, (ids.get(row.id) || 0) + 1)
        }
    }
    const bindings = value.bindings.filter(row => valid(row) && codes.get(hotkeySignature(row)) === 1 && ids.get(row.id) === 1)
        .map(row => ({ id: row.id, code: row.code, label: row.label, displayName: row.displayName,
            ...(value.version === 2 ? { modifiers: row.modifiers || 0 } : {}),
            target: { soundId: row.target.soundId, containerType: row.target.containerType,
                containerId: row.target.containerId, groupId: row.target.groupId } }))
    const removed = value.bindings.length - bindings.length
    return { payload: { version: value.version, bindings }, locked: false,
        error: removed ? `${removed} invalid or conflicting hotkey(s) are disabled. Saving a repair replaces those entries; Reset removes all bindings.` : '' }
}

export function requireHotkeys(raw) {
    const result = inspectHotkeys(raw)
    if (result.error) throw new Error(result.error)
    return result.payload
}

export function hotkeyTargets(containers) {
    const targets = []
    for (const container of containers) {
        for (const sound of container.sounds || []) {
            if (!sound || !text(sound.id)) continue
            targets.push({ sound, label: `${container.label} / ${sound.name || 'Unnamed sound'}`,
                target: { soundId: sound.id, containerType: container.containerType,
                    containerId: container.containerId, groupId: container.groupId || null } })
        }
    }
    return targets
}

export function resolveHotkey(binding, targets) {
    const matches = targets.filter(entry => entry.sound.id === binding.target.soundId)
    return matches.length === 1 ? matches[0] : null
}

export function refreshHotkeys(payload, targets) {
    return { ...payload, bindings: payload.bindings.map(binding => {
        const resolved = resolveHotkey(binding, targets)
        return resolved ? { ...binding, target: resolved.target, displayName: resolved.sound.name || 'Unnamed sound' } : binding
    }) }
}

export function hotkeyEventAllowed(event, { recording = false } = {}) {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 ||
        event.metaKey || event.getModifierState?.('AltGraph') ||
        reservedHotkeyChord(event.code, hotkeyModifiers(event)) ||
        reservedKeys.has(event.key) || !allowedHotkeyCode(event.code)) return false
    const path = event.composedPath?.() || [event.target]
    if (path.some(node => node?.isContentEditable || node?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'))) return false
    return recording || (typeof document === 'undefined' || document.visibilityState !== 'hidden')
}
