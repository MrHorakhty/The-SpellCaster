// Windows WebView2 keydown.keyCode is the Windows virtual key. Do not infer a
// native key from DOM physical code or a character on a different layout.
// Chromium: third_party/blink/renderer/core/events/keyboard_event.cc.
const punctuation = { 186: 'Semicolon', 187: 'Equal', 188: 'Comma', 189: 'Minus',
    190: 'Period', 191: 'Slash', 192: 'Backquote', 219: 'BracketLeft',
    220: 'Backslash', 221: 'BracketRight', 222: 'Quote',
    106: 'NumpadMultiply', 107: 'NumpadAdd', 109: 'NumpadSubtract',
    110: 'NumpadDecimal', 111: 'NumpadDivide' }

export const reservedHotkeyChord = (code, modifiers) =>
    !!((modifiers & 1) && /^(Key[WTRLPOSHJDNFQ]|F4)$/.test(code) ||
        (modifiers & 2) && code === 'F4' ||
        (modifiers & 1) && (modifiers & 4) && /^(Key[IC]|Escape)$/.test(code))

export function nativeShortcutCode(event) {
    const value = event.keyCode
    if (!Number.isInteger(value)) return null
    if (value >= 65 && value <= 90) return `Key${String.fromCharCode(value)}`
    if (value >= 48 && value <= 57) return `Digit${value - 48}`
    if (value >= 96 && value <= 105) return `Numpad${value - 96}`
    if (value >= 112 && value <= 121 && value !== 116) return `F${value - 111}`
    return punctuation[value] || null
}

export function globalChordError(binding) {
    if (!binding.global) return ''
    if (![1, 2, 5, 6].includes(binding.modifiers)) return 'Global keys need Ctrl or Alt. Ctrl+Alt is reserved for AltGr; use Ctrl+Shift or Alt+Shift instead.'
    if (reservedHotkeyChord(binding.globalCode, binding.modifiers)) return 'This Windows shortcut is reserved. Record another key.'
    if (!supportedGlobalCode(binding.globalCode)) {
        return 'Record this key again on Windows before enabling its global shortcut. This native key may not be supported.'
    }
    return ''
}

export const supportedGlobalCode = code => typeof code === 'string' &&
    (/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|F[1-4]|F[6-9]|F10)$/.test(code) || Object.values(punctuation).includes(code))

export const globalSignature = binding => `${binding.globalCode}:${binding.modifiers || 0}`
export const globalAccelerator = binding => `${binding.modifiers & 1 ? 'Control+' : ''}${binding.modifiers & 2 ? 'Alt+' : ''}${binding.modifiers & 4 ? 'Shift+' : ''}${binding.globalCode}`
