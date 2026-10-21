// Pure fade maths for the per-file fade model (FADE_SPEC.md §2, §5).
//
// Split out of App.jsx so a node check can reach it, the same reason iconprep
// splits its maths. Nothing here touches the DOM, an audio element or React,
// which is what makes it assertable in under a second.
//
// The model in one line (§2.1): `audibleEnd = min(fileLength, playUntil)`, and
// both fades measure back from their end of that. With `loop: true` audibleEnd
// is the loop point, so fade-out positions the seam and playUntil positions the
// loop point with no extra rule.

/** A fade/playback duration in seconds. Absent, NaN, negative or 0 all read as 0. */
export const normalizeFadeSeconds = (value) => {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * ~200 steps at any length, rounded UP to a coarse step so a slider stays
 * usable on a long file (§2). `len / 200` rounded up to 0.01 / 0.05 / 0.25 / 1.
 */
export const fadeStep = (fileLength) => {
    const len = Number(fileLength)
    if (!Number.isFinite(len) || len <= 0) return 1
    const raw = len / 200
    for (const step of [0.01, 0.05, 0.25, 1]) {
        if (raw <= step) return step
    }
    // Longer than 200s: keep roughly 200 steps by going to whole seconds.
    return Math.ceil(raw)
}

/**
 * The audible end. `playUntil = 0` means "the whole file" (§7.1), and a
 * playUntil past the file length is capped by it - which is what makes the old
 * "fade scheduled off user-typed duration" no-op unrepresentable.
 *
 * A file whose length is unknown returns the playUntil as-is: the caller hides
 * the controls rather than scheduling anything.
 */
export const audibleEnd = (fileLength, playUntil) => {
    const len = Number(fileLength)
    const until = normalizeFadeSeconds(playUntil)
    // 0 is the sentinel for "no cap", not a zero-length window.
    if (until <= 0) return Number.isFinite(len) && len > 0 ? len : 0
    if (!Number.isFinite(len) || len <= 0) return until
    return Math.min(len, until)
}

/**
 * The ONE red state (§2.4): `fadeIn + fadeOut >= audibleEnd`, i.e. the file never
 * holds full volume. Nothing else is graded - a 0.4s fade on a 2s door slam is
 * legitimate, and marking it red teaches people to ignore the colour.
 *
 * The two wordings differ at exactly equal, because "Fades overlap by 0s" reads
 * as a bug when the fades merely meet.
 */
export const fadeWarning = (fileLength, playUntil, fadeIn, fadeOut) => {
    const len = Number(fileLength)
    if (!Number.isFinite(len) || len <= 0) return { red: false, message: null }
    const end = audibleEnd(len, playUntil)
    const fi = normalizeFadeSeconds(fadeIn)
    const fo = normalizeFadeSeconds(fadeOut)
    if (fi + fo < end) return { red: false, message: null }
    if (Math.abs(fi + fo - end) < 1e-9) {
        return {
            red: true,
            message: `No room for full volume - the fades meet exactly at the end. Ends at ${formatLength(end)} of ${formatLength(len)}.`
        }
    }
    return {
        red: true,
        message: `Fades overlap by ${(fi + fo - end).toFixed(2)}s - this file never holds full volume. Ends at ${formatLength(end)} of ${formatLength(len)}.`
    }
}

/**
 * A short label for a length. "0s", "0.6s", "2s", "2m 32s". Used beside the
 * sliders and in the warning sentence, so it stays consistent with them.
 */
export const formatLength = (seconds) => {
    const s = Number(seconds)
    if (!Number.isFinite(s) || s <= 0) return '0s'
    if (s < 60) {
        const t = Math.round(s * 10) / 10
        return `${Number.isInteger(t) ? t : t.toFixed(1)}s`
    }
    const m = Math.floor(s / 60)
    const r = Math.round(s - m * 60)
    return r ? `${m}m ${r}s` : `${m}m`
}

/**
 * The "Full volume for X of Y." sentence. Returned as `null` when there is
 * nothing worth saying (no fades at all), so the row does not carry dead text.
 */
export const fullVolumeSentence = (fileLength, playUntil, fadeIn, fadeOut) => {
    const len = Number(fileLength)
    if (!Number.isFinite(len) || len <= 0) return null
    const end = audibleEnd(len, playUntil)
    const fi = normalizeFadeSeconds(fadeIn)
    const fo = normalizeFadeSeconds(fadeOut)
    if (fi + fo <= 0) return null
    return `Full volume for ${formatLength(end - fi - fo)} of ${formatLength(end)}.`
}

/**
 * The seam sentence (§7.4). A loop with a fade-in and no fade-out clicks on
 * every repeat; tell the user rather than grading their choice. The mirror
 * case matters too now that a loop's fade-out really does ramp into the seam
 * (§7.2): a fade-out with no fade-in fades to silence and then jumps back to
 * full volume, which is the same click in the other direction.
 */
export const seamSentence = (loop, fadeIn, fadeOut) => {
    if (!loop) return null
    const fi = normalizeFadeSeconds(fadeIn)
    const fo = normalizeFadeSeconds(fadeOut)
    if (fi > 0 && fo <= 0) {
        return 'Fade-in dips on every loop. Add a fade-out to soften the seam.'
    }
    if (fo > 0 && fi <= 0) {
        return 'Fade-out reaches silence at every loop. Add a fade-in to bring the level back.'
    }
    return null
}
