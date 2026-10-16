// Node-level checks for src/bundleGuard.js.
//
// Exists because the guard fixes a UI latch that only showed up on real
// hardware, and the two paths that matter most are exactly the ones a browser
// spec cannot easily reach: a promise that NEVER settles, and a cancel that
// arrives after the work already finished. No browser, no CDP - runs in well
// under a second, like profileBundle.check.mjs.
//
//   node e2e/bundleGuard.check.mjs

import { boundedBundleStep, BUNDLE_STEP_TIMEOUT_MS, BundleStepError } from '../src/bundleGuard.js'

let passed = 0
let failed = 0

const check = (name, cond, detail = '') => {
    if (cond) { passed++; console.log(`  ok   ${name}`) }
    else { failed++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`) }
}

const settleWithin = (promise, ms) => Promise.race([
    promise.then(v => ({ kind: 'resolved', value: v })),
    new Promise(r => setTimeout(() => r({ kind: 'never' }), ms)),
])

const never = () => new Promise(() => { /* deliberately never settles */ })
const after = (ms, value) => new Promise(r => setTimeout(() => r(value), ms))
const rejectsWith = async (promise) => {
    try { await promise; return { code: null } } catch (e) { return { code: e?.code, message: String(e?.message || '') } }
}

console.log('bundleGuard: a hung step must stop being waited on')

// --- the normal path -------------------------------------------------------
{
    const seen = []
    const step = boundedBundleStep(() => after(5, 'bytes'), { timeoutMs: 5000, onPendingChange: p => seen.push(p) })
    const r = await settleWithin(step.promise, 1000)
    check('a step that completes resolves with its value', r.kind === 'resolved' && r.value === 'bytes', JSON.stringify(r))
    check('pending is announced then cleared', JSON.stringify(seen) === '[true,false]', JSON.stringify(seen))
    check('settled() is true afterwards', step.settled() === true)
}

// --- TIMEOUT: the actual bug ----------------------------------------------
{
    const step = boundedBundleStep(never, { timeoutMs: 30, what: 'Reading the bundle' })
    const e = await rejectsWith(step.promise)
    check('a promise that never settles is REJECTED, not awaited forever', e.code === 'timeout', `code=${e.code}`)
    check('the timeout message names the step', /Reading the bundle/.test(e.message), e.message)
    check('the timeout message does NOT claim nothing was written',
        !/nothing (was|has been) (written|imported)/i.test(e.message), e.message)
    check('the timeout tells the user the device may still be working',
        /still (be )?finishing|still.*background/i.test(e.message), e.message)
    check('the error is a BundleStepError', e.code === 'timeout')
    check('a timeout leaves the step settled', step.settled() === true)
}

// --- CANCEL ---------------------------------------------------------------
{
    const step = boundedBundleStep(never, { timeoutMs: 10000, what: 'Importing the bundle' })
    step.cancel()
    const e = await rejectsWith(step.promise)
    check('cancel rejects the wait', e.code === 'cancelled', `code=${e.code}`)
    check('the cancel message tells the user to reopen the app',
        /reopen the app/i.test(e.message), e.message)
}

// --- late resolution must not become an unhandled rejection ---------------
{
    let unhandled = 0
    const onUnhandled = () => { unhandled++ }
    process.on('unhandledRejection', onUnhandled)
    const step = boundedBundleStep(() => after(60, 'late'), { timeoutMs: 20 })
    const e = await rejectsWith(step.promise)
    await after(120, null)
    process.off('unhandledRejection', onUnhandled)
    check('a late resolution after a timeout is swallowed', e.code === 'timeout' && unhandled === 0, `unhandled=${unhandled}`)
}

// --- cancel after completion is inert -------------------------------------
{
    const step = boundedBundleStep(() => after(5, 'done'), { timeoutMs: 5000 })
    const r = await settleWithin(step.promise, 1000)
    step.cancel()
    const after2 = await settleWithin(step.promise, 50)
    check('cancel after completion changes nothing', r.kind === 'resolved' && after2.kind === 'resolved')
    check('a settled step reports settled', step.settled() === true)
}

// --- the picker itself must NOT be bounded -------------------------------
{
    // The design rule: only steps AFTER the picker are wrapped, because the
    // user controls how long they browse. Assert the default is generous
    // enough that an ordinary browse cannot trip it.
    check('the production timeout is generous (30s+)', BUNDLE_STEP_TIMEOUT_MS >= 30000, `${BUNDLE_STEP_TIMEOUT_MS}ms`)
    // A step given timeoutMs: 0 must wait indefinitely.
    const step = boundedBundleStep(() => after(60, 'slow but fine'), { timeoutMs: 0 })
    const r = await settleWithin(step.promise, 500)
    check('timeoutMs 0 disables the timeout entirely', r.kind === 'resolved' && r.value === 'slow but fine', JSON.stringify(r))
}

// --- errors from makePromise itself ---------------------------------------
{
    const boom = new Error('disk on fire')
    const step = boundedBundleStep(() => { throw boom }, { timeoutMs: 5000 })
    let caught = null
    try { await step.promise } catch (e) { caught = e }
    check('a synchronous throw from the work surfaces unchanged', caught === boom)
}
{
    const boom = new Error('ipc exploded')
    const step = boundedBundleStep(() => Promise.reject(boom), { timeoutMs: 5000 })
    let caught = null
    try { await step.promise } catch (e) { caught = e }
    check('a rejected promise surfaces unchanged', caught === boom)
}

// --- a custom cancel reason is honoured -----------------------------------
{
    const step = boundedBundleStep(never, { timeoutMs: 10000 })
    step.cancel('custom reason')
    const e = await rejectsWith(step.promise)
    check('a custom cancel reason is used', e.message === 'custom reason', e.message)
    check('BundleStepError is exported and carries its code', new BundleStepError('x', 'timeout').code === 'timeout')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)