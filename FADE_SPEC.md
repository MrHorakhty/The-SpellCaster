# Per-file Fades — Planning Spec

> **Status**: **BUILT 2026-10-21** (design agreed 2026-10-18, implemented and green on all three platforms).
> `src/fadeMath.js` (the pure model), `e2e/fadeMath.check.mjs` (gate 5's fifth check) and `e2e/specs/fade.mjs`
> (FADE1–FADE10) carry it. Line numbers verified against `src/App.jsx` at **7448 lines** on 2026-10-18; re-verify
> before editing.
> **Design revised 2026-10-18 after first draft**: looping sounds became **segment looping + seam fades built
> together** (§7), `stopAfter` was renamed **`playUntil`**, and §9's open questions were all answered.
> **Revised again 2026-10-21, after the hand-test**: §7.4 gained the mirror case (a fade-out with no fade-in), and
> the seam's fade-out half was actually built, so the advice in §7.4 is now true. §5's line saying looping sounds
> disable both fades is **superseded by §7** and is marked as such below.
> **Created**: 2026-10-18
> **Related**: `PROFILE_SYNC_SPEC.md` (live, §13 deferred scope), `HOTKEYS_SPEC.md` (the other unbuilt plan).
> A throwaway visual mock lives at `%TEMP%\opencode\fade-mock.html` — **outside the repo**, deliberately, so it
> costs no gate, no commit and no backup churn. Rev 2 reflects every decision in §2; open it to re-judge the layout.
> 💡 **The mock is the design, and the first implementation was not it.** The build shipped a plain scrubber where
> the mock drew a segmented bar (fade-in ramp, full-volume plateau, fade-out ramp, hatched tail, stop marker). The
> hand-test caught it, and FADE9 now pins the segments so it cannot come back.

---

## 0. What the user asked for

Turn the three bare number boxes — `Duration (s)`, `Fade In (s)`, `Fade Out (s)` (`App.jsx:6500-6533`) — into
per-file sliders that **cannot exceed the real audio length**, show where the fade lands relative to the file, and
display the file's original length next to the control.

---

## 1. The defect this exists to fix

`fadeOut` is scheduled off `sound.duration`, which is **user-typed metadata** (`App.jsx:4053`):

```js
const fadeStartDelay = Math.max(0, sound.duration - sound.fadeOut) * 1000
audio.timer = setTimeout(() => { fadeOutAudio(...) }, fadeStartDelay)
```

`e2e/specs/playback.mjs` **`Z15` now pins** that this produces four distinct silent no-ops:

| # | State | What happens |
|---|---|---|
| a | `duration: 0` | No timer at all — the guard requires `duration > 0` (`App.jsx:4051`) → hard cut at the file's natural end |
| b | `duration` > file length | `ended` wins; `cleanupAudio` clears the timer (`App.jsx:4029`) → fade never runs |
| c | `duration < fadeOut` | `Math.max(0, …)` clamps the start to 0 → **fades from the first sample, effectively silent** |
| d | `loop: true` | The `!sound.loop` guard means a looping sound **can never fade out** |

All 11 shipped sounds are `duration: 0, fadeIn: 0, fadeOut: 0` (measured in `src/data.json`), so today this
machinery is reachable only by sounds a GM configures by hand. 💡 **A control that silently does nothing is the
whole defect.** The fix is not a nicer slider; it is making the impossible states unrepresentable and the
remaining states legible.

---

## 2. Settled decisions

Agreed in discussion on 2026-10-18. Every one of these was argued to; do not reopen them casually.

| Decision | Value |
|---|---|
| Where fades live | **per file**, not per sound |
| Where "Play Until" lives | **per file** |
| The model | **`audibleEnd = min(fileLength, playUntil)`**; both fades measure back from their end of that |
| Red condition | **`fadeIn + fadeOut >= audibleEnd`** (`>=`, not `>`) |
| Gradient | **none.** Red means one thing and nothing else |
| Slider ceiling | **none.** Every slider spans 0 to the real file length |
| Step size | ~200 steps at any length: `len / 200` rounded up to `0.01 / 0.05 / 0.25 / 1` |
| Number box | beside **every** slider, accepts anything up to the file length |
| Timeline | **one per file row**, drawn over the **whole file** with the tail dimmed; also the Play Until scrubber |
| Timeline a11y | **built properly** — `role="slider"`, `aria-value*`, focusable, arrow keys |
| In a bundle | **all three travel** (§9) |
| Looping sounds | **segment looping + seam fades, built together** (§7). `fadeIn > 0` dips at every seam; `fadeIn = 0` loops clean |

### 2.1 The one-line model, and why it has to be one line

The model exists because `duration` is kept **as "Play Until"**, and that creates a question that must be answered
or failure mode (c) is rebuilt from the other direction: **is the fade-out measured from the file's end, or from
where playback actually stops?**

- From the **file end**: `play until 5s, fade out 2s` on a 10 s file fades 8→10 s - but playback stopped at 5 s, so
  **the fade never happens.** A silent no-op, i.e. `Z15` again.
- From the **the audible end**: full volume 0→3 s, fade 3→5 s, silence. **This is what a GM means.**

```
file:   0 ─────────────── audibleEnd ─────────────── fileLength
        │  fadeIn  │      FULL LEVEL      │  fadeOut  │   never heard
        0        fadeIn      audibleEnd - fadeOut    audibleEnd
```

`audibleEnd = min(fileLength, playUntil)`. Fade-in runs forward from 0; fade-out runs back from `audibleEnd`. 💡 **With
`loop: true`, `audibleEnd` is the loop point**, so fade-out softens the seam rather than the end of the file — no
extra rule, see §7.2.

### 2.2 Why per-file, and not "which file's length?"

A sound is a **container**; a fade is a property of a **clip**. `playSound` already picks a clip
(`App.jsx:3969-3978`) and, with `randomPlay`, may pick a *different* one on every trigger. A sound-level fade shared
across a 0.6 s and a 152 s file is silently wrong for one of them, every time. Per-file removes the question rather
than answering it.

### 2.3 Why no ceiling

A ceiling was proposed and **dropped**. It only ever aimed to keep the slider usable on long files (a 2 s fade sits
at 1.3% of a 152 s rail), and that job is already done twice over: the **number box** gives precision, and the
**red warning** covers the one failure a ceiling would have prevented. A ceiling also smuggles in an opinion about
what a reasonable fade is — exactly the kind of assumption `duration` turned out to be. **The user decides how long
they want.**

💡 Consequence worth naming: with no ceiling, the **timeline becomes load-bearing**, because on a long file it is
the only place the proportions are legible at a glance.

### 2.4 Why the warning grades nothing but the overlap

An earlier draft coloured by *"majority of the file is faded"*. **Rejected**: a 0.4 s fade on a 2 s door slam, or a
1.5 s swell on a 3 s cue, are legitimate and common, and marking them red teaches people to ignore the colour.
There is exactly **one** unambiguous broken state — `fadeIn + fadeOut >= audibleEnd`, i.e. the file never holds
full volume — and it is computable. Everything else is arithmetic to read, not a verdict:

> **Fades overlap by 0.4s** — this file never holds full volume. Ends at 3.0s of 3.0s.
> **No room for full volume** — the fades meet exactly at the end. Ends at 3.0s of 10.0s.

The second string exists because at exactly `>=` with zero difference, *"Fades overlap by 0s"* reads as a bug.
⚠️ **Do not word it as a statement of fact** — at exactly equal the file does technically reach full level for one
instant, so the operator and the sentence must agree.

---

## 3. Where the file length comes from

**Already available, and this is the reason the feature is affordable.** The sound modal already renders a real
`<audio controls src={fileObj.preview}>` per file (`App.jsx:6464`), and on **edit** it already resolves a `preview`
URL for every saved file (`App.jsx:2063-2072`):

```js
const existingFiles = await Promise.all(normalizedFiles.map(async file => ({
    preview: await getFileFromLocalStorage(file.storedName || file.name)
             || `/assets/${file.displayName || file.name || file.url}`,
    ...
})))
```

So **every file of an existing sound already has a live `<audio>` element with a resolved URL** — blob for uploads,
`/assets/...` for bundled files, through the same `getFileFromLocalStorage` path that already works on desktop, web
and Android for both.

**Therefore: one `loadedmetadata` listener on an element that already exists.** No new fetch, no MP3 header parsing,
no Rust. ⚠️ **Do not persist the measured length.** It goes stale when a file is replaced, it would ride along in
bundles as a number nobody re-checks, and the element can answer it for free every time.

Multi-file sounds are the easy case, not the hard one: each row measures its own file. **There is no "which file"
question left** (§2.2).

---

## 4. Data model — ⚠️ this is a persisted-shape change

Moving fades off the sound and onto each file entry changes stored data. This is the part that makes the feature
bigger than a UI change, and it is bounded but it is real.

```jsonc
// file entry inside sound.files[]
{
  "name": "Tavern_Music.mp3",
  "storedName": "Tavern_Music.mp3",     // absent for a bundled asset
  "displayName": "Tavern_Music.mp3",
  "fadeIn": 2.0,                        // NEW, per file
  "fadeOut": 0,                         // NEW, per file
  "playUntil": 0                        // NEW, per file - was sound.duration
}
```

### What has to change

| # | Change | Where |
|---|---|---|
| 1 | **New-sound allowlist** must gain the three fields | `App.jsx` ~1590. ⚠️ A field missing here is **silently dropped on save while edits survive it**, because the edit path spreads. Use `?? 0`, never `\|\| 0` |
| 2 | **Read normalisation** must carry them | `normalizeStoredFileEntry` (`App.jsx:2940`) spreads `...fileEntry`, so a present field survives — but an **absent** one must read as 0 |
| 3 | **Migration** — sound-level → every file | `src/profileStorage.js`. Copy `sound.fadeIn/fadeOut/duration` onto **every** file entry, not just the first. That is what a shared fade does today, so it is the behaviour-preserving choice |
| 4 | **`formatVersion` bump** | `src/profileBundle.js`. So an old build **refuses** a new bundle instead of half-importing it. ⚠️ That refusal path already exists and is tested in `e2e/profileBundle.check.mjs` — this is free |
| 5 | **The legacy single-file shape** | A sound can have **no** `files[]` and fall back to one `sound.file` (`App.jsx:3976-3978`). Fades must survive it, or they are lost on exactly the oldest sounds |
| 6 | **New-key assertions** | `e2e/lib/page.mjs` `KNOWN_KEYS` — no new *keys* here (the fields ride inside `ttrpg_characters`), so this should be a no-op. Verify rather than assume |

⚠️ **No `DATA_VERSION` bump is needed.** No new `localStorage` key, and the migration is a field move inside an
existing key. `DATA_VERSION = '3'` must not be touched casually — it affects every profile at once.

### Migration is low-risk here, deliberately

⚠️ **It would usually not be.** A silent behaviour change to existing boards is a normal cost of a change like this.
It is not one here because **the user is the only user** — the project has no downloads and was built for personal
use — and the existing board was lost on 2026-10-11 and is unrecoverable. The user has their own file backups. The
old `.spellcaster` bundles were test artefacts and have been deleted, so **no old-format bundle exists to migrate**.
Record that reasoning rather than assuming it next time.

---

## 5. UI

One block per file, in place of today's three-column grid:

```
Tavern Music (1 file, loop off)

  Tavern_Music.mp3                          2m 32s

  ┌───────────────────────────────────────────────┐
  │▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
  └───────────────────────────────────────────────┘
  0s              stop never - whole file plays      2m 32s

  Fade in     ▬▬▬▬●──────────────────────   [  2.00 ] s
  Fade out    ▬─────────────────────●──   [  0.00 ] s
  Play Until  ▬─────────────────────────   [  0.00 ] s

  Full volume for 2m 30s of 2m 32s.
```

### Rules this layout must keep

- **The timeline draws the whole file**, with the never-played tail dimmed, so a long file's proportions stay
  honest. ⚠️ **Do not make it zoom to the audible window.** That was considered and rejected: the ceiling was already
  rejected on the sliders, and reintroducing it through the bar would be worse than either option. The number box
  carries precision.
- **The timeline is the Play Until scrubber** (click or drag). It is the only control that makes a long file's
  proportions legible, and it makes the timeline a *control* rather than a readout. The number box beside it stays,
  because precision beats dragging. ⚠️ Both, not either.
  - 🔴 **It must be a capture-based drag, not a click handler.** `setPointerCapture` on `pointerdown`, then keep
    updating on `pointermove` — including when the pointer leaves the bar. An `onClick` passes a smoke test and
    fails in the hand, which is the same shape as every other "the test drove one synthetic event" trap in this
    repo. 💡 **Found this by breaking the throwaway mock**: rev 2 scrubbed exactly once, because the bar was being
    destroyed and rebuilt under its own listener. React would not have reproduced that, but the underlying
    click-vs-drag question is real and belongs here.
  - 🔴 **`touch-action: none` (or `pan-y`) on the bar is MANDATORY on Android.** Without it a horizontal drag on a
    div in an Android WebView **scrolls the modal** and the scrub never happens. One CSS declaration, **invisible on
    desktop** — so it would pass the web and Windows gates and fail only on a real device. This is the single
    highest-risk item in §5.
  - ⚠️ **Check it does not fight the app's existing pointer handling.** `App.jsx` already uses pointer capture plus
    document-level move/up listeners for card drag (`dragRef`, `setPointerCapture`, `armPrimeHold`). Those are
    card-level and guarded by `editMode` so they *should* not collide with the modal — verify rather than assume.
- 🔴 **The bar is keyboard operable.** It is a custom element, so it needs `role="slider"`, `aria-valuemin`,
  `aria-valuemax`, `aria-valuenow`, `aria-valuetext`, a tabindex, and arrow-key handling that moves Play Until.
  ⚠️ The number box makes it *possible* without the bar being a real control, which is exactly how an inaccessible
  widget survives review. `esc(keyboard.mjs` Suite Y already asserts the card is Enter/Space operable, so the
  precedent for testing this exists.
- **Number boxes are for typing, sliders for scrubbing.** Type into the box and the slider follows; drag the slider
  and the box follows. Both clamp to the file length on input so an out-of-range value can never be typed.
- **Slider max = file length, step = ~200 steps.** No ceiling (§2.3).
- **The slider is per-file, and so is the timeline.** No shared control anywhere.
- ⚠️ **A looping sound shows both fade controls disabled** with a plain sentence saying why (§7). 🔴 **SUPERSEDED
  by §7 (2026-10-21)**: §7 was the later and more specific decision, and it needs the fades ENABLED on a loop -
  the fade-out positions the seam and the fade-in ramps back up after it. The controls stay enabled, and the seam
  sentence (§7.4) is the plain sentence that takes this row's place. **This row is the reason the spec looked
  self-contradictory**, and the user was right to ask about it.
- **Red is one state.** A red border and a red sentence under the pair. ⚠️ **Do not tint the slider track** — a red
  thumb on a dark background is easy to miss and it fights the lime accent.
- 🔴 **The number box must carry NO `min`, `max` or `step`.** They are HTML5 validation attributes, and a value the
  slider cannot represent (`0.5` on a file whose step is `1`) becomes a **step mismatch**, which makes the browser
  **silently refuse to submit the form** — the sound never saves, the modal never closes, and every suite after it
  runs against stacked modals. The clamping belongs in the change handler, not in the markup. FADE10 pins this.

### ⚠️ The sliders are not free CSS

This repo has already been bitten here twice, and both are recorded in `PROJECT_STATE.md`:

- **Thumb centring.** With `appearance: none`, Chrome lines the thumb's *top* with the track's top rather than
  centring it, so an 11 px handle on a 3 px rail hangs low. The fix is `margin-top: (rail - handle) / 2` and it is
  **invisible in code review** — a pseudo-element cannot be measured from JS, so **a screenshot is the only
  verification that exists.** Reuse `.slider` / `.slider-compact` rather than inventing new rules.
- **`::-webkit-slider-thumb` is ignored** unless the input itself has `appearance: none`, and the deprecated
  `::-webkit-slider-track` paints a white band that needs `background: transparent`.
- Firefox centres the thumb itself, so the `-moz` rules carry no margin.
- 🔴 **Copy rule**: 🚫 **no em dashes in user-facing strings** (user's instruction, 2026-10-17). The mock uses them
  in *prose* only; every string above is already dash-free.

---

## 6. E2E notes

- **The measured length must be asserted, not assumed.** `loadedmetadata` is async and the fixture is local, so
  poll for the value with a bounded timeout — the same lesson as `Z2`, which failed on a single-instant `readyState`
  sample and is documented in `playback.mjs` as *"an async UI assertion that samples once is a race wearing a
  trouser-suit"*.
- **Reading `.duration` needs no user gesture**, unlike playback. Metadata loading is gesture-free, so this is
  testable without `driver.trustedTap`. ⚠️ Worth asserting rather than assuming.
- **Long fixtures are now the norm here.** `Tavern_Music.mp3` is 152.4 s and `Forest_Ambience.mp3` 285.9 s, both
  shipped and both referenced by `src/data.json` — a fade only runs if the file outlives the timer, which is the
  entire reason `Z13`–`Z17` needed them.
- **Every long fixture must self-clean.** `fadeOutAudio`'s `onComplete` calls `cleanupAudio`, so a trimmed file is
  torn down at the end of its ramp. A fixture that does not reach its audible end leaks into the next spec — the
  cross-spec leak this harness has been bitten by before.
- **Suite ids**: `Z` is taken through **`Z21`**. Pick a new prefix and check `coverage.manifest.json`; keep
  `idPattern` non-overlapping or `check-coverage.mjs` reports `AMBIGUOUS_ID`.
- **Negative cases are the real risks**, and they are the four from §1: a fade longer than the file, a fade that
  starts at 0 because it exceeds the window, `duration: 0` with a fade set, and a looping sound. All four are
  silent no-ops today, so an assertion that only checks the happy path proves nothing.
- 🔴 **The loop change must rewrite `Z9` in the same commit.** Its fixture (`fadeIn:1, loop:true`) asserts
  once-only behaviour that §7.3 removes. ⚠️ **It will keep passing** — a 0.576 s asset against a 1 s fade-in barely
  reaches the first seam — so the failure mode is a green suite quietly asserting the old contract. Register the
  replacement ids with `check-coverage.mjs --update` in the same commit, not after.
- **Segment looping needs a clip long enough to cross a seam.** Asserting `playUntil` loops `0…N` means reaching the
  seam, so either a long fixture (`Tavern_Music.mp3`, 152.4 s) or a short one with `playUntil` inside its own
  length. ⚠️ Every such fixture must still reach its audible end, or `fadeOutAudio`'s `onComplete` never fires and
  the element leaks into the next spec.
- **Keyboard access is testable.** Suite **Y** already drives cards with real key events, so `Tab` to the bar then
  arrow keys follows the same pattern. Assert `aria-valuenow` tracks Play Until **and that the value actually
  moves** — the number box makes the feature *possible* without the bar, which is how an inaccessible widget
  survives review.
- 🔴 **The DoD hand-test bar applies.** This is user-facing. It needs the user to hand-test the built app, and the
  slider centring needs a screenshot — an automated geometry assertion cannot see a pseudo-element (§5).

---

## 7. Looping sounds — segment looping and seam fades

**These are ONE feature and must be built together.** Splitting them means implementing the loop seam twice, and
each half alone is mediocre: a seam fade without segment looping pulses a whole file, and a segment loop without
seam control loops with no way to soften the join. Settled **2026-10-18**; **not yet authorised to build**.

### 7.1 What a looping sound does, now that it is decided

| | behaviour |
|---|---|
| `playUntil = 0` | loop the **whole file**, seamlessly (no fade applied at the seam) |
| `playUntil = N`, `loop: false` | play 0…N, then stop |
| `playUntil = N`, `loop: true` | **loop 0…N forever** |
| `fadeIn = 0` | the seam is clean; the file loops as-is |
| `fadeIn > 0` | the seam **dips**: volume forced to 0, then ramped back up |

🔴 **`Play Until` is therefore ONE control with TWO meanings**, selected by `loop`, and neither needs a new
control. That coherence is the reason to prefer it over a separate "loop segment" field.

### 7.2 The mechanism is cheaper than "problematic in the past" suggests

The rewind threshold today is `Math.max(audio.duration - 0.25, audio.duration * 0.98)` (`App.jsx:4085`) — a fixed
point near the end of the whole file. A segment loop is `min(playUntil, audio.duration)`. **That is the whole
change to the loop machinery.** The rewind was never the hard part; the **fade at the seam** is.

💡 And the seam fades fall out of the existing model for free: `audibleEnd = min(fileLength, playUntil)` is already
20 s on a 60 s file, so **`fadeOut` measures back from the loop point, not from the file end** — with no extra rule.
Together, **fade-out positions the seam and Play Until positions the loop point.**

### 7.3 `firstLoopPlay` goes away, and that has a consequence

🔴 The `firstLoopPlay` guard (`App.jsx:4077`, flipped at `:4089` and `:4105`) exists to stop a fade-in re-running at
every boundary. Under §7.1 a fade-in **must** run at every seam or "fade back in" is impossible, so **the guard is
removed**.

Two things that must happen in the same change, or the suite will lie:

- 🔴 **`Z9` must be rewritten deliberately.** `playback.mjs` `Z9` asserts "loop re-entry returns to the CURRENT
  master level" and its fixture (`fadeIn:1, loop:true`) **assumes once-only behaviour**. The *protection* it exists
  for stays valid — the fade target must still be read back off the element via `_baseVolume`, never a stale
  closure — but the fixture and the assertion's timing both change. ⚠️ **This is the single most likely thing to be
  missed**, because `Z9` will keep passing on a short clip while quietly asserting the old behaviour.
- ⚠️ **`applyFadeIn` reads `audio._baseVolume ?? baseVolume`** (`App.jsx:4093`, `:4109`). Once it runs per seam that
  read happens repeatedly, and it must stay correct on the **nth** iteration, not just the first.

### 7.4 A loop with fade-in and no fade-out clicks on every repeat

At the seam the element is at volume **V**; `currentTime` jumps to 0; `applyFadeIn` forces volume to **0** and ramps
up. Without a fade-out ramping *down* to 0 first, **that V→0 step is an audible click, every loop.**

This is not a bug — it is a legitimate "retrigger from silence" effect — but a user who set `fadeIn` expecting it to
apply once, at the start of the sound, gets a cut per repeat. So:

> **Fade-in dips on every loop.** Add a fade-out to soften the seam.

A plain sentence, not a red warning and not a block. ⚠️ **The DoD's governing rule applies: tell the user what will
happen, do not grade their choice.** This is the same precedent as the loop-disables-fades case.

🔴 **The mirror case, added 2026-10-21 after the hand-test.** §7.2 says a loop's `fadeOut` measures back from the
**loop point**, so with a fade-out and no fade-in the level ramps down into silence and then jumps straight back to
full - the same click, in the other direction. The first build forced the volume to 0 at the seam and ignored the
fade-out entirely, which made the sentence above advice the code did not honour. Now:

- the loop's `fadeOut` **ramps down into the seam** (it is scheduled from `loopPoint - fadeOut`, and it re-arms every
  cycle);
- the loop's `fadeIn` **ramps back up** after the rewind;
- a fade-out with no fade-in gets its own plain sentence: **"Fade-out reaches silence at every loop. Add a fade-in to
  bring the level back."**

Both sentences are in `seamSentence` (`src/fadeMath.js`) and both are pinned by `fadeMath.check.mjs` and FADE8.

### 7.5 Deferred

- 🔴 **A true equal-power crossfade at the seam.** v1's answer is the fade-out/fade-in dip, which needs one element.
  A real crossfade needs **two** audio elements playing simultaneously. Genuinely deferred, not a small addition.
- **A minimum segment length.** A 0.1 s `playUntil` on a loop is a buzz. A floor is probably right, but no value is
  agreed — and inventing one silently would be the `duration` mistake again.
- **"Only fade on the final loop"** would need a loop counter the app does not have. Not requested.

### 7.6 Also deferred, beyond the seam

- **A per-container or per-group default fade** ("new sounds in this group start at 1 s fade-in") — needs a
  persisted structure and therefore a re-run of the `PROFILE_SYNC_SPEC.md` §4.2 storage census.
- **Cross-fading two files** (fade one out as the next fades in, within one sound). The per-file model is what makes
  it expressible; it is not v1.
- **Editing fades from the card** rather than the modal. Rejected for v1 — the card already carries the volume
  slider, and the project has already had one "wall of visual noise" debate (`PROJECT_STATE.md`, the per-sound
  volume work).

- **A per-container or per-group default fade** ("new sounds in this group start at 1 s fade-in") — needs a
  persisted structure and therefore a re-run of the `PROFILE_SYNC_SPEC.md` §4.2 storage census.
- **Cross-fading two files** (fade one out as the next fades in, within one sound). The per-file model is what makes
  it expressible; it is not v1.
- **Editing fades from the card** rather than the modal. Rejected for v1 — the card already carries the volume
  slider, and the project has already had one "wall of visual noise" debate (`PROJECT_STATE.md`, the per-sound
  volume work).

---

## 8. Verification checklist

- [ ] Each file row shows its own measured length, and the length is **never persisted**.
- [ ] Each file row has its own fade-in, fade-out and Play Until, independent of every other file on the sound.
- [ ] Slider spans 0 to the file length with ~200 steps; the number box types an exact value and both stay in sync.
- [ ] Typing a value above the file length is clamped, not accepted.
- [ ] The timeline draws the **whole file**, with the never-played tail dimmed, and is **per row**.
- [ ] The timeline scrubs Play Until by **drag**, including when the pointer leaves the bar.
- [ ] 🔴 **On Android, dragging the timeline scrubs rather than scrolling the modal** (`touch-action`). This cannot
      be proven on desktop — it needs the real WebView, and it is the reason the DoD hand-test bar applies here.
- [ ] The timeline is keyboard operable: focusable, arrow keys move Play Until, `role`/`aria-value*` are correct.
- [ ] `audibleEnd = min(fileLength, playUntil)` holds for: unset, a value past the end, and a value inside it.
- [ ] A fade-out measures back from the audible end, **not** the file end — proven with `playUntil` set.
- [ ] `fadeIn + fadeOut >= audibleEnd` turns the warning red, and the two wordings differ at exactly equal.
- [ ] The red state appears **before saving**, live while dragging.
- [ ] A file that cannot be measured hides its timeline and sliders, explains why, and **preserves** stored values.
- [ ] A file replaced by a shorter clip shows the red state on open, with no extra mechanism of its own.
- [ ] `randomPlay` sounds play each file with **its own** fades.
- [ ] Sound-level `fadeIn`/`fadeOut`/`duration` migrate onto **every** file of the sound.
- [ ] A sound with **no** `files[]` (the legacy `sound.file` shape) is normalised to one file entry and keeps fades.
- [ ] All three values round-trip in a bundle, and an old build refuses the new `formatVersion`.
- [ ] `loop: false` + `playUntil: N` stops at N. `loop: true` + `playUntil: N` loops 0…N and never plays past it.
- [ ] `loop: true` + no fades loops seamlessly. 🔴 **`Z9` rewritten deliberately, not incidentally** (§7.3).
- [ ] `loop: true` + `fadeIn > 0` + `fadeOut = 0` shows the seam-click sentence rather than dipping silently.
- [ ] Slider handles are centred on their rails — **by screenshot**, on desktop and on Android.
- [ ] No em dash in any new user-facing string.
- [ ] `npx eslint .` → 0 errors; `npx vite build` succeeds.
- [ ] E2E: web, Windows and Android all pass, 0 FAIL.
- [ ] 🔴 **The user has hand-tested the built app.**

---

## 9. Resolved 2026-10-18

These were open when the spec was first written and were answered before any code. Recorded here rather than
deleted, because the *reasons* are the reusable part.

| Question | Answer |
|---|---|
| **A file the app cannot measure** (missing or undecodable) | 🔴 **Hide that row's timeline and sliders and say why** — *"Cannot read this file's length. Upload it again to use fades."* — and **preserve the stored values** rather than wiping them. Consistent with the loop case, and with the existing export refusal, which names the sound and says what to do (`missingBlobsMessage`, pinned by `I22`). ⚠️ The row still shows the filename, so a multi-file sound never loses a file from the list |
| **A file later replaced by a shorter clip** | **Nothing extra needed.** With `playUntil` unset, `audibleEnd = fileLength`, so a `fadeOut` exceeding the new length **is** the red condition. It appears at measurement time on modal open. 💡 A separate warning would be a second rule for a case the first rule already covers |
| **The legacy no-`files[]` shape** | **Normalise it on read into a single file entry**, so the modal renders exactly one shape and the oldest sounds are not the only ones without fades. A sound with `files: []` and a bare `sound.file` (`App.jsx:3976-3978`) is the only case |
| **Does `playUntil` travel in a bundle?** | 🔴 **Yes — all three travel.** They describe *how the file plays*, and exporting the audio without its intended playback would be a lossy export. Priming is the counter-example and is genuinely different: it is ephemeral one-shot state, not a characteristic of the sound, and the user explicitly rejected saving it. ⚠️ `duration`/`fadeIn`/`fadeOut` are already asserted to ride along verbatim (`profileBundle.check`, "volume rides along verbatim, including the legitimate 0"), so this follows the established pattern |
| **Timeline scale on a long file** | **The whole file**, with the never-played tail dimmed. The number box carries precision — the same division of labour the sliders already have. ⚠️ Do **not** re-introduce a ceiling by making the bar zoom: the ceiling was rejected on the sliders, and smuggling it back in through the timeline would be worse than either option |
| **Keyboard access for the timeline** | **Built properly** — it is a custom element, so it needs `role="slider"`, `aria-valuemin`/`max`/`now`/`text`, focusability and arrow-key handling. The project has already made ARIA calls on the volume slider (a wrapper, not `role="group"`), so this is consistent |
| **The label** | **"Play Until"**, not "Stop after" — accurate, because with `loop: true` it sets a loop point rather than a stop |