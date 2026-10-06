# Per-Sound Volume — Planning Spec

> **Status**: ✅ **SHIPPED and HAND-TESTED 2026-10-06** — implemented, E2E-verified, and the user booted the
> built app and reported it "works as intended from the brief testing". It clears the same bar move/copy did.
> Design decisions below are the record; where this file was **wrong about the code**, the corrections are marked
> ✅ RESOLVED / ✅ CORRECTION with the reason.
> **Verified**: `npx eslint .` → 0 errors (3 pre-existing warnings); `npx vite build` green;
> **web E2E 147 PASS / 0 FAIL / 0 WARN**; **Windows E2E 146 PASS / 0 FAIL / 1 WARN** (the WARN is the
> pre-existing G5 skip); **Android 85 PASS / 0 FAIL / 0 WARN / exit 0** (2026-10-06 23:03) plus a real
> screenshot confirming the row's layout. Suite **P** (`P1`-`P16`) in `e2e/e2e-full.mjs`. ⚠️ Suite P is **not**
> ported to `e2e-mobile.mjs`, so the Android run proves no regression rather than volume working there.
> **Decisions**: the level is a **trim**, not an absolute (§2), the UI is a **live slider on the sound card**
> (§2b), and — decided while building — the card control sits **outside** the `role="button"` card (§2b.4).
> **Line numbers below were verified against the 6240-line `src/App.jsx` on 2026-10-06 and have since drifted**
> (the file is now ~6500 lines); the *structure* is accurate, the line numbers are not.
> **Related**: `PROFILE_SYNC_SPEC.md` (profiles — a per-sound volume is *content* and rides the bundle for free),
> `HOTKEYS_SPEC.md`, `SOUND_PRIMING_SPEC.md`.
> 💡 **Two shipped behaviours that are design decisions, not accidents**: a drag writes local state on every
> pointermove but persists **once on commit** (`cardVolumeDraft`), because the auto-save effects are undebounced and
> stringify the whole slice synchronously — persisting per move stutters a 90-sound board. And loop re-entry reads
> `_baseVolume` back off the element, which is why the master path has to keep it fresh (§3).

---

## 0. What the user asked for

"Sound Button Based Volume" — a volume per sound button, instead of one global slider.

**Recommended position: build this BEFORE profiles.** It is content (it sits beside `fadeIn`/`fadeOut`/`loop`,
which the bundle already carries), it is one optional field, and `normalizeStoredData` preserves unknown sound
fields, so it needs no `DATA_VERSION` bump and no exporter work. Built after profiles it would still work as an
additive-optional field, but you would design the sound shape twice.

---

## 1. Current state (verified 2026-10-06)

There is exactly **one** volume today and it is **not persisted**.

| Fact | Where | Consequence |
|---|---|---|
| `masterVolume` is `useState(1.0)` | App.jsx:760 | Session-only. **No `localStorage` read or write anywhere** — a page reload resets it to 100% |
| `audioEnabled` is separate state, default `false` | App.jsx:759 | `updateMasterVolume` turns audio *on* if volume > 0 (App.jsx:1320) |
| Master volume is applied at **four** call sites, not one | 3299 (`audio.volume = masterVolume`), 3337, 3379, 3392 (the three `applyFadeIn` calls) | ⚠️ a naive per-sound change that misses one of these gives a sound the right volume on first play and the wrong volume on every loop re-entry |
| Fades take the master value as their **target** | `applyFadeIn(audio, targetVolume, fadeInSeconds)` at 604 | The fade target must become the *combined* volume, or a fade-in will end at master and ignore the sound's own level |
| The master slider live-adjusts playing audio **while preserving the fade fraction** | `updateMasterVolume` at 1315, the arithmetic at 1325-1335 | ⚠️ **this is the hard part of this feature** — see §3 |
| Already-playing elements know their sound | `audio._soundId = soundKey` at 3301, `soundKey = sound.id` at 3263 | The hook needed to recompute a per-sound target |
| Sliders live in two places | header 4308-4350, settings modal 4429-4472 (plus `volumeInput` text state at 1068) | Reuse the existing pattern; do not invent a third control style |
| Sounds already carry per-sound playback fields | `randomPlay`, `color`, `brightness`, `duration`, `fadeIn`, `fadeOut`, `loop`, `glowEnabled`, `glowProminence` (form template at 960-980) | A `volume` field is the same kind of thing and belongs in the same form |

---

## 2. Data model

One optional field on the sound object:

```js
// absent === 100%. Never store a redundant 1.
volume: 0.6
```

### ✅ DECIDED 2026-10-06: **live slider on the card**, not modal-only

The user answered "live slider ideally". That is the more literal reading of "sound button based volume", and it
is the harder of the two options — it is specified in full in **§2b** below rather than deferred. The modal keeps
a slider too (for precise values), so both controls write the same field.

### ⚠️ Decision 1: trim (0–1 multiplier) or absolute level? — **Recommend TRIM**

| | trim (recommended) | absolute |
|---|---|---|
| master slider means | "device output level" | ambiguous |
| a sound at 100% | plays at master | plays at 100% of the OS volume — **silently ignores the master slider** |
| round trip through profiles | identical mix on a phone and a desk | same absolute number, wildly different perceived loudness |

Keep **master = device level, per-sound = mix level**. It also means master stays *out* of the bundle
(§5), which is consistent with `PROFILE_SYNC_SPEC.md`'s rule: sync the tedious thing, not the device knob.

---

## 2b. The live card slider — the actual work

This is what "live" means and why it is more than a styling change.

### 2b.1 The card is a click target, and a slider is a drag target

Sound cards are **`<div role="button">`** — the whole card plays the sound on click. Putting a slider inside it
creates a genuine interaction conflict: a drag that starts on the slider must adjust volume, and the same gesture
elsewhere on the card must play. Three rules make it work:

- The slider must call `e.stopPropagation()` on `pointerdown` — otherwise the card's click handler fires and the
  user hears the sound every time they drag the volume.
- Playback should be triggered by `click`, not `pointerdown`, so a drag never ends in a play. ⚠️ **check whether
  the card currently uses `onClick` or `onPointerDown`** — the latter is already used for drag-and-drop at 3643,
  and that handler is the likely conflict.
- On mobile the slider needs a **taller hit area** than a desktop mouse needs, and it must not trigger the card's
  own long-press/hold behaviour once priming ships (`SOUND_PRIMING_SPEC.md` §3) — two features now compete for
  the same gesture on the same element. Prime by right-click / hold on the card **body**, not on the slider.

### 2b.2 "Live" must mean audible while playing, not just after the next play

A slider that only takes effect on the *next* trigger is not a live slider. Adjusting the level of a sound that is
**currently playing** (or looping) has to rescale its live `Audio` elements:

```js
// only instances whose _soundId matches this sound
for (const el of audioElementsRef.current.values()) {
    if (el._soundId !== sound.id) continue
    // preserve the element's position in its fade, same arithmetic as updateMasterVolume (1325-1335)
}
```

The element identity hook already exists: `audio._soundId` is set at App.jsx:3301 and `audioElementsRef` is
populated at 3304. **Do not** reuse `updateMasterVolume` itself — it iterates *all* elements and scales by the
master ratio; this is a per-sound variant. Extracting the shared "rescale an element while preserving its fade
fraction" arithmetic into one helper used by both is the clean way, and it is worth doing because that arithmetic
is the fiddliest code in this feature and currently has no test.

⚠️ A sound that is **mid-fade-out** when its slider moves: recompute from the fade fraction (the shared helper
handles it) rather than snapping the level.

### 2b.3 Cost and layout

- **Every card gets a slider.** A board with 90 sounds (that is how many files the test account has in
  `uploads/`) means 90 sliders. On mobile that is a real DOM and repaint cost, and a wall of visual noise. Mitigate
  with a **compact inline level bar** (a thin fill + a percentage on hover/focus) rather than a full master-style
  slider, and consider showing it **only on the hovered/focused/edited card** — but a control that appears on
  hover is unusable on touch, so on mobile it should probably always be visible and simply small.
- **Card height changes**, so check the grid layout in both the sidebar and the board view.
- Keep the **master** slider visually distinct from the per-sound ones; they mean different things (§1) and users
  will conflate them otherwise. A label ("Sound" vs "Master") is worth the pixels.

### 2b.4 Accessibility

The cards already use `role="button"`.

✅ **RESOLVED 2026-10-06 — no `role="group"` conversion. Put the control outside the card.**
The in-repo precedent already answers this: the edit-mode buttons are anchored to the **wrapper** `div`, not the
card, with the comment *"Anchored to the wrapper, not the card, so it does not inherit the card's pointerdown drag
handler"*. A nested control already exists inside the card (the stop button, which uses `e.stopPropagation()`), so
nested-ARIA-invalidity is the shipped status quo rather than a new problem to solve.

Shipped shape: the card gained one wrapper level — an outer div (the grid cell, now `flex flex-col`, holding the
volume row) containing an inner `relative` div that holds the card plus the edit-mode buttons. That keeps the
edit buttons anchored to the card's own box while the volume row sits below it. Consequences, all of them good:

- The slider is **not** a descendant of `[data-sound-card]`, so dragging it cannot trigger the card's `onClick`
  and cannot arm the card's edit-mode drag. **No `stopPropagation` is needed at all.**
- The nesting/ARIA question disappears rather than being designed around.
- It also answers `SOUND_PRIMING_SPEC.md` §3: prime on the card body, and the slider needs no special-casing
  because it is not inside the card.

Accessibility on the control itself is cheap: it is a **native `<input type="range">`**, so arrow keys work with no
`onKeyDown` handler. Add `aria-label` plus `aria-valuenow`/`valuemin`/`valuemax`, and a stable
`data-sound-volume="<soundId>"` selector so tests do not have to guess at markup.

⚠️ The card plays on **`onClick`**, and `onPointerDown` arms a drag **only when `editMode` is true** — so the
conflict is click-bubbling outside edit mode and pointer-capture inside it. Both disappear with the wrapper.

---

## 3. The one genuinely tricky part: live master adjustment

`updateMasterVolume` (App.jsx:1315) walks the currently-playing elements and rescales them in place, preserving
their position within a fade. It currently assumes every element's target *is* `masterVolume`:

```js
const oldTarget = audio._fadeTargetVolume ?? 1                       // 1330
const fraction = oldTarget > 0 ? Math.min(1, Math.max(0, (audio.volume || 0) / oldTarget)) : 0
audio._fadeTargetVolume = nowEnabled ? volume : 0                    // 1332
audio.volume = Math.min(audio._fadeTargetVolume, fraction * audio._fadeTargetVolume)
```

With per-sound levels, `oldTarget` must be **that element's sound's** target, not the master's.

**Recommended fix — do not look the sound up at adjustment time.** Instead, record the effective target on the
element when it is created:

```js
// in playSound, next to audio._soundId (3301)
audio._baseVolume = masterVolume * (sound.volume ?? 1)
```

Then the 1315 logic reads `audio._baseVolume` instead of `masterVolume`, and needs no lookup, no container walk,
and no id resolution. This keeps the whole feature inside `App.jsx` with **zero** new persisted state beyond the
one field, and it does not care that a sound's own volume changed *after* it started playing (the element keeps
the level it began with — which is the sane behaviour anyway).

⚠️⚠️ **`updateMasterVolume` MUST also refresh `_baseVolume`, not just the live volume.** This is a real bug, caught
by the E2E suite on 2026-10-06, and it is invisible if you only assert the audible level: rescaling the element
without updating `_baseVolume` leaves it at its creation value, and `playSound` reads `_baseVolume` back at
**loop re-entry** — so a looping sound would fade back down to the level it started at after any master change.
Shipped fix: set `audio._baseVolume = target` inside the same loop, before `rescaleAudioTarget`.

Shipped, and worth keeping as the shape of the whole feature:

| Helper | Role |
|---|---|
| `normalizeSoundVolume(value)` | one definition of "absent === 100%", coerces the input's **string** to a number, clamps to 0–1. Use it in **both** save paths, not just one |
| `rescaleAudioTarget(audio, target)` | the fade-preserving rescale, extracted from `updateMasterVolume` and shared with the per-sound path — there is exactly one copy of that arithmetic on purpose |
| `mapSoundContainers(list, visit)` + `patchSoundById(id, patch)` | write a field onto a sound in **any** of the five container shapes, returning untouched branches unchanged so a drag does not re-render the board. Do **not** hand-roll per-slice setters: PROJECT_STATE records that the four-shape assumption "looks correct and is not" |

⚠️ Whatever is chosen, `updateMasterVolume`'s fade-preserving arithmetic must be regression-tested: it is the only
place in the app that mutates a playing element's volume, and it has no test today.

---

## 4. Every place the field must be threaded

⚠️ **The "new sound" save path builds an explicit allowlist of fields** (App.jsx:1490-1502). A field that is not
listed there is **silently dropped** for every newly created sound, while edits survive — because the edit path
spreads. This is the single most likely way to ship a half-working feature.

| # | Location | What to add |
|---|---|---|
| 1 | App.jsx:960-980 — `soundFormData` initial state | `volume: 1` |
| 2 | App.jsx:1373-1389 — "new sound" reset template | `volume: 1` |
| 3 | App.jsx:1425-1440 — hydrate-for-edit | `volume: sound.volume ?? 1` |
| 4 | App.jsx:1490-1502 — **new sound** save (explicit allowlist) | `volume: newSoundData.volume ?? 1` — ⚠️ **the one that silently drops it** |
| 5 | App.jsx:1593-1601 — edit sound save (spreads `...newSoundData`) | survives automatically, as long as the form carries it (see 1 & 3) |
| 6 | App.jsx:3299, 3337, 3379, 3392 — the four volume applications | use the combined target from §3 |
| 7 | App.jsx:1315-1335 — `updateMasterVolume` | use `audio._baseVolume`; extract the shared fade-fraction rescale helper (§2b.2) |
| 8 | sound modal UI, beside `fadeIn` (5541) / `fadeOut` (5553) / `loop` (5566) | a slider + a numeric field, mirroring the master slider's two-control pattern |
| 9 | **the sound card component** — a per-card live level control (§2b) | new UI. ✅ **shipped as a SIBLING of the card, not inside it**, so it inherits neither the card's click nor its edit-mode pointerdown drag — no `stopPropagation` needed (§2b.4) |
| 10 | **live per-sound rescale on slider move** (§2b.2) | a new path over `audioElementsRef` filtered by `audio._soundId` — not a reuse of `updateMasterVolume`. Plus the persist-on-commit split (§7), because the auto-save effects are undebounced |

**`transferSound` needs nothing.** Its copy branch spreads `...source.sound` (App.jsx:2041) and only overrides
`id` and `name`, so a moved or copied sound keeps its level automatically. Move keeps the same object reference.

### ⚠️⚠️ The `||` trap — a legitimate 0 must survive

The codebase normalises optional fields with `||` throughout, e.g. `brightness: newSoundData.brightness || 1`
(App.jsx:1497). For volume that is **wrong**: `0` is a valid level (a deliberately muted sound), and `0 || 1`
turns it into `1`.

**Use `?? 1`, not `|| 1`, everywhere.** Note that the same file already gets this right one line later for a
different reason — `loop: newSoundData.loop !== undefined ? ... : ...` (App.jsx:1502) — so there is precedent.

**A muted sound must still count as muted after a save/reload cycle.** That single assertion is the regression
guard for this whole section.

---

## 5. Interaction with profiles (`PROFILE_SYNC_SPEC.md`)

**None required — this is the reason to build it first.**

- The exporter walks sound objects wholesale and copies `data.json`; a new optional field rides along with **no
  exporter change** and no `formatVersion` bump (the spec's rule: writer stays conservative, reader stays
  permissive; an absent field means 100%).
- ⚠️ If profiles land **first** and this lands after, it is still an additive-optional field on an existing
  shape — not a format break — but `PROFILE_SYNC_SPEC.md` §3/§4.2 enumerate the sound fields and would need a
  re-verification pass, exactly the stale-numbers problem that produced the 21:44 revision on 2026-10-04.
- Master volume stays unpersisted, therefore out of every bundle. Keep it that way (it is also the only volume
  control that exists on a fresh install).

---

## 6. Edge cases — recommendations, confirm rather than re-derive

- **A sound in the middle of a fade-out when its level changes** — do nothing (the element keeps its `_baseVolume`);
  simplest and needs no extra code.
- **Does `randomPlay` matter?** No — it picks a *file* variant (App.jsx:3268), not a level.
- **A muted sound still "plays"** (a silent `Audio` element is created, registered in `audioElementsRef` at 3304,
  and cleaned up normally). That is fine and keeps stop/loop logic untouched. Do **not** special-case it.
- **Restore Defaults / mergeShippedDefaults** (App.jsx:349) merges shipped sounds by id. A missing `volume` on a
  shipped sound means 100%, so no change is needed there.

---

## 7. E2E notes

- **New ID range: `P1`-`P16`** — **taken** by this feature on 2026-10-06, as Suite P in `e2e/e2e-full.mjs`. Note it
  skipped P1–P9 ids and settled on the P1 block the other queued specs reserved; `SOUND_PRIMING_SPEC.md` and
  `HOTKEYS_SPEC.md` must **not** reuse P. Suite V (`[WEBV]`) and Suite I are separate mobile suites.
- Sound cards are **`<div role="button">`, not `<button>`** — query `[data-sound-card]`, never `button`.
- ✅ **CORRECTION: the sliders in this app ARE native `<input type="range">`** (header and settings modal), each
  paired with a sibling `input[type=number]`. This section previously claimed the opposite and pointed at
  `onKeyDown` handlers as the pattern — those handlers belong to the **number** inputs. Consequences: keyboard
  support is free (no `onKeyDown` needed), and over CDP you drive a slider through the **native value setter** plus
  a bubbling `input` event, *not* by dispatching pointer moves:
  ```js
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, String(v));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  ```
  Setting `.value` directly does **not** work — React tracks the value on the DOM node.
- ⚠️ **Assert the persisted field, not the audible level, and beware unregistered elements.** Only elements still in
  `audioElementsRef` get rescaled, and a short or undecodable fixture fires `ended` → `cleanupAudio` → unregistered
  within milliseconds. An `ended` element still reports `paused === false`, so a liveness check cannot detect it —
  which makes such a test pass or fail for the wrong reason. Shipped fixture: a **real bundled asset**
  (`Longbow_4.mp3`) with `loop: true`, and no `storedName` so it resolves from `/assets`. An earlier hand-written
  data-URL WAV of a few ms of silence reported no usable duration, never engaged the loop, and made the
  live-rescale assertions vacuous on **both** web and Windows.
- ⚠️ **The live-rescale test must be self-contained.** Reusing an element created by an earlier test step is not
  safe. Create a fresh one, note the element count first, then walk it through two master values: an element
  created at master 1 starts at 0.5, so observing it drop to 0.2 proves it was still registered when the master
  changed. Shipped as P9a–P9d.
- ⚠️ **A trusted click is required to keep an element registered on web.** `element.click()` from `Runtime.evaluate`
  is not a user gesture, so autoplay is refused and `play()` rejects. Use
  `Input.dispatchMouseEvent` at the card's `getBoundingClientRect()` centre.
- ⚠️ **The card-drag/play conflict is structurally impossible as built** (§2b.4): assert `nested === 0`, i.e. no
  `[data-sound-volume]` has a `[data-sound-card]` ancestor. That is a stronger and more stable assertion than
  simulating a drag.
- The Windows phase runs against the user's real data and snapshots/restores `localStorage`
  (`e2e/e2e-snapshot.mjs`), so a volume test cannot eat a real board.
- The seeded key set includes `ttrpg_themes`, which **no version of the app has** — the suites still seed it
  (`docs/session-history.md`: *"there is no `ttrpg_themes` key at all"*). Do not treat it as a regression, and do
  not write a "no new key" assertion without it in the expected set.

---

## 8. Verification checklist

Automated — Suite P, `e2e/e2e-full.mjs`. `P1`-`P16` are the shipped IDs; the **P9** group is split into four.

- [x] `P10`/`P11` A sound set to 0% is still 0% after **reload** (the `||` trap, §4).
- [x] `P1`/`P3`/`P12` Every card exposes a slider; newly created sounds default to 100%, and a sound with no
      field plays unchanged at 100%.
- [x] `P6`/`P7`/`P8` Master × per-sound: the audible result is the **product** (master 0.4 × trim 0.5 = 0.2).
- [x] `P2` **The slider is not inside the `role="button"` card** (`nested === 0`), so dragging it cannot play the
      sound and cannot arm the edit-mode drag (§2b.1, §2b.4).
- [x] `P4` The slider carries `aria-label` + `aria-valuenow`; being a native range, keyboard operation is free.
- [x] `P9a`-`P9d` The level changes **while the sound is playing**, on a looping sound without restarting it, and
      `_baseVolume` tracks the master change so the loop re-entry does not snap back (§3).
- [x] `P15`/`P16` The modal control and the card control write the **same field**, and either one updates the other.
- [x] `P13` `DATA_VERSION` still `'3'` and no `*_old` keys were written.
- [x] `P14a`/`P14b` **No new `localStorage` key**; no key holds volume, and the master slider is still
      session-only.
- [x] `npx eslint .` → 0 errors; `npx vite build` succeeds.
- [x] E2E: web **147 PASS / 0 FAIL / 0 WARN**; Windows **146 PASS / 0 FAIL / 1 WARN** (pre-existing G5 skip);
      Android **85 PASS / 0 FAIL / 0 WARN**.

Not covered by automation — **still open**:

- [ ] **Changing the master slider mid-fade does not jump the level.** The `rescaleAudioTarget` arithmetic is
      shared and now has coverage for the non-fade branch; the mid-fade branch (`_fadeTargetVolume` set, ramp
      still running) is **not** exercised, because the fixtures finish before a fade completes. Needs a long
      `fadeIn` sound.
- [ ] **A sound mid-fade-out whose slider moves does not snap its level.** Same reason.
- [ ] **Looping keeps the level on every iteration** — P9 covers the master change against a looping sound, but
      not an actual loop boundary crossing.
- [ ] ⚠️ **Suite P is not ported to `e2e-mobile.mjs`.** The Android phase passes (85/85) and a screenshot confirms
      the layout, so this is a coverage gap rather than a known problem — but nothing automated asserts the slider
      on a real touch device. Same gap move/copy has.
- [ ] 💡 **Design opinion wanted on how loud the control looks.** A screenshot of a four-card board on a Pixel-class
      emulator shows four full-width blue bars. That is the direct consequence of "always visible, live slider on
      every card" (hover-reveal is unusable on touch), and §2b.3 flagged "a wall of visual noise" as the risk.
      Shrinking it is purely cosmetic — no logic depends on the size.

---

## 9. Deferred

- ⚠️ **A per-container or per-group default level** ("new sounds in this group start at 80%") — this is the one
  that would need a new persisted structure, and therefore a `PROFILE_SYNC_SPEC.md` §4.2 census re-run.
- Per-sound **pan** / balance, if it is ever wanted — the same four call sites and the same card control apply.
- MIDI-style CC-style external control (out of scope; this is a soundboard, not an instrument).
- ~~A card-level volume slider~~ — shipped 2026-10-06, as a sibling of the card rather than inside it (§2b.4).