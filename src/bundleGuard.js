// Bounded execution for the steps that follow a native file picker.
//
// Why this exists: on 2026-10-16 an Android import latched the UI on
// "Importing..." forever - no error, no way out, nothing imported. Five
// candidate causes were tested and rejected, so the cause is still unknown.
// The latch itself is the defect, and it must not depend on finding the cause:
// a hung Tauri IPC cannot be aborted (there is no handle for it), so the only
// honest repair is to stop WAITING and say that the platform call may still
// finish.
//
// Two rules that shaped this:
//   1. The NATIVE PICKER IS NEVER TIMED OUT. The user is in control of how long
//      they browse for a file; a timeout there would fire during ordinary,
//      deliberate use. Only the steps AFTER the picker are bounded.
//   2. The timeout message must not claim nothing was written. It cannot know
//      that - `importBundle` commits its keys last, so an abandoned wait can
//      still land. The wording says the device may still be working.
//
// Pure and dependency-free so `e2e/bundleGuard.check.mjs` can drive every path
// in node, including the two that are awkward to reach in a browser: a promise
// that never settles, and a cancel that arrives after the work already finished.

export const BUNDLE_STEP_TIMEOUT_MS = 30000

export class BundleStepError extends Error {
    constructor(message, code) {
        super(message)
        this.name = 'BundleStepError'
        this.code = code
    }
}

/**
 * Run `makePromise()` under a timeout, with a manual stop.
 *
 * @param {() => Promise<any>} makePromise   called once; a throw is treated as a rejection
 * @param {object} opts
 * @param {number} opts.timeoutMs            0 or less disables the timeout
 * @param {string} opts.what                subject of the message, e.g. "Reading the bundle"
 * @param {(pending: boolean) => void} [opts.onPendingChange]
 * @returns {{ promise: Promise<any>, cancel: (reason?: string) => void, settled: () => boolean }}
 */
export function boundedBundleStep(makePromise, {
    timeoutMs = BUNDLE_STEP_TIMEOUT_MS,
    what = 'This step',
    onPendingChange,
} = {}) {
    let settled = false
    let timer = null
    let cancel = () => {}

    const finish = (fn, arg) => {
        if (settled) return false
        settled = true
        if (timer !== null) { clearTimeout(timer); timer = null }
        cancel = () => {}
        onPendingChange?.(false)
        fn(arg)
        return true
    }

    const promise = new Promise((resolve, reject) => {
        cancel = (reason) => finish(reject, new BundleStepError(
            reason ||
            'Stopped waiting. Close and reopen the app to check whether anything was written.',
            'cancelled'))

        if (timeoutMs > 0) {
            timer = setTimeout(() => finish(reject, new BundleStepError(
                `${what} did not respond within ${Math.round(timeoutMs / 1000)}s, so the app stopped waiting. ` +
                'The device may still be finishing in the background. Reopen the app to see the result.',
                'timeout')), timeoutMs)
        }

        onPendingChange?.(true)

        let started
        try { started = makePromise() } catch (err) { finish(reject, err); return }
        // A late resolution after a timeout/cancel must be swallowed, not
        // surface as an unhandled rejection nobody is listening for any more.
        Promise.resolve(started).then(v => finish(resolve, v), e => finish(reject, e))
    })

    return { promise, cancel: (reason) => cancel(reason), settled: () => settled }
}