# Sound Priming — **Build Record** (shipped 2026-10-08)

> **Status: SHIPPED — E2E-verified, not yet hand-tested.** This file is no longer a plan; the design lives in
> `src/App.jsx`. Implementation is in `src/App.jsx` at **~6770 lines** (the line numbers below are current as of
> 2026-10-08; they drift — re-verify before editing).
> **Built**: 2026-10-08 (opencode session, claim held).
> **Verified**: `npx eslint .` 0 errors (3 pre-existing warnings) · `npx vite build` OK ·
> **web E2E 172 PASS / 0 FAIL / 0 WARN** · **Windows E2E 171 PASS / 0 FAIL / 1 WARN** (pre-existing `G5` skip,
> Tauri has no localStorage seed). **Android not run** (no device/emulator attached) — see §8 Open gaps.
> **Related**: `HOTKEYS_SPEC.md` (§5 — a hotkey must fire the primed set through the same chokepoint),
> `PER_SOUND_VOLUME_SPEC.md` (the card slider is a sibling, so the hold/drag conflict is moot as built).

---

## 1. What was built

Right-click (desktop) / press-and-hold (mobile) a sound card to **prime** it. Primed sounds fire **alongside the
next sound you play**, then the whole set is consumed. It is **one-shot and session-only**: nothing is written to
`localStorage`, and it is deliberately **not** profile content.

Everything from the original §0–§6 design landed, with the corrections in §5 below.

---

## 2. The implementation, by concern

### State (App.jsx ~1495–1606)

- `primedSoundIds` (`Set` in state) drives the UI; **`primedRef` is the authority** — see §3, the real bug.
- `firedPrimeIds` + `primeFlashTimerRef` drive the "just fired" flash.
- `primeHoldRef` holds the armed press-and-hold; `suppressNextClickRef` swallows the click a hold's release
  produces.
- `isPrimed(id)`, `togglePrime(id)` (toggles; returns early in `editMode`), `clearAllPrimes()`,
  `flashFiredPrimes(ids)`, `armPrimeHold(id, event)`, `cancelPrimeHold()`.
- A single unmount effect clears the flash timer and the hold timer.

Module constants next to `normalizeSoundVolume` (App.jsx ~710–719): `PRIME_HOLD_MS = 500`,
`PRIME_MOVE_CANCEL_PX = 10`, `PRIME_FLASH_MS = 2000`.

### The gestures (App.jsx ~4119, ~4096, ~4106, plus `armPrimeHold` call first in `onPointerDown`)

- **Right-click** → `onContextMenu`: always `preventDefault()` (cards are `div role="button"`; without it the
  WebView2/browser menu opens over the app), then return early if `editMode || e.pointerType === 'touch'`, else
  `togglePrime(sound.id)`. The **`pointerType === 'touch'` guard is load-bearing** — a long press also raises
  `contextmenu`, so without it the hold primes and then the menu event *un-primes* it.
- **Press-and-hold** → `armPrimeHold` is the first thing in the card's `onPointerDown` (so it runs before the
  edit-mode drag). It **only arms on `event.button === 0`** — a right-click is a `pointerdown` with button 2 *and*
  a `contextmenu`, and arming on both would toggle twice, which (being a toggle) un-primes and reads as "priming
  is broken". On arm it clears `suppressNextClickRef`, then:
  - cancels if the pointer moves more than `PRIME_MOVE_CANCEL_PX` (10px) from the start;
  - cancels on `pointerup` / `pointercancel`;
  - after `PRIME_HOLD_MS` (500ms) sets `suppressNextClickRef = true` and toggles the prime.
  - The move/up/cancel listeners are on **`document`**, not the card, so dragging off still cancels and the card's
    own handlers stay untouched.
- **Click** → `onClick`: returns in `editMode`; if `suppressNextClickRef` is set (a hold already primed), clears
  it and returns without playing; otherwise `playWithPrimes(sound)`. **Keyboard** (`Enter`/`Space`) routes through
  `playWithPrimes` too. `user-select: none` + `-webkit-touch-callout: none` are on the card so the long press
  does not raise the OS text callout.

### One trigger chokepoint (App.jsx ~3793 `stopTrigger`, ~3808 `playWithPrimes`)

```js
const playWithPrimes = async (sound) => {
    if (editMode) return
    const ids = Array.from(primedRef.current)   // read the AUTHORITATIVE ref...
    primedRef.current = new Set()               // ...and consume it SYNCHRONOUSLY,
    setPrimedSoundIds(new Set())                //    before the first await
    const primeGroupId = ids.length > 0 ? mintId('primegroup') : null
    playSound(sound, { primeGroupId })
    flashFiredPrimes(ids.filter(id => id !== sound.id && soundById.has(id)))
    for (const id of ids) {
        if (id === sound.id) continue           // priming A then playing A must not double it
        const primed = soundById.get(id)
        if (!primed) continue                   // deleted since primed - skip, don't break the primary
        playSound(primed, { primeGroupId }).catch(() => {})   // not awaited: fired alongside
    }
}
```

- `soundById` is a `useMemo` Map built from **`allSoundContainers()`** (App.jsx ~2140), so a prime resolves from
  **all five** container shapes — the four real ones plus the vestigial `groups[].sounds`. Do not hand-roll a
  four-shape walker (see the data-model gotcha in `PROJECT_STATE.md`).
- **Stop semantics = stop the whole group.** Every element started by one trigger is stamped with the same
  `audio._primeGroup = options.primeGroupId` (App.jsx ~3598). The card's stop button calls `stopTrigger(sound)`,
  which stops every element sharing that `_primeGroup`; if the sound has no group (played on its own) it falls
  back to `stopSound(sound)`. `stopAllSounds` is unaffected.
- `playSound` already tolerated everything priming throws at it, for free: it no-ops in `editMode`, calls
  `enableAudio()` itself, and gives each instance its own `audioInstanceKey`, so three concurrent sounds need no
  new machinery.

### Visuals (App.jsx ~4214 badge, ~4231 overlay; header buttons ~4748 desktop, ~4994 mobile)

- **Primed badge**: `[data-prime-badge]`, amber `Zap` + "Primed", **top-left** (bottom-right is the loop badge,
  top-right the multi-file badge, bottom-left the stop button, and top-left only carries the delete button in edit
  mode, where priming is off anyway).
- **Tint overlay**: `[data-prime-overlay]`, a **separate element**, not a ring class on the card — the card
  already carries lime rings for playing and drag-over, and two ring-colour classes on one element resolve by
  stylesheet order, not class-attribute order. Amber border when primed, a paler amber at 60% opacity for the
  fired flash. The card also carries `data-primed` / `data-fired` and `aria-pressed`.
- **Clear-all button** appears in both the mobile and desktop headers only while `primedSoundIds.size > 0`, with a
  live count (`Clear N primed sound(s)`), because mis-primes are likely and un-priming card-by-card is a bad
  mid-session recovery.
- **Fired flash is 2000ms, not 1200ms** (see §3).

---

## 3. ⚠️ Real problems found while building — do not regress these

1. **Stale-closure double-consume (the one genuine bug).** `playWithPrimes` originally read the primed set from
   **state**. Two triggers in the same tick (a fast double-click, or click + hotkey) both captured the *same*
   pre-consume closure value, so the primes played **twice** — caught by E2E `P25`. Fixed by making **`primedRef`
   the authority**: read and clear the ref synchronously, before any `await`. React state now only drives the
   re-render. **Lesson: for one-shot consumption, the ref is the source of truth, not state.**
2. **A long press *also* fires `contextmenu`.** Without the `e.pointerType === 'touch'` guard, a touch hold primed
   on the timer and then the menu event un-primed it. Desktop right-click is unaffected (its `pointerType` is
   `mouse`, and it never arms the hold because button 2 is rejected).
3. **A hold's release produces a click that would also play the sound.** `suppressNextClickRef` swallows exactly
   that one click. It is **reset at the start of every new press**, so a leftover flag from an earlier hold cannot
   swallow an unrelated click.
4. **`PRIME_FLASH_MS` was too short at 1200ms.** The flash is the *only* record of what fired (the primed set is
   already gone), so it has to stay up long enough to read; 1.2s was not. Raised to 2000ms. It also happened to sit
   exactly on the E2E `P23d` assertion boundary. Re-triggering **replaces** the flash rather than stacking, so it
   cannot go stale.
5. **The stop button is `isPlaying`-gated** (`{isPlaying && …}`, App.jsx ~4246) and lives *inside* the card, so
   it is a `<button>` inside the `div role="button"`. It calls `e.stopPropagation()` then `stopTrigger(sound)`.

---

## 4. E2E coverage — Suite Q, ids **P17–P34**

Ids continue the **P** series. ⚠️ **`P1`–`P16` were already taken by per-sound volume** — the original spec said
"continue from P1", but volume landed first, so priming starts at **P17**. Suite Q lives in
`e2e/e2e-full.mjs` (inserted before Suite G), driven by `dispatchMouseEvent` (right-click).

| Test | Assertion |
|---|---|
| P17 | right-click primes; badge + overlay + `aria-pressed` all present |
| P18 | right-click does **not** arm the hold timer (no double-toggle) |
| P19 | second right-click un-primes |
| P20 | press-and-hold primes **without playing** |
| P21 | hold + move 40px does **not** prime |
| P22 | edit mode primes by neither gesture |
| P23 / b / c / d | 2 primes + trigger plays all 3 and **one shared `_primeGroup`**; the set is **consumed**; consumed cards flash as fired |
| P24 | the next trigger plays only itself — no residue |
| P25 | rapid double trigger does not double the primes (the stale-closure guard) |
| P26 | playing a primed sound does not double it |
| P27 | stopping the primary stops the **whole** primed group |
| P28 | an unresolvable prime does not break the primary |
| P29a/b/c | no clear button when nothing is primed; it appears with the live count; clearing empties + hides it |
| P30 | `contextmenu` default is prevented |
| P31a | **no new `localStorage` key** for priming |
| P31b | primed state does not survive a reload |
| P32 | primes + fires from an **environment category** |
| P33 | primes + fires from a **group category** |
| P34 | primes + fires from a **group character** |

⚠️ The vestigial `groups[].sounds` **cannot** be tested by seeding + reload: `normalizeStoredData`'s group branch
returns `sounds: []` and folds a legacy array into a `Default` category. `P32`–`P34` cover the shapes that
survive a reload; the five-shape walker itself is `allSoundContainers()`, already regression-guarded by move/copy.

### 4b. Mobile mirror — Suite Q in `e2e-mobile.mjs` (**Q1–Q14**, added 2026-10-10)

Touch has no right-click, so the desktop suite's mouse-driven gestures do **not** exercise the path a phone
uses. `e2e-mobile.mjs` now drives priming with **`Input.dispatchTouchEvent`** (the item §7 had left open),
navigating with the mobile drawer rather than desktop tabs. Same fixture ids as Suite Q on desktop, so a
failure can be compared across platforms:

| Test | Assertion |
|---|---|
| Q1 / Q2 | touch press-and-hold primes (badge + overlay + `aria-pressed`) and does **not** also play |
| Q3 | the primed card stays primed (a late `contextmenu` must not un-prime it) |
| Q4 | hold + 40px move does **not** prime |
| Q5 | edit mode does not prime by touch |
| Q6 / b / c / d | 2 touch primes + a tap play all 3, one shared `_primeGroup`, set **consumed**, cards flash as fired |
| Q7 | rapid double trigger does not double the primes (stale-closure guard) |
| Q8a/b/c | clear-all button lifecycle (absent → live count → clears + hides) |
| Q9 | no new `localStorage` key |
| Q10 | primed state does not survive a reload |
| Q11 | stopping the primary stops the whole primed group |
| Q12 / Q13 / Q14 | primes + fires from an environment category / group category / group character |

⚠️ It is the **emulator's** touch pipeline, not a physical device. ⚠️ A long-press `contextmenu` on a real
device may or may not fire; `Q3` covers the observable consequence (no un-prime) rather than synthesising the
event.

---

## 5. Corrections to the original spec

| Original claim | Reality as built |
|---|---|
| §7 "continue from `P1`" | `P1`–`P16` were taken by volume; priming is **P17**. |
| §2 pseudo-code resolved each id with a per-call `findSoundById` | Built as one `soundById` `useMemo` Map over `allSoundContainers()`. |
| §2/§8 "capture and clear before await" | Correct, and the reason it must be a **ref** — state alone still double-fired (see §3.1). |
| §3 "~450–500ms hold" | Built at **500ms**; move-cancel at **10px** as specified. |
| §3 "hide the affordance in edit mode" | Both gestures early-return in `editMode`; the mutation helper `togglePrime` also guards. |
| §2 "hold on the slider" conflict | **Moot as built** — the volume slider is a *sibling* of the card (settled by per-sound volume), so it neither primes nor plays. |
| §2 "consider refusing to prime a looping sound" | **Allowed, no special-casing.** The card's existing loop badge still shows; `randomPlay` also gets a fresh variant per trigger, left alone. |
| §3 "right-click toggles once" / double-fire trap | Guarded by the `button !== 0` check in `armPrimeHold`; asserted by `P18`. |

---

## 6. Harness / test-fixture traps met this session (they cost real time)

These are **test** problems, recorded because they will recur:

1. **Headed Edge drops injected input while the window is occluded.** A background/minimized Edge window receives
   **no DOM events at all** from `Input.dispatchMouseEvent`, and `document.hasFocus()` still returns `true`, so it
   looks like the app ignoring clicks. Fix in `e2e-full.mjs`: `cdpInput()` calls `Page.bringToFront` before every
   mouse event (44 call sites). **Headless is unaffected** — Phase A passed either way.
2. **`element.click()` is not a user gesture.** web refuses autoplay, `play()` rejects, and `cleanupAudio` removes
   the element from `audioElementsRef` — after which a liveness assertion reads 0 for the wrong reason. Use
   `Input.dispatchMouseEvent` for anything playback-dependent.
3. **The shared seed clip (`Longbow_4.mp3`) is under a second long.** A non-looping trigger fires `ended` →
   `cleanupAudio` and unregisters before a later stop assertion, so `P27` uses **dedicated `loop: true`** sounds
   (`p27_a/b/c`) that never end on their own.
4. **Desktop has no "Groups" tab.** Each group is a tab of its own (`selectGroup`, App.jsx ~5562). Group tab
   buttons also **prefix the group's initial letter** when it has no icon, so their text reads `"TTavern Pack"` —
   `__pick()` matches on an exact text, then a **suffix**, then a title.
5. The Windows phase runs against real user data; both runners snapshot/restore `localStorage` around the suite,
   so a priming test cannot leave anything behind (and priming is session state anyway).

---

## 7. Verification checklist (original §8, as resolved)

- [x] Prime Fireball + Frostbite, then Lay on Hands — all three play (**P23**).
- [x] The primed set is consumed — no residue (**P23c**, **P24**).
- [x] Rapid double trigger does not double-fire (capture-and-clear-before-await, via the ref) — **P25**.
- [x] A primed sound plays once per trigger; pressing a primed sound does not double it — **P26**.
- [x] Un-priming (second gesture) removes it — **P19**.
- [x] Right-click toggles once — no double-fire from the hold timer — **P18**.
- [x] Press-and-hold primes; moving/scrolling cancels it; it does not fire in edit mode — **P20**, **P21**, **P22**.
- [x] The native context menu never appears on a card — **P30**.
- [x] Every reload-surviving container shape works — **P32** (environment category), **P33** (group category),
      **P34** (group character). See §4 re the vestigial `groups[].sounds`.
- [x] Stopping a multi-primed trigger stops all the sounds it started; `stopAllSounds` unaffected — **P27**.
- [x] A primed sound that does not resolve does not break the primary — **P28**.
- [x] Primed state does not survive a reload — **P31b**.
- [x] No `localStorage` key was added for priming — **P31a**.
- [x] `npx eslint .` 0 errors; `npx vite build` succeeds.
- [x] E2E web (172) + Windows (171, 1 pre-existing warn) pass.
- [x] ✅ **A real press-and-hold on a device** (`Input.dispatchTouchEvent`, not `dispatchMouseEvent`) — **done
      2026-10-10**: `e2e-mobile.mjs` Suite Q (**Q1–Q14**) drives the touch hold on the Pixel_7 emulator. Android
      **105 PASS / 0 FAIL / 0 WARN**. See §4b.

---

## 8. Open gaps / deferred

- ✅ **Android touch hold is now covered** (2026-10-10): `e2e-mobile.mjs` Suite Q drives priming with
  `Input.dispatchTouchEvent` (hold, hold+move-cancel, edit-mode, consumption, clear, reload persistence, and the
  three reload-surviving container shapes). Android **105 PASS / 0 FAIL / 0 WARN**. ⚠️ It is the emulator's
  WebView touch pipeline, **not a physical device**, and `dispatchMouseEvent` still would not exercise it.
  ⚠️ move/copy and per-sound volume remain **unported** to the mobile suite (same gap).
- ✅ **Hand-tested by the user** (2026-10-10): "from the brief test it seems to be working fine".
- ❌ **Saved named layers (Model B)** — rejected by the user 2026-10-06; priming is one-shot and not profile
  content. **Do not build, and do not add a `localStorage` key** — the absence is deliberate and asserted.
- Priming **whole containers**, timing offsets, sticky priming, priming *from* a hotkey picker, and undo for a
  mis-prime are all still out of scope; the clear-all button is the v1 answer for mis-primes.
- `HOTKEYS_SPEC.md` §5: when hotkeys are built, a hotkey **must** fire the primed set through `playWithPrimes` —
  two triggers with different semantics is the thing to avoid.
