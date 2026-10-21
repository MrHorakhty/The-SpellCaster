// Node-level checks for src/fadeMath.js — the per-file fade model.
//
// The model is three pure functions, and every one of them encodes a decision
// that was argued to in FADE_SPEC.md §2: audibleEnd is ONE line, the red state
// is the ONLY graded state, and nothing may be graded that a user might
// legitimately want. A browser spec can assert the UI renders these; it cannot
// cheaply prove the arithmetic holds at the edges, so it lives here.
//
//   node e2e/fadeMath.check.mjs

import {
    normalizeFadeSeconds,
    fadeStep,
    audibleEnd,
    fadeWarning,
    formatLength,
    fullVolumeSentence,
    seamSentence
} from '../src/fadeMath.js'

let passed = 0
let failed = 0
const check = (name, cond, detail = '') => {
    if (cond) { passed++; console.log(`  ok   ${name}`) }
    else { failed++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`) }
}

console.log('fadeMath: the per-file fade model')

// --- normalizeFadeSeconds: absent and 0 are the same, and 0 is legitimate ----
check('absent, null and undefined all read as 0',
    normalizeFadeSeconds(undefined) === 0 && normalizeFadeSeconds(null) === 0 && normalizeFadeSeconds('') === 0)
check('NaN and negative read as 0', normalizeFadeSeconds(NaN) === 0 && normalizeFadeSeconds(-3) === 0)
check('0 stays 0 (a legitimate "no fade")', normalizeFadeSeconds(0) === 0)
check('a string from an input is coerced, not dropped',
    normalizeFadeSeconds('2.5') === 2.5 && normalizeFadeSeconds('0') === 0)
check('a positive number survives', normalizeFadeSeconds(2.5) === 2.5)

// --- audibleEnd: the one-line model (§2.1) -----------------------------------
check('playUntil 0 means the whole file', audibleEnd(152.4, 0) === 152.4)
check('playUntil inside the file caps the end', audibleEnd(10, 5) === 5)
check('playUntil PAST the file is capped by the file (the old no-op)',
    audibleEnd(0.6, 5) === 0.6)
check('playUntil past the file on a long file is capped',
    audibleEnd(152.4, 999) === 152.4)
check('an unknown file length returns the playUntil, not NaN',
    audibleEnd(0, 5) === 5 && Number.isFinite(audibleEnd(NaN, 2)))
check('an unknown file length with no playUntil is 0', audibleEnd(NaN, 0) === 0)

// --- fadeStep: ~200 steps, rounded up (§2) ----------------------------------
check('a short file gets a 0.01 step', fadeStep(2) === 0.01, `got ${fadeStep(2)}`)
check('a 10s file gets 0.05', fadeStep(10) === 0.05, `got ${fadeStep(10)}`)
check('a 152s file rounds len/200 up to a whole second', fadeStep(152.4) === 1, `got ${fadeStep(152.4)}`)
check('a 300s file still yields ~200 steps', fadeStep(300) === 2, `got ${fadeStep(300)}`)
check('step is never 0 or NaN', fadeStep(0) > 0 && Number.isFinite(fadeStep(NaN)))
check('step grows with the file', fadeStep(400) >= fadeStep(200))

// --- fadeWarning: ONE red state, two wordings (§2.4) ------------------------
// A 0.4s fade on a 2s door slam is legitimate and must NOT be red.
check('a small fade on a short file is NOT red', fadeWarning(2, 0, 0.4, 0).red === false)
check('a 1.5s swell on a 3s cue is NOT red', fadeWarning(3, 0, 0, 1.5).red === false)
check('no fades at all is NOT red', fadeWarning(10, 0, 0, 0).red === false)
check('fadeIn + fadeOut below audibleEnd is NOT red', fadeWarning(10, 10, 2, 3).red === false)
check('fadeIn + fadeOut PAST audibleEnd IS red', fadeWarning(10, 10, 6, 6).red === true)
check('overlap past a playUntil-capped end IS red', fadeWarning(10, 3, 2, 2).red === true)
check('a fade-out measured back from the FILE end is not red',
    fadeWarning(10, 0, 2, 7).red === false, '2s in + 7s out = 9s < the 10s file')
check('exactly equal is red, with the "meet exactly" wording',
    fadeWarning(10, 10, 4, 6).red === true && /meet exactly/.test(fadeWarning(10, 10, 4, 6).message))
check('a real overlap uses the "overlap by" wording',
    /overlap by 2\.00s/.test(fadeWarning(10, 10, 7, 5).message))
check('the message names both ends', /Ends at 10s of 10s/.test(fadeWarning(10, 10, 7, 5).message))
check('an unmeasurable file is never red', fadeWarning(0, 0, 5, 5).red === false)
check('no em dash in the warning (user instruction 2026-10-17)',
    !fadeWarning(10, 10, 7, 5).message.includes('\u2014'))

// --- formatLength -----------------------------------------------------------
check('0 formats as 0s', formatLength(0) === '0s')
check('a sub-second file shows one decimal', formatLength(0.576) === '0.6s', `got ${formatLength(0.576)}`)
check('whole seconds show no decimal', formatLength(2) === '2s')
check('minutes and seconds', formatLength(152) === '2m 32s', `got ${formatLength(152)}`)
check('an exact minute shows no seconds', formatLength(120) === '2m')
check('a non-number shows 0s rather than NaN', formatLength(undefined) === '0s')

// --- fullVolumeSentence (§5) ------------------------------------------------
check('no fades -> no sentence', fullVolumeSentence(10, 0, 0, 0) === null)
check('a fade pair produces the sentence', fullVolumeSentence(10, 0, 2, 3) === 'Full volume for 5s of 10s.')
check('the sentence respects a playUntil cap', fullVolumeSentence(10, 5, 1, 1) === 'Full volume for 3s of 5s.')
check('an unmeasurable file -> no sentence', fullVolumeSentence(0, 0, 1, 1) === null)

// --- seamSentence (§7.4) ----------------------------------------------------
check('no loop -> no seam sentence', seamSentence(false, 2, 0) === null)
check('loop + fade-in + no fade-out warns about the click', /dips on every loop/.test(seamSentence(true, 2, 0)))
check('loop + fade-in + fade-out is clean', seamSentence(true, 2, 1) === null)
check('loop with no fade-in is clean', seamSentence(true, 0, 0) === null)
check('loop + fade-out + no fade-in warns about the silence', /reaches silence/.test(seamSentence(true, 0, 2)))
check('a loop with both fades is clean in both directions', seamSentence(true, 2, 2) === null)
check('the seam sentence carries no em dash (user instruction 2026-10-17)', !/—/.test(seamSentence(true, 2, 0) || ''))

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
