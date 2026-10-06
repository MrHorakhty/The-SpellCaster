# Per-Sound Volume — Planning Spec

> **Status**: **New spec, 2026-10-06; decision folded in the same day.** Design only — **implementation is not
> authorised.** No app code has been written. Line numbers were verified against `src/App.jsx` at **6240 lines**
> on 2026-10-06; they drift, so re-verify before editing (the pattern in this project is that they go stale — see
> `PROFILE_SYNC_SPEC.md` §0). **Created**: 2026-10-06
> **Decided**: the level is a **trim**, not an absolute (§2), and the UI is a **live slider on the sound card**,
> not modal-only (§2b). Two implementation consequences worth reading before starting: the card drag/play
> conflict (§2b.1) and the ARIA shape of a control nested inside a `role="button"` card (§2b.4).
> **Related**: `PROFILE_SYNC_SPEC.md` (profiles — a per-sound volume is *content* and rides the bundle for free),
> `HOTKEYS_SPEC.md`, `SOUND_PRIMING_SPEC.md`. Playback internals are shared by all three; **§2b.2 and §3** below
> are the parts that must not be designed twice (the live rescale and the fade-fraction arithmetic).

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

The cards already use `role="button"`. A slider inside a button-role element needs `role="slider"` (or a real
`input[type=range]`) plus `aria-valuenow`/`aria-label`, and keyboard support — the existing sliders handle keys via
`onKeyDown` (App.jsx:4333, 4378, 4466, 4515), so follow that pattern or keyboard tests will not find it. A nested
interactive control inside `role="button"` is also invalid ARIA; if that proves troublesome, make the card a
`role="group"` containing a real play button plus the slider. **Decide this before coding** — it affects markup
for every card.

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
| 9 | **the sound card component** — a per-card live level control (§2b) | new UI + `stopPropagation` so dragging it never plays the sound; **decide the ARIA shape first** (§2b.4) |
| 10 | **live per-sound rescale on slider move** (§2b.2) | a new path over `audioElementsRef` filtered by `audio._soundId` — not a reuse of `updateMasterVolume` |

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

- **New ID range: continue from `P1`** (`PROFILE_SYNC_SPEC.md` §14 records `EDIT` at `E5`, `SOUND` at `J8`,
  move/copy at `M1-M22` + `G1-G5`). Coordinate with `HOTKEYS_SPEC.md` and `SOUND_PRIMING_SPEC.md` if they land
  first — pick one continuation point and put it in this file.
- Sound cards are **`<div role="button">`, not `<button>`** — query `[data-sound-card]`, never `button`. ⚠️ the
  card slider is a **nested interactive control inside that**, so give it a stable selector (e.g.
  `[data-sound-volume]`) or every test has to guess at markup.
- Sliders in this app are **not** native `<input type=range>` — the master ones are custom divs with `onKeyDown`
  handlers (App.jsx:4333, 4378, 4466, 4515). Follow that pattern, or keyboard tests will not find the control.
  To drive one over CDP: dispatch `pointerdown`/`pointermove`/`pointerup` at the fill's coordinates, or drive the
  keyboard handler with `Input.dispatchKeyEvent`.
- ⚠️ **The card-drag/play conflict (§2b.1) is the test that matters most**: a drag across the card's slider must
  change the level **and not play the sound**. If that regresses, every other assertion is noise.
- Also assert: the *next* play uses the new level; a **currently playing** sound is rescaled live (§2b.2); a
  looping sound is rescaled without restarting.
- Assertions worth writing: the field survives save+reload; **0 stays 0**; a sound at 50% combined with a master
  at 50% is quieter than either alone; changing master mid-fade does not jump the level.
- The Windows phase runs against the user's real data and snapshots/restores `localStorage`
  (`e2e/e2e-snapshot.mjs`), so a volume test cannot eat a real board.

---

## 8. Verification checklist

- [ ] A sound can be set to a level other than 100% and it survives **reload**.
- [ ] **A sound set to 0% is still 0% after reload** (the `||` trap, §4).
- [ ] Newly created sounds get 100%, and existing sounds with no field play unchanged.
- [ ] Master × per-sound: the audible result is the product, not either alone.
- [ ] A sound with `fadeIn` fades **to its own level**, not to master.
- [ ] **The card slider drags without playing the sound** (stopPropagation works), and tapping the card body still
      plays (§2b.1).
- [ ] **The level change is audible while the sound is playing**, and on a looping sound, without restarting it
      (§2b.2).
- [ ] A sound **mid-fade-out** whose slider moves does not snap its level.
- [ ] The card slider is keyboard operable and exposes `aria-valuenow`; the modal slider and the card slider stay
      in sync (either can change the value).
- [ ] Changing the master slider **mid-fade** does not jump the level (the §3 path; no coverage exists today).
- [ ] Looping a sound keeps the per-sound level on every loop iteration, not just the first play.
- [ ] Master volume is **still not persisted** after this ships.
- [ ] `npx eslint src/App.jsx` → 0 errors; `npx vite build` succeeds.
- [ ] E2E: web + Windows phases pass with no new skips; new IDs do not collide with the other queued specs.

---

## 9. Deferred

- ⚠️ **A per-container or per-group default level** ("new sounds in this group start at 80%") — this is the one
  that would need a new persisted structure, and therefore a `PROFILE_SYNC_SPEC.md` §4.2 census re-run.
- Per-sound **pan** / balance, if it is ever wanted — the same four call sites and the same card control apply.
- MIDI-style CC-style external control (out of scope; this is a soundboard, not an instrument).
- ~~A card-level volume slider~~ — **no longer deferred; decided 2026-10-06 and specified in §2b.**