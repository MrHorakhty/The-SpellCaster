# Sound Priming — Planning Spec

> **Status**: **New spec, 2026-10-06; decision folded in the same day.** Design only — **implementation is not
> authorised.** No app code has been written. Line numbers verified against `src/App.jsx` at **6240 lines** on
> 2026-10-06; re-verify before editing.
> ✅ **DECIDED by the user: priming is ONE-SHOT and is explicitly NOT profile content.** Nothing is persisted —
> **do not add a `localStorage` key** for it. That means this feature has **no interaction with the profile
> refactor** and can be built at any point in the sequence. Saved named layers (Model B) are **rejected**; §6
> records why, so it is not re-opened.
> **Created**: 2026-10-06
> **Related**: `HOTKEYS_SPEC.md` (a hotkey must fire the primed set too — §5), `PER_SOUND_VOLUME_SPEC.md`
> (⚠️ its card slider and this feature's card gesture compete for the same element — §3),
> `PROFILE_SYNC_SPEC.md`.
> ⚠️ **Recommended order: any time.** It is the cheapest of the three features and the only one with zero
> persistence work.

---

## 0. What the user asked for

"Ability to Prime a Sound — primed ones will activate alongside the active sound when it plays, for example
priming fireball and frostbite and then clicking lay on hands will play all three. Priming can be done with a
right click on desktop and by holding on the phone."

Desired gestures: **right-click** (desktop), **press-and-hold** (mobile).

---

## 1. ✅ DECIDED 2026-10-06: **one-shot, and explicitly NOT profile content**

The user confirmed priming is **one-shot**: prime Fireball + Frostbite, trigger Lay on Hands, all three play, and
the primed set is **consumed**. They also confirmed explicitly that it is **not** profile content.

That collapses this spec to **Model A only**, permanently. Nothing here is stored, nothing travels in a bundle,
and there is **no interaction with the `PROFILE_SYNC_SPEC.md` storage refactor at all** — so this feature can be
built **at any point in the sequence**, before or after profiles.

| | **Model A — one-shot priming (CHOSEN)** | **Model B — saved layers (REJECTED)** |
|---|---|---|
| Lifetime | until the next trigger, then cleared | saved, named, reusable |
| Storage | **none** — React state | new persisted structure, new `localStorage` key |
| Travels in a profile? | ❌ **must not** (confirmed) | would have |
| Cost | small | large: schema, UI, delete semantics, references |
| Status | ✅ **this is the spec** | ❌ **out of scope — do not build it, do not re-open it** |

Model B is kept in §6 only as a record of *why* it was rejected, so a later session does not re-litigate it.

💡 Because priming is one-shot and per-session, it is the **cheapest of the three features** and has no
persistence work at all. If you want a quick win, this is it.

**Everything below is the chosen design.**

---

## 2. Design (one-shot)

### State

A `Set` of sound ids in component state, next to the other UI state:

```js
const [primedSoundIds, setPrimedSoundIds] = useState(() => new Set())
```

⚠️ `Set` in state needs a new array/object identity to re-render — `setPrimedSoundIds(prev => new Set([...prev, id]))`,
never mutate in place.

Use **sound ids**, not container references. Ids are minted once and never regenerated (`mintId('sound')`,
App.jsx:260) so they are stable for the session. Unlike a hotkey binding (which must survive renames and profile
switches), a primed set is deliberately short-lived, so a reference-with-a-display-snapshot is overkill here.

### Triggering — ⚠️ capture and clear synchronously, because `playSound` is async

One-shot changes the mechanics: the primed set must be **read and emptied before any awaiting happens**, not
cleared afterwards. Otherwise a second trigger fired while the first is still playing would pick up the same
primed sounds and play them twice.

```js
const playWithPrimes = async (sound) => {
    const ids = primedSoundIds          // capture the current set
    setPrimedSoundIds(new Set())         // consume it SYNCHRONOUSLY, before any await
    await playSound(sound)               // 3256 — the real player, unchanged
    for (const id of ids) {
        if (id === sound.id) continue
        const primed = findSoundById(id) // needs a lookup — see §4
        if (primed) await playSound(primed)
    }
}
```

Clearing first also makes the UI honest: the primed indicators vanish the instant the user triggers, which is
exactly what one-shot should look like.

Route **every** trigger through this one function: card click, hotkey, anything added later. One chokepoint means
one place to test.

⚠️ `playSound` is already tolerant of the things priming will throw at it, which is convenient:

- it early-returns in `editMode` (App.jsx:3257) — so priming does nothing in edit mode, for free;
- it calls `enableAudio()` itself if audio is off (3259-3261) — so firing three sounds enables audio once and
  harmlessly twice more;
- each call creates its own `Audio` and registers it under its own `audioInstanceKey` (3303), so three concurrent
  sounds need no new machinery.

### Decisions to make before coding

- **Does a primed sound that is itself triggered re-fire the set?** The `id === sound.id` skip above says no.
  Without it, priming A and then playing A plays A twice.
- **Stop semantics** — the big one. `playSound` has no return value and registers instances in
  `audioElementsRef`; `stopSound` (3472), `stopSoundInstances(soundId)` (3464) and `stopAllSounds()` (3476) all
  exist. If pressing a card played three sounds, does pressing it again stop **all three** or just the primary?
  **Recommend: stop all three** — the user thinks of it as one action. `stopAllSounds` is unaffected.
- **Can a looping sound be primed?** Priming a loop means *every* trigger starts another loop instance, which
  compounds. **Recommend: allow it but surface the loop badge on the primed card** so it is not a surprise. If
  loops are common in this app (they are — environment sounds default to `loop`, App.jsx:1502), consider
  refusing to prime a looping sound in v1.
- **Does `randomPlay` matter?** A primed sound with several files picks a **new random variant on every
  trigger** (App.jsx:3268). For a primed ambience that is probably right; for a primed one-shot with variants it
  may be surprising. Note it, don't fight it.
- **A primed sound with no resolvable file** — skip it silently rather than failing the primary trigger.
- **Interaction with per-sound volume** (`PER_SOUND_VOLUME_SPEC.md`): a sound trimmed to 0% is primed and plays
  silently. Harmless — do not special-case it.

### Visual state

A card needs an unmistakable "primed" look (this is a performance tool; ambiguity costs a fumble mid-session).
Add a small badge/indicator rather than only a border tint, and keep it distinguishable from **edit mode**, which
already changes card appearance.

Because priming is **one-shot**, the indicator disappearing on trigger *is* the feedback — consider a brief
"fired" flash on the consumed cards so the user can see what actually played, rather than having to remember.
Worth a "clear all primed" affordance too: with one-shot, mis-primes are likely, and the fix should not require
un-priming each one by hand.

---

## 3. The gestures (right-click / press-and-hold)

### Verified current state: **there is none**

A full scan of `App.jsx` found **no** `onContextMenu`, no `contextmenu` listener, no long-press helper, and no
`onTouchStart`. The only pointer handler is `onPointerDown` at App.jsx:3643 (drag-and-drop). So this is
greenfield — nothing to collide with, and no in-repo precedent to copy.

### Desktop right-click

```jsx
onContextMenu={(e) => { e.preventDefault(); togglePrime(sound) }}
```

⚠️ `preventDefault()` is required — without it the WebView2/browser menu opens over the app. Sound cards are
**`<div role="button">`, not `<button>`**, so there is no native behaviour to suppress; the menu appears unless
you prevent it.

### Mobile press-and-hold

- ~**450-500 ms** timer on `pointerdown`; cancel on `pointerup`, `pointercancel`, or **movement beyond ~10 px**
  (otherwise a scroll starts a prime).
- ⚠️ A long press on mobile also raises the OS text-selection callout. Cards need `user-select: none` and
  `-webkit-touch-callout: none` (check whether cards already have it).
- ⚠️ `touch-action` and the existing drag handler at 3643 must be checked so the hold does not start a drag.
- Prefer **Pointer Events** for both, so one code path covers mouse and touch — but note that a right-click
  arrives as `pointerdown` with `button === 2` *and* as `contextmenu`; handle `contextmenu` for the menu
  suppression and let the timer handle touch only, or a right-click will also arm the hold timer.

### ⚠️ Three ways this can go wrong, all worth a test

1. **Double-fire**: right-click arms the hold timer *and* fires `contextmenu`, priming twice or toggling twice
   (which would un-prime). Toggle semantics make a double-fire actively harmful — it looks like priming is
   broken. Assert single-toggle explicitly.
2. **Priming in edit mode**: harmless (play does nothing anyway) but confusing. Recommend hiding the affordance
   in edit mode, consistent with the card's play button.
3. ⚠️ **The card is about to get a second gesture** — `PER_SOUND_VOLUME_SPEC.md` §2b puts a **live volume slider
   on every sound card**, decided 2026-10-06. Both features now compete for the same element:
   - **Hold/drag on the slider must adjust volume, not prime.** Prime on the card *body* only, and make the
     slider `stopPropagation` its pointer events (that spec requires the same thing to stop the card from
     playing, §2b.1) — one `stopPropagation` serves both features.
   - **Right-click on the slider** should probably not prime either, for the same reason.
   - Whoever builds second should re-read the other's card section. These two specs touch the same component and
     will conflict in review if both are implemented without this in mind.

---

## 4. Finding a sound by id

The one genuinely new piece of machinery. `playSound` takes a **sound object**, so the primed set of ids must be
resolved back to objects at trigger time.

⚠️ **Remember there are FIVE container shapes, not four** — `characters[].sounds`, `environmentSounds[].sounds`,
`groups[].categories[].sounds`, `groups[].characters[].sounds`, plus the vestigial `groups[].sounds` that
`addGroup` allocates and nothing writes to. A hand-rolled lookup that walks four will silently miss sounds.
**Use `allSoundContainers()` (App.jsx:1812)** — it is the one walker that gets it right, and it is already used
by move/copy and the reference-count guard. Build the id→sound map from its output.

Cheapest correct approach: one `useMemo` over the three slices producing a `Map<id, sound>`, rebuilt when they
change. Do not resolve inside the click handler by walking state each time.

---

## 5. Interaction with hotkeys (`HOTKEYS_SPEC.md`)

**A hotkey must fire the primed set too.** Route both through the same `playWithPrimes` chokepoint (§2). Two
triggers with different semantics is the thing to avoid here.

---

## 6. Model B — **rejected, recorded so it is not re-opened**

The user confirmed on 2026-10-06 that priming is **one-shot and not profile content**, so saved named layers are
out of scope. Kept here only as the reasoning:

- A saved layer would be a **new persisted structure** (e.g. `spellcaster_prime_layers`), i.e. a **new
  `localStorage` key** — which would make `PROFILE_SYNC_SPEC.md` §3/§4.2 (the 27-site / 10-path / 2-icon-key
  census) stale on the spot, and those numbers have already gone stale twice.
- It would have been content, and would have belonged *before* profiles so it rode the bundle.
- Its references would need the same dangling-reference policy as `HOTKEYS_SPEC.md` §4, because a layer outlives
  the sounds it points at.

**None of that applies any more.** Do not build Model B, and do not add a `localStorage` key for priming — that
absence is a deliberate design decision, not an oversight.

---

## 7. E2E notes

- **Desktop right-click is testable**: `Input.dispatchMouseEvent` with `button: 'right'` / `clickCount: 1` and
  `buttons: 2`. Assert the card toggles **once** (the double-fire trap in §3).
- **Press-and-hold is testable on both**: `Input.dispatchMouseEvent` pointer-down, wait > the hold threshold,
  pointer-up. On the mobile suite, prefer `Input.dispatchTouchEvent`; `dispatchMouseEvent` may not exercise the
  touch path that real phones use — test at least one real hold on a device.
- Assert the negatives: a press-and-hold that **moves** more than the threshold must **not** prime; a scroll
  across a card must not prime; a hold in edit mode must not prime.
- Sound cards are `div role="button"` — query `[data-sound-card]`, never `button`.
- **Card identity across containers matters here.** Priming is by sound id, so seed sounds in *different*
  container shapes and confirm each primes; that is the regression guard for the five-shape walker (§4).
- New IDs: **continue from `P1`** — coordinate with the other two queued specs, and whichever lands first should
  record the chosen continuation point in its own file.
- The Windows phase runs against real user data; a priming test must not leave a primed set behind (it is
  session state, so a reload clears it — but snapshot/restore still applies to anything you assert on disk).

---

## 8. Verification checklist

- [ ] Priming Fireball + Frostbite, then clicking Lay on Hands, plays **all three**.
- [ ] **The primed set is consumed:** triggering a second sound afterwards plays only that sound — no residue.
- [ ] Triggering twice quickly does **not** double-fire the primed sounds (the capture-and-clear-before-await
      ordering, §2).
- [ ] A primed sound plays exactly **once** per trigger, and pressing a primed sound does not double-fire.
- [ ] Un-priming (second gesture) removes it; the indicator disappears.
- [ ] Right-click toggles **once** — no double-fire from the hold timer (§3).
- [ ] Press-and-hold primes on mobile; **moving/scrolling cancels it**; it does not fire in edit mode.
- [ ] The native context menu never appears on a card.
- [ ] Press-and-hold does not raise the OS text-selection callout, and does not start a drag.
- [ ] **Every container shape works**: a primed sound in a character, an environment category, a group category,
      a group character, and the vestigial `groups[].sounds` (seed that one by hand — no UI puts anything there).
- [ ] Stopping a multi-primed trigger stops **all** the sounds it started, and `stopAllSounds` is unaffected.
- [ ] A primed sound whose file is missing does not break the primary trigger.
- [ ] Primed state does **not** survive a reload and does **not** appear in any exported bundle.
- [ ] **No `localStorage` key was added for priming** (§6 — the absence is deliberate).
- [ ] `npx eslint src/App.jsx` → 0 errors; `npx vite build` succeeds.
- [ ] E2E: web + Windows pass; mobile suite gains at least one real press-and-hold test.

---

## 9. Deferred / out of scope

- ❌ **Saved named layers (Model B)** — **rejected by the user 2026-10-06**; priming is one-shot and not profile
  content. Do not build. §6 has the reasoning.
- Priming **whole containers** ("prime this entire character") rather than individual sounds.
- Timing offsets ("fireball 0 ms, frostbite 250 ms") — a sequencing feature, much bigger than priming, and
  one-shot priming does not need it.
- Primed sounds surviving a trigger (that is sticky priming, which is **not** what was asked for).
- Priming from the **hotkey picker** — a hotkey fires the primed set (§5) but you cannot prime *from* a hotkey.
- Undo for a mis-prime (the "clear all" affordance in §2 is the v1 answer).