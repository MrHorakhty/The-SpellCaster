# Hotkeys — Planning Spec

> **Status**: **New spec, 2026-10-06.** Design only — **implementation is not authorised.** No app code has been
> written. Line numbers verified against `src/App.jsx` at **6240 lines** on 2026-10-06; re-verify before editing.
> **Created**: 2026-10-06
> **Related**: `PER_SOUND_VOLUME_SPEC.md`, `SOUND_PRIMING_SPEC.md`, `PROFILE_SYNC_SPEC.md`.
> ⚠️ **Recommended order: after profiles.** See §1 — the deciding factor is that a hotkey is a *reference to a
> sound*, and profiles are what force that reference story to exist properly.

---

## 0. What the user asked for

"Ability to Add Hotkeys" — bind a key to a sound so it can be triggered from the keyboard.

---

## 1. Why this one should come *after* profiles, and the other two should not

A hotkey is **not** a piece of content; it is a **pointer at** content. That single fact drives everything below.

`PROFILE_SYNC_SPEC.md` already has to answer hard questions about sound identity: its §8 "unresolvable audio
references" policy exists because an imported profile can reference audio the local app does not have, and its §3
warns that **categories have no id — identity is the display name**. Hotkeys multiply both problems.

**Therefore: build hotkeys after the profile work, and store them per profile.** Then a hotkey's target always
resolves within the profile that contains it, and it rides the bundle for free with the rest of the board.

The alternative — global (device-level) hotkeys with per-profile content — produces a feature whose bindings
break every time the user switches profile or imports a new one, with no obvious moment at which they broke. Do
not build that by accident.

---

## 2. Two tiers — decide which one, because the cost differs by 10×

| | **In-app hotkeys** | **Global hotkeys** |
|---|---|---|
| Scope | only while the SpellCaster window has focus | work while any app has focus |
| Implementation | a `keydown` listener | `tauri-plugin-global-shortcut` — a **new dependency**, OS-level registration |
| Desktop | ✅ | ✅ |
| Android | n/a (no keyboard) | ❌ plugin is desktop-only |
| Extra risk | low | see §3 |
| Recommend | **ship this first** | add later if asked |

**In-app first.** It covers the real use case (GM hands are on the keyboard, the board is on screen) with zero new
dependencies, and it is testable in the existing harness on web and Windows.

### ⚠️ The input-capture problem (this is the real work)

A soundboard has **many text inputs** — the volume text field (`volumeInput`, App.jsx:1068), the sound-name
field, the numeric `duration`/`fadeIn`/`fadeOut` fields (5529-5553), the `boxSize` field, the move/copy picker's
filter, search boxes. A binding on `1` must **not** fire when the user types "1" into a field.

Every handler must therefore bail out when:

```js
const tag = e.target?.tagName
if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
if (e.ctrlKey || e.metaKey || e.altKey) return          // don't steal browser/app shortcuts
if (e.repeat) return                                    // holding a key must not machine-gun
```

Plus: **do not fire while a modal is open.** There are already two `keydown` listeners to coordinate with —
App.jsx:728 (document-level) and App.jsx:2166 (capture-phase, closes the move/copy modal on `Escape`). A global
capture listener that fires before a modal's own handler will make the modal un-closable. Bind with
`document.addEventListener('keydown', handler)` (bubble phase) unless a test proves otherwise.

⚠️ `Escape` must stay reserved. So must anything the app already uses.

---

## 3. If global hotkeys are wanted: the plugin-registration trap

`tauri-plugin-global-shortcut` is **desktop-only**. Register it in `src-tauri/src/main.rs` **only** — and this is
the **reverse** of the `tauri-plugin-dialog` rule in `PROFILE_SYNC_SPEC.md` §10, where registering in only one
place is a bug:

| | dialog | global-shortcut |
|---|---|---|
| missing from `lib.rs` | ❌ broken on mobile (`Plugin not found`) | n/a — mobile doesn't need it |
| registered in `lib.rs` too | harmless but pointless | ⚠️ **may fail to build or behave badly on Android** — `lib.rs` is the mobile entry point |

So: `main.rs` only, and **verify `cargo check` with the Android target** after adding it
(`cargo check --target aarch64-linux-android` or just a Gradle build), because a desktop-only plugin in the
mobile binary is exactly the kind of thing that passes a desktop build and breaks the APK.

Registration is a runtime side effect (it reserves the key with the OS), so also decide the lifecycle: register
on mount / on binding change, and **unregister on unmount and on hotkey rebinding**, or the keys stay captured by
a dead process and the OS refuses to hand them to the next instance.

---

## 4. Data model

Per profile. A binding is a **reference plus a display snapshot**:

```json
{
  "id": "hk_a1b2c3",
  "key": "1",                                  // normalised: see below
  "target": {
    "containerType": "character",              // character | groupCharacter | environment | group
    "containerId": "Sir Bram",                 // ⚠️ for categories this IS the display name
    "groupId": null,
    "soundId": "sound_1757..._k3f9x2"
  },
  "displayName": "Fireball"                    // snapshot, for the UI when the target is gone
}
```

⚠️ **This is the same reference shape `transferSound` already uses** (App.jsx:2108, 2123, 2144:
`{ containerType, containerId, groupId }`) plus the sound's own id. Reuse it — do not invent a second one.

### Key normalisation (do this once, in one helper)

Compare and store keys **canonically**, or bindings silently fail: `KeyboardEvent.key` is layout-dependent
(`'1'` vs `'Digit1'`, `'/'` vs `'Slash'`, `' '` vs `'Space'`). Store `e.code` (`'Digit1'`, `'Slash'`, `'Space'`) and
accept `e.code` on lookup — it is layout-independent and stable. Keep `e.key` only for display.

### ⚠️ Dangling references are normal, not exceptional

Three ordinary actions break a binding, and all three are things users do:

1. **Renaming a category** — `containerId` is the *display name* for categories (the known identity landmine).
2. **Deleting the sound**, or its whole container.
3. **Importing a profile** that lacks the referenced sound.

Policy (mirroring `PROFILE_SYNC_SPEC.md` §8): **keep the binding, show it as unresolved, let the user repair or
delete it.** Do not auto-delete, do not auto-remap by name (names collide), and never leave a hotkey that fires
nothing while looking live. The `displayName` snapshot is what makes a broken binding explainable.

Sound ids are minted once and never regenerated (`mintId('sound')`, App.jsx:260, called at 1485 and 2045), so an
id-based reference is stable **within** a profile's lifetime — which is exactly why bindings belong inside the
profile.

---

## 5. Where the UI goes

A "Hotkeys" section in the existing Settings modal, alongside the "Profiles & Sync" section that
`PROFILE_SYNC_SPEC.md` §9.2 plans — reuse that modal rather than adding an eighth one. Per row: the key
(combo box, click-to-record), the target sound (picker, same pattern as the move/copy picker), and a status
dot for unresolved targets.

⚠️ **Recording a key inside a text input is a UX trap**: the field swallows the keystroke. Either bind on
`keydown` with `preventDefault` in a capture phase, or use a "press a key…" button that captures the next
`keydown` at the document level.

### Decisions to make before coding

- Chords (`Ctrl+Shift+1`) or single keys? **Single keys for v1**, with modifiers reserved (§2).
- Can one key trigger several sounds? **No** — one binding, one target. Multi-sound triggering is
  `SOUND_PRIMING_SPEC.md`'s job; don't build it twice.
- Does the key **toggle** or **trigger**? `playSound` (App.jsx:3256) starts; `stopSound` (3472) stops. Decide
  whether a second press stops the sound, and make it consistent with what clicking the card does.
- Looping sounds: if the key stops a looping sound, is that a "stop" or a "toggle"? Same question as above.
- **Does a hotkey respect `editMode`?** `playSound` early-returns when `editMode` is true (App.jsx:3257), so a
  binding pressed in edit mode should do nothing. Keep that behaviour rather than special-casing it.
- Should a hotkey also fire the sound's **primed** sounds? **Yes** — that is what a user expects, and it is
  `SOUND_PRIMING_SPEC.md`'s model A.

---

## 6. E2E notes

- **CDP can send keys**: `Input.dispatchKeyEvent` with `type: 'keyDown'`/`'keyUp'` and a `code`. That makes
  in-app hotkeys fully testable on **web and Windows**.
- **Android has no keyboard** — this feature is untestable there, and the mobile suite should not try. Say so in
  the suite rather than skipping silently.
- ⚠️ Do **not** drive `DOM.setFileInputFiles` — it kills the Android WebView renderer (already documented in
  `e2e-mobile.mjs`); a hotkey target picker is a reason to prefer calling an in-page function, as
  `PROFILE_SYNC_SPEC.md` §9.3 does.
- New IDs: **continue from `P1`** unless `PER_SOUND_VOLUME_SPEC.md` or `SOUND_PRIMING_SPEC.md` got there first.
- Test the negatives, they are the real risks: pressing a bound key **while typing in a field** fires nothing;
  pressing it **with a modal open** fires nothing; a **dangling** binding is visible and inert; **`Escape`**
  still closes modals; a **rebound** key fires only the new target.

---

## 7. Verification checklist

- [ ] A bound key triggers its sound while the window is focused.
- [ ] The key does **not** fire while any text field has focus (test with a digit key, which is the worst case).
- [ ] The key does not fire in edit mode, or fires consistently with the card behaviour — decided in §5.
- [ ] `Escape` and existing app shortcuts still work; no binding can shadow them (enforced in the picker).
- [ ] Binding the same key twice is **refused or reassigned**, never silently duplicated.
- [ ] A **deleted** target leaves the binding visible, marked unresolved, and firing nothing.
- [ ] A **renamed category** does not silently break a binding into a different sound, and vice versa.
- [ ] Rebinding releases the old key (no stale registration, especially if global hotkeys are enabled).
- [ ] Two profiles have independent binding sets; switching profiles swaps them.
- [ ] Bindings survive an export/import round trip with the target resolving (or degrading to unresolved, cleanly).
- [ ] `npx eslint src/App.jsx` → 0 errors; `npx vite build` succeeds.
- [ ] E2E: web + Windows pass; mobile suite is unchanged and does not attempt key dispatch.

---

## 8. Deferred

- **Global (out-of-app) hotkeys** — §3. Only after the in-app tier is solid, and only if the user actually needs
  to trigger sounds while another window has focus.
- Chords / multi-modifier bindings.
- One key → several sounds (belongs to priming).
- Profile-level **macro** scripts ("play X, wait 200ms, play Y").
- Import/export of hotkey *sets* as a separate shareable file (the profile bundle covers this).