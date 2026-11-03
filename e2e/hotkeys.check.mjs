import assert from 'node:assert/strict'
import { zipSync, unzipSync, strToU8 } from 'fflate'
import { emptyHotkeys, allowedHotkeyCode, inspectHotkeys, requireHotkeys, hotkeyTargets, resolveHotkey, refreshHotkeys, hotkeyEventAllowed, hotkeyModifiers, hotkeySignature, hotkeyLabel } from '../src/hotkeys.js'

let passed = 0
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }
const binding = { id: 'hk_1', code: 'Digit1', label: '1', displayName: 'Fireball',
  target: { soundId: 's1', containerType: 'character', containerId: 'c1', groupId: null } }
const payload = { version: 1, bindings: [binding] }
const event = extra => ({ code: 'Digit1', key: '1', target: null, ...extra })
for (const code of ['KeyA', 'KeyZ', 'Digit0', 'Digit9', 'Numpad0', 'Numpad9', 'Slash', 'F1', 'F10', 'NumpadAdd', 'BracketLeft']) {
  await check(`allowed ${code}`, () => assert.equal(allowedHotkeyCode(code), true))
}
for (const code of ['Space', 'Enter', 'Escape', 'Tab', 'ArrowLeft', 'F5', 'F11', 'F12', 'ShiftLeft', '', null, 'KeyAA']) {
  await check(`reserved ${code}`, () => assert.equal(allowedHotkeyCode(code), false))
}
await check('absent storage means empty', () => assert.deepEqual(inspectHotkeys(null).payload, emptyHotkeys()))
await check('valid payload round trips', () => assert.deepEqual(requireHotkeys(JSON.stringify(payload)), payload))
for (const raw of ['bad json', '{}', { version: 99, bindings: [binding] }, { version: 1, bindings: {} }]) {
  await check(`unsupported format stays locked ${JSON.stringify(raw)}`, () => {
    const state = inspectHotkeys(raw); assert.equal(state.locked, true); assert.ok(state.error); assert.deepEqual(state.payload.bindings, [])
    assert.throws(() => requireHotkeys(raw))
  })
}
for (const change of [{ id: '' }, { code: 'Space' }, { label: '' }, { displayName: '' }, { target: null },
  { target: { ...binding.target, soundId: '' } }, { target: { ...binding.target, containerType: 'bogus' } },
  { target: { ...binding.target, containerId: '' } }, { target: { ...binding.target, containerType: 'group', groupId: null } }]) {
  await check(`invalid row disabled ${JSON.stringify(change)}`, () => {
    const state = inspectHotkeys({ version: 1, bindings: [{ ...binding, ...change }] }); assert.ok(state.error); assert.equal(state.payload.bindings.length, 0)
  })
}
await check('both duplicate keys disabled', () => assert.equal(inspectHotkeys({ version: 1, bindings: [binding, { ...binding, id: 'hk_2' }] }).payload.bindings.length, 0))
await check('both duplicate binding ids disabled', () => assert.equal(inspectHotkeys({ version: 1, bindings: [binding, { ...binding, code: 'KeyA' }] }).payload.bindings.length, 0))
await check('valid rows recoverable beside invalid ones', () => assert.deepEqual(inspectHotkeys({ version: 1, bindings: [binding, null] }).payload, payload))
await check('unmodified event accepted', () => assert.equal(hotkeyEventAllowed(event()), true))
for (const field of ['defaultPrevented', 'repeat', 'isComposing', 'metaKey']) {
  await check(`event rejected ${field}`, () => assert.equal(hotkeyEventAllowed(event({ [field]: true })), false))
}
for (const key of ['Dead', 'Process', 'Unidentified']) {
  await check(`event rejected ${key}`, () => assert.equal(hotkeyEventAllowed(event({ key })), false))
}
await check('legacy IME code rejected', () => assert.equal(hotkeyEventAllowed(event({ keyCode: 229 })), false))
await check('numpad navigation without Num Lock remains reserved', () => assert.equal(hotkeyEventAllowed(event({ code: 'Numpad1', key: 'End' })), false))
await check('AltGraph rejected', () => assert.equal(hotkeyEventAllowed(event({ getModifierState: key => key === 'AltGraph' })), false))
await check('editable ancestor rejected', () => assert.equal(hotkeyEventAllowed(event({ target: { closest: () => ({}) } })), false))
await check('contenteditable rejected', () => assert.equal(hotkeyEventAllowed(event({ target: { isContentEditable: true } })), false))
await check('composed path editable rejected', () => assert.equal(hotkeyEventAllowed(event({ composedPath: () => [null, { isContentEditable: true }] })), false))
await check('recording does not bypass input suppression', () => assert.equal(hotkeyEventAllowed(event({ target: { isContentEditable: true } }), { recording: true }), false))
for (let modifiers = 0; modifiers < 8; modifiers++) {
  const chord = { ...binding, modifiers }
  await check(`modifier mask ${modifiers} round trips`, () => assert.deepEqual(requireHotkeys({ version: 2, bindings: [chord] }).bindings[0], chord))
  await check(`modifier mask ${modifiers} dispatch accepted`, () => assert.equal(hotkeyEventAllowed(event({ ctrlKey: !!(modifiers & 1), altKey: !!(modifiers & 2), shiftKey: !!(modifiers & 4) })), true))
  await check(`modifier mask ${modifiers} signature exact`, () => assert.equal(hotkeySignature(chord), hotkeySignature({ code: 'Digit1', modifiers: hotkeyModifiers({ ctrlKey: !!(modifiers & 1), altKey: !!(modifiers & 2), shiftKey: !!(modifiers & 4) }) })))
}
await check('same physical key with different modifiers coexists', () => assert.equal(requireHotkeys({ version: 2, bindings: [binding, { ...binding, id: 'ctrl', modifiers: 1 }] }).bindings.length, 2))
await check('duplicate chord disables every participant', () => assert.equal(inspectHotkeys({ version: 2, bindings: [{ ...binding, modifiers: 1 }, { ...binding, id: 'other', modifiers: 1 }] }).payload.bindings.length, 0))
await check('legacy version cannot silently carry a chord', () => assert.ok(inspectHotkeys({ version: 1, bindings: [{ ...binding, modifiers: 1 }] }).error))
await check('modifier label names every modifier', () => assert.equal(hotkeyLabel('KeyA', 'a', 7), 'Ctrl+Alt+Shift+A'))
for (const modifiers of [-1, 8, 1.5, '1', null]) await check(`invalid modifier mask ${modifiers}`, () => assert.ok(inspectHotkeys({ version: 2, bindings: [{ ...binding, modifiers }] }).error))
for (const [code, extra] of [['KeyW', { ctrlKey: true }], ['KeyR', { ctrlKey: true }], ['F4', { altKey: true }], ['KeyI', { ctrlKey: true, shiftKey: true }]]) {
  await check(`reserved shortcut ${code}`, () => assert.equal(hotkeyEventAllowed(event({ code, ...extra })), false))
  await check(`stored reserved shortcut ${code} refused`, () => assert.ok(inspectHotkeys({ version: 2, bindings: [{ ...binding, code, modifiers: hotkeyModifiers(extra) }] }).error))
}
const containers = ['character', 'environment', 'groupCharacter', 'group', 'groupTop'].map((type, i) => ({
  containerType: type, containerId: `c${i}`, groupId: i > 1 ? 'g' : null, label: type, sounds: [{ id: `s${i}`, name: type }],
}))
for (const container of containers) {
  await check(`target shape ${container.containerType}`, () => {
    const target = hotkeyTargets([container])[0]; assert.equal(resolveHotkey({ target: target.target }, [target]), target)
    assert.equal(inspectHotkeys({ version: 1, bindings: [{ ...binding, target: target.target }] }).error, '')
  })
}
await check('rename and move retain sound identity', () => {
  const moved = hotkeyTargets([{ ...containers[3], label: 'New location', sounds: [{ id: 's1', name: 'Renamed' }] }])
  assert.equal(resolveHotkey(binding, moved).sound.name, 'Renamed')
})
await check('copy never steals original binding', () => assert.equal(resolveHotkey(binding, hotkeyTargets([{ ...containers[0], sounds: [{ id: 'copy', name: 'Fireball' }] }])), null))
await check('deleted target is unresolved', () => assert.equal(resolveHotkey(binding, []), null))
await check('saved and exported metadata follows resolved sound without losing unresolved snapshots', () => {
  const targets = hotkeyTargets([{ ...containers[3], sounds: [{ id: 's1', name: 'Renamed' }] }])
  assert.equal(refreshHotkeys(payload, targets).bindings[0].displayName, 'Renamed')
  assert.equal(refreshHotkeys(payload, targets).bindings[0].target.containerType, 'group')
  assert.deepEqual(refreshHotkeys(payload, []), payload)
})
await check('duplicate sound ids are ambiguous', () => {
  const targets = hotkeyTargets([{ ...containers[0], sounds: [{ id: 's1' }, { id: 's1' }] }]); assert.equal(resolveHotkey(binding, targets), null)
})

// Actual bundle/storage paths, with isolated deterministic stores.
const values = new Map()
const ls = { get length() { return values.size }, key: i => [...values.keys()][i] ?? null,
  getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }
globalThis.window = { localStorage: ls }
const storage = await import('../src/profileStorage.js')
const bundle = await import('../src/profileBundle.js')
const p = storage.createProfile('Hotkeys', '3')
storage.setActiveProfile(p)
storage.writeProfileValue(p, 'ttrpg_hotkeys', JSON.stringify(payload))
const blobs = { read: async () => null, write: async () => {} }
const collect = () => bundle.collectProfileForExport({ parse: key => storage.readProfileValue(p, key) })
await check('export collection reads scoped bindings', () => assert.deepEqual(collect().data.hotkeys, payload))
await check('export refuses unknown data without overwriting', () => {
  const raw = JSON.stringify({ version: 99, bindings: [binding] }); storage.writeProfileValue(p, 'ttrpg_hotkeys', raw)
  assert.throws(collect); assert.equal(storage.readProfileValue(p, 'ttrpg_hotkeys'), raw)
  storage.writeProfileValue(p, 'ttrpg_hotkeys', JSON.stringify(payload))
})
const exported = await bundle.exportBundle({ profileId: p, profileName: 'Hotkeys', data: { characters: [], environmentSounds: [], groups: [], hotkeys: payload }, settings: {}, store: blobs })
const importOptions = { normalize: (_key, value) => value, dataVersion: '3', store: blobs, setActive: false }
await check('current bundle format prevents pre-hotkey readers stripping keys', () => { assert.equal(exported.manifest.formatVersion, bundle.BUNDLE_FORMAT_VERSION); assert.ok(exported.manifest.formatVersion >= 2) })
await check('new-profile round trip preserves bindings and ids', async () => {
  const result = await bundle.importBundle(exported.bytes, importOptions)
  assert.notEqual(result.profileId, p); assert.deepEqual(JSON.parse(storage.readProfileValue(result.profileId, 'ttrpg_hotkeys')), payload)
})
await check('modifier payload survives export and import', async () => {
  const chords = { version: 2, bindings: [{ ...binding, modifiers: 7, label: 'Ctrl+Alt+Shift+1' }] }
  const bytes = await bundle.exportBundle({ profileId: p, profileName: 'Chords', data: { characters: [], environmentSounds: [], groups: [], hotkeys: chords }, settings: {}, store: blobs })
  const result = await bundle.importBundle(bytes.bytes, importOptions)
  assert.deepEqual(JSON.parse(storage.readProfileValue(result.profileId, 'ttrpg_hotkeys')), chords)
})
await check('merge preserves destination bindings', async () => {
  await bundle.importBundle(exported.bytes, { ...importOptions, mode: 'merge', targetProfileId: p })
  assert.deepEqual(JSON.parse(storage.readProfileValue(p, 'ttrpg_hotkeys')), payload)
})
const changeBundle = (changeData, format = 2) => {
  const zip = unzipSync(exported.bytes), data = JSON.parse(new TextDecoder().decode(zip['data.json']))
  changeData(data); zip['data.json'] = strToU8(JSON.stringify(data))
  const manifest = JSON.parse(new TextDecoder().decode(zip['manifest.json'])); manifest.formatVersion = format
  zip['manifest.json'] = strToU8(JSON.stringify(manifest)); return zipSync(zip)
}
await check('v1 bundle without bindings creates a profile with empty bindings', async () => {
  const legacy = changeBundle(data => { delete data.hotkeys }, 1)
  const imported = await bundle.importBundle(legacy, { ...importOptions, mode: 'new' })
  assert.deepEqual(JSON.parse(storage.readProfileValue(imported.profileId, 'ttrpg_hotkeys')), emptyHotkeys())
  assert.deepEqual(JSON.parse(storage.readProfileValue(p, 'ttrpg_hotkeys')), payload)
})
await check('snapshot restores bindings byte for byte', () => {
  storage.writeProfileValue(p, 'ttrpg_hotkeys', JSON.stringify(payload)); const snapshot = bundle.snapshotProfile(p)
  storage.writeProfileValue(p, 'ttrpg_hotkeys', '{}'); bundle.restoreProfileSnapshot(snapshot)
  assert.equal(storage.readProfileValue(p, 'ttrpg_hotkeys'), JSON.stringify(payload))
})
await check('invalid bundle refuses before creating profile or writing keys', async () => {
  const before = [...values.entries()]
  await assert.rejects(bundle.importBundle(changeBundle(data => { data.hotkeys.version = 99 }), importOptions), /invalid or unsupported hotkeys/)
  assert.deepEqual([...values.entries()], before)
})
await check('failed native blob import preserves destination profile bindings', async () => {
  const bytes = await bundle.exportBundle({ profileId: p, profileName: 'Upload', data: {
    characters: [{ id: 'c', sounds: [{ id: 's', files: [{ name: 'u.wav', displayName: 'u.wav', storedName: 'u.wav' }] }] }],
    environmentSounds: [], groups: [], hotkeys: payload }, settings: {}, store: { read: async () => new Uint8Array([1, 2, 3]) } })
  const before = storage.readProfileValue(p, 'ttrpg_hotkeys')
  await assert.rejects(bundle.importBundle(bytes.bytes, { ...importOptions, mode: 'merge', targetProfileId: p,
    store: { write: async () => { throw new Error('Injected write failure') } } }), /nothing was imported/)
  assert.equal(storage.readProfileValue(p, 'ttrpg_hotkeys'), before)
})
await check('deleting profile removes bindings only from that namespace', () => {
  const other = storage.createProfile('Other', '3'); storage.writeProfileValue(other, 'ttrpg_hotkeys', JSON.stringify(payload))
  storage.deleteProfile(other); assert.equal(storage.readProfileValue(other, 'ttrpg_hotkeys'), null)
  assert.equal(storage.readProfileValue(p, 'ttrpg_hotkeys'), JSON.stringify(payload))
})
await check('binding key write failure restores the entire pre-merge snapshot', async () => {
  storage.writeProfileValue(p, 'ttrpg_characters', JSON.stringify([{ id: 'old', sounds: [] }]))
  // Force an actual binding write: atomic commits correctly skip byte-identical
  // keys. Preserve meaningful existing bindings and verify exact old bytes.
  storage.writeProfileValue(p, 'ttrpg_hotkeys', JSON.stringify(payload, null, 2))
  const before = bundle.snapshotProfile(p).keys, set = ls.setItem
  let injected = false
  ls.setItem = (key, value) => {
    if (key === `profile:${p}:ttrpg_hotkeys` && !injected) { injected = true; throw new Error('Injected key-write failure') }
    set(key, value)
  }
  try { await assert.rejects(bundle.importBundle(exported.bytes, { ...importOptions, mode: 'merge', targetProfileId: p }), /previous profile was preserved/) }
  finally { ls.setItem = set }
  assert.equal(injected, true); assert.deepEqual(bundle.snapshotProfile(p).keys, before)
})
await check('binding key write failure removes a partially created new profile', async () => {
  const before = storage.readProfileIndex().profiles.map(profile => profile.id), active = storage.getActiveProfileId(), set = ls.setItem
  let failedId
  ls.setItem = (key, value) => {
    if (key.endsWith(':ttrpg_hotkeys') && !key.startsWith(`profile:${p}:`)) { failedId = storage.profileIdFromScopedKey(key); throw new Error('Injected new-profile failure') }
    set(key, value)
  }
  try { await assert.rejects(bundle.importBundle(exported.bytes, importOptions), /previous profile was preserved/) }
  finally { ls.setItem = set }
  assert.ok(failedId); assert.deepEqual(storage.profileKeys(failedId), [])
  assert.deepEqual(storage.readProfileIndex().profiles.map(profile => profile.id), before); assert.equal(storage.getActiveProfileId(), active)
})
console.log(`hotkeys: ${passed}/${passed} PASS, 0 FAIL`)
