import assert from 'node:assert/strict'
import { nativeShortcutCode, globalChordError, globalAccelerator, globalSignature } from '../src/globalKeys.js'
import { inspectHotkeys, requireHotkeys, resolveHotkey, refreshHotkeys } from '../src/hotkeys.js'
import { createGlobalShortcutRegistry } from '../src/globalShortcuts.js'

let passed = 0
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }
const row = { id: 'global', code: 'KeyB', modifiers: 5, label: 'Ctrl+Shift+B', displayName: 'Boom', global: true, globalCode: 'KeyB',
    target: { soundId: 'boom', containerType: 'character', containerId: 'hero', groupId: null } }
const data = bindings => ({ version: 3, bindings })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function harness(overrides = {}, options = {}) {
    const calls = [], handlers = [], fired = [], snapshots = []
    const api = { unregisterAll: async () => { calls.push('clear') }, register: async (key, handler) => { calls.push(key); handlers.push(handler) }, ...overrides }
    const registry = createGlobalShortcutRegistry(async () => api, options)
    const request = (owner, rows = [row]) => registry.request(owner, rows, id => fired.push(`${owner}:${id}`), snapshot => snapshots.push(snapshot))
    return { registry, calls, handlers, fired, snapshots, request, api }
}

for (const [vk, expected] of [[65,'KeyA'],[90,'KeyZ'],[48,'Digit0'],[57,'Digit9'],[96,'Numpad0'],[105,'Numpad9'],[112,'F1'],[121,'F10'],[186,'Semicolon'],[222,'Quote'],[107,'NumpadAdd']]) {
    await check(`Windows virtual key ${vk}`, () => assert.equal(nativeShortcutCode({ keyCode: vk }), expected))
}
for (const vk of [undefined, null, '65', 65.5, 229, 116, 13, 226]) await check(`unsupported native key ${vk}`, () => assert.equal(nativeShortcutCode({ keyCode: vk }), null))
await check('layout mapping follows native VK rather than physical code or glyph', () => {
    assert.equal(nativeShortcutCode({ code:'KeyQ', key:'a', keyCode:65 }), 'KeyA')
    assert.equal(nativeShortcutCode({ code:'Quote', key:'i', keyCode:222 }), 'Quote')
})
await check('version3 global binding round trips', () => assert.deepEqual(requireHotkeys(data([row])), data([row])))
await check('legacy version cannot silently carry global state', () => assert.ok(inspectHotkeys({ version:2, bindings:[row] }).error))
await check('newer version stays locked', () => assert.equal(inspectHotkeys({ version:4, bindings:[row] }).locked, true))
for (const modifiers of [0, 3, 4, 7]) await check(`unsafe global modifier mask ${modifiers}`, () => assert.ok(inspectHotkeys(data([{ ...row, modifiers }])).error))
for (const modifiers of [1, 2, 5, 6]) await check(`global modifier mask ${modifiers}`, () => assert.equal(globalChordError({ ...row, modifiers }), ''))
await check('native reserved key cannot hide behind a different physical code', () => assert.ok(inspectHotkeys(data([{ ...row, globalCode:'KeyT' }])).error))
await check('local reserved native metadata remains valid when its physical chord is allowed', () => assert.equal(inspectHotkeys(data([{ ...row, global:false, globalCode:'KeyT' }])).error, ''))
await check('native collisions disable every participant even with different physical codes', () => assert.equal(inspectHotkeys(data([row,{ ...row,id:'other',code:'KeyQ' }])).payload.bindings.length, 0))
await check('global accelerator includes exact modifiers and native code', () => assert.equal(globalAccelerator(row), 'Control+Shift+KeyB'))
await check('global signature distinguishes modifier masks', () => assert.notEqual(globalSignature(row), globalSignature({ ...row, modifiers:1 })))
await check('malformed dormant native metadata refuses explicit save', () => assert.ok(inspectHotkeys(data([{ ...row,global:false,globalCode:{} }])).error))
await check('macro and sound targets cannot be mixed', () => assert.ok(inspectHotkeys(data([{ ...row,target:{ ...row.target,macroId:'m' } }])).error))
await check('macro targets round trip independently of sound ids', () => {
    const binding = { ...row,target:{macroId:'m'} }
    assert.deepEqual(requireHotkeys(data([binding])).bindings[0].target,{macroId:'m'})
    assert.equal(resolveHotkey(binding,[{sound:{id:'m'},target:row.target}]), null)
})
await check('explicit unresolved target cannot accidentally resolve by reused id', () => assert.equal(resolveHotkey({ ...row,target:{...row.target,unresolved:true}},[{sound:{id:'boom'},target:row.target}]),null))
await check('metadata refresh preserves native registration fields', () => assert.equal(refreshHotkeys(data([row]),[{sound:{id:'boom',name:'Renamed'},target:row.target}]).bindings[0].globalCode,'KeyB'))
await check('too many bindings stays locked rather than truncating', () => assert.equal(inspectHotkeys(data(Array(501).fill(row))).locked,true))

await check('registration clears stale native keys before setup and only fires Pressed', async () => {
    const h=harness(); h.request('A'); await flush()
    assert.deepEqual(h.calls,['clear','Control+Shift+KeyB'])
    h.handlers[0]({state:'Released'}); h.handlers[0]({state:'Pressed'}); h.handlers[0]({state:'Pressed'})
    assert.deepEqual(h.fired,['A:global','A:global']) // No release latch: native MOD_NOREPEAT owns repeat suppression.
})
await check('active global event suppresses local dispatch regardless of physical code', async () => {
    const h=harness(); h.request('A'); await flush()
    assert.equal(h.registry.owns('A',{code:'KeyQ',keyCode:66,ctrlKey:true,shiftKey:true}),true)
    assert.equal(h.registry.owns('A',{keyCode:66,ctrlKey:true}),false)
    assert.equal(h.registry.owns('B',{keyCode:66,ctrlKey:true,shiftKey:true}),false)
})
await check('profile switch fences old callback synchronously and registers new owner', async () => {
    const h=harness(); h.request('A'); await flush(); const old=h.handlers[0]
    h.request('B'); old({state:'Pressed'}); await flush(); h.handlers[1]({state:'Pressed'})
    assert.deepEqual(h.fired,['B:global'])
})
await check('paused owner clears registration and old callbacks stay inert', async () => {
    const h=harness(); h.request('A'); await flush(); h.request('A',[]); h.handlers[0]({state:'Pressed'}); await flush()
    assert.deepEqual(h.fired,[]); assert.deepEqual(h.calls,['clear','Control+Shift+KeyB','clear'])
})
await check('teardown clears registration and stale channels cannot fire', async () => {
    const h=harness(); const release=h.request('A'); await flush(); release(); h.handlers[0]({state:'Pressed'}); await flush()
    assert.deepEqual(h.fired,[]); assert.equal(h.calls.at(-1),'clear')
})
await check('old cleanup cannot remove a newer requested owner', async () => {
    const h=harness(); const release=h.request('A'); await flush(); h.request('B'); release(); await flush(); h.handlers.at(-1)({state:'Pressed'})
    assert.deepEqual(h.fired,['B:global'])
})
await check('registration failure is visible and allows focused local fallback', async () => {
    const h=harness({register:async()=>{throw Error('in use')}}); h.request('A'); await flush()
    assert.equal(h.snapshots.at(-1).global.state,'error')
    assert.equal(h.registry.owns('A',{keyCode:66,ctrlKey:true,shiftKey:true}),false)
})
await check('failed native cleanup prevents any new registration', async () => {
    const h=harness({unregisterAll:async()=>{throw Error('cleanup')}}); h.request('A'); await flush()
    assert.equal(h.handlers.length,0); assert.equal(h.snapshots.at(-1).__system.state,'error')
})
await check('hung registration serializes new profile work and fences late callback', async () => {
    const gate=deferred(), timers=new Map(); let timerId=0
    const h=harness({}, {setTimer:fn=>{timers.set(++timerId,fn);return timerId},clearTimer:id=>timers.delete(id)})
    const register=h.api.register; let first=true
    h.api.register=async(key,handler)=>{await register(key,handler);if(first){first=false;await gate.promise}}
    h.request('A'); await flush(); for(const fn of [...timers.values()])fn()
    assert.equal(h.snapshots.at(-1).global.state,'error')
    h.request('B'); await flush(); assert.equal(h.calls.length,2)
    h.handlers[0]({state:'Pressed'}); gate.resolve(); await flush(); h.handlers.at(-1)({state:'Pressed'})
    assert.deepEqual(h.calls,['clear','Control+Shift+KeyB','clear','Control+Shift+KeyB']); assert.deepEqual(h.fired,['B:global'])
})
console.log(`globalShortcuts: ${passed}/${passed} PASS`)
