# Profile hotkeys — shipped design

> User accepted the searchable picker and working modifier combinations on 2026-11-01.
> This is the maintained design record. Verification and operational warnings live in PROJECT_STATE.md.
> Related future work: PROFILE_SYNC_SPEC.md (timestamps, merge, transport sync).

## 1. Scope and behavior

Each binding assigns one physical trigger key to one sound in the active profile, while the app has
focus. No new native dependency or OS-wide registration. Ctrl/Alt/Shift combinations are supported in-app. Global shortcuts,
macros, MIDI and separate binding-set export remain deferred.

A press behaves like clicking the sound card: call `playWithPrimes`, not
`playSound` directly. Each accepted press triggers playback, including another
instance if that sound is already playing; it does not toggle stop. This applies
to loops too. Existing stop controls retain their current behavior, including
primed-group stopping. Edit mode suppresses triggering. Priming remains one-shot:
the first accepted trigger consumes it; rejected/unresolved presses do not.

Bindings work across all tabs of the active profile, including sounds off screen.
A sound may have several different keys; each key has exactly one target.
Duplicate code/mask combinations are refused with the existing target named; no silent reassignment.

## 2. Key policy and event handling

Store and compare `KeyboardEvent.code`, with a separate recorded `key` label for
display. Physical position is the contract across keyboard layouts; the recorded
label can become stale after a layout change, so show the code alongside it.

Supported triggers: letters, top-row/numpad digits, punctuation (including the
international backslash), numpad operators/decimal/comma, F1–F4 and F6–F10.
Combine a trigger with any subset of Ctrl, Alt and Shift. Modifier keys alone keep
recording active; Escape cancels. Store a bit mask (Ctrl=1,Alt=2,Shift=4), and match
the physical code AND exact mask. Bare1,Ctrl+1 and Shift+1 are distinct bindings.

Keep Enter, Space, Escape, Tab, arrows, navigation, Meta, AltGraph, F5/F11/F12 and
common browser/window shortcuts reserved. The explicit reserved chords are Ctrl+
W/T/R/L/P/O/S/H/J/D/N/F/Q,Ctrl+F4,Alt+F4 and Ctrl+Shift+I/C. The same policy validates
saved rows and records/dispatches events. Reject composition/dead/process/unidentified
events and auto-repeat. Hardware/OS shortcuts intercepted before the WebView cannot
be assigned. Numpad navigation without Num Lock remains reserved.

Use one bubble-phase document listener with cleanup. Before triggering, reject:

- `defaultPrevented`, composition, repeat or any prohibited modifier;
- editable targets or ancestors: input (including number/range), textarea, select,
  contenteditable and textbox roles; inspect the composed event path as needed;
- edit mode, an open modal, settings, About, the side drawer, an active drag,
  binding capture, or an active profile/import transition;
- missing, malformed, duplicate or unresolved binding targets.

Use a shared interaction-blocked predicate rather than a partial modal list.
Respect the existing capture-phase Escape handlers. Only prevent the default on
an accepted binding event. Do not stop unrelated keyboard propagation. Listener
state must track the current profile and board without stale closures or duplicate
registrations under React effect remounts. Blur/visibility loss cancels recording;
composition end does not replay a discarded keystroke.

## 3. Target identity

Use a sound id as the authoritative identity within the owning profile. Keep a
container reference and display snapshot for the picker and unresolved row:

```json
{
  "id": "hk_a1b2c3",
  "code": "Digit1",
  "modifiers": 1,
  "label": "Ctrl+1",
  "target": {
    "soundId": "sound_1757_k3f9x2",
    "containerType": "character",
    "containerId": "character_123",
    "groupId": null
  },
  "displayName": "Fireball"
}
```

Reuse `allSoundContainers` and the transfer reference shape. There are FIVE shapes:
character, environment, groupCharacter, group and groupTop. Environment/category
container ids are names; they must not determine a sound's identity. Resolve only
inside the active profile, requiring exactly one matching sound id. Never fall
back to matching a name. Duplicate sound ids in malformed/imported data make the
binding unresolved rather than firing the first match.

A category rename or sound move preserves its sound id and therefore its binding;
refresh the location/display metadata from the resolved target. Copying creates
a new sound id and leaves the binding attached to the original. Deleting a sound
or its container leaves a visible unresolved binding, repairable or removable.
Import pruning of missing audio may also remove a target: keep its binding and
show the reason. A sound that still exists but has unusable audio follows the
existing playback error path; do not present success when playback fails.

## 4. Persistence and profile bundles

Planned scoped key: `ttrpg_hotkeys`, accessed through profileStorage wrappers.
Payload: `{ "version": 2, "bindings": [] }`. Missing key means no bindings.
Version1 remains readable as unmodified bindings; explicit edits save version2.
Older builds refuse version2 rather than silently firing chords as bare keys.
Validate ids, codes, modifier masks, target shapes and duplicate code/mask pairs on load/import. Invalid
rows must never register; surface an actionable warning and preserve original
stored data until repair is explicitly saved. An unknown payload version must
not be overwritten by an automatic empty-state save.

Bindings must be wired explicitly into all of these paths during implementation:

- App initialization, durable writes and profile switch/create/duplicate/delete.
- `collectProfileForExport`, bundle payload validation and `commitKeys` (including
  its written-key allowlist), plus normalized return/state hydration.
- Snapshot/restore, rollback, merge import and restore-default behavior.
- Profile storage/key guards and browser/native fixture seed/cleanup inventories.

Bundle field: `data.hotkeys`, using the versioned payload above. A bundle
without it creates a new profile with empty bindings; Merge keeps destination
bindings. A new import must not inherit another profile's keys. A new-profile import keeps sound ids and resolves only
within that new profile. Profile duplication copies bindings into the new namespace.
No bindings belong in GLOBAL_KEYS. Do not add a new key to the legacy migration
list merely because it is profile-scoped; it never existed before profiles.

Export, pruning, new-import allowlists and key commits explicitly carry the
binding collection. Bundle formats2/3 carry data.hotkeys; format1 imports default
to empty bindings in a new profile; Merge retains destination bindings. Old readers refuse unsupported bundle
or hotkey payload versions rather than silently dropping bindings/modifiers.
Native bundle support does not supply web audio bundle export/import, which
remains deferred.

During switching/import, stop hotkey dispatch before changing the profile and
resume only after target data and bindings are hydrated. A failed switch/import
restores both consistently. No outgoing-profile write may land in the incoming
namespace. Failed storage writes must use the existing actionable error handling.

## 5. Settings UI

Add a Hotkeys section to the existing Settings modal, alongside the shipped
Profiles controls. Show key label/code, sound and location, and explicit unresolved
status. Provide Add, Record/rebind, Choose/repair target and Remove actions.
User approved a searchable sound picker with location paths and compact assigned-binding rows on 2026-11-01. Search matches sound names and their full locations across all five container shapes; results scroll within a bounded list. Keep the selected sound visible beneath results even when the query changes. Duplicate sound IDs are unavailable. User accepted this picker UI and requested working modifier combinations; these passed all automatic gates and the built-app user hand-test.
Keep empty states and errors visible and keyboard accessible.

Recording starts from a button, never a text input. Settings blocks playback while
a dedicated temporary recorder accepts the next allowed key. Escape cancels;
invalid/duplicate keys explain why and keep recording; Cancel, blur, profile change
and unmount remove capture listeners. Commit only after both a valid key and a
target are selected. Canceling a draft must not alter a persisted binding.
Focus returns to the initiating control. No silent replacement of another row.

Android can use an external keyboard; do not describe keyboard use as impossible.
Bindings/settings must survive Android profile/bundle operations. Touch-only use
needs no keyboard to inspect, choose targets or remove bindings. In-app dispatch
may work with attached keyboards; do not promise hardware behavior without testing.

## 6. Verification and maintenance

Hotkeys is shipped in `e2e/coverage.manifest.json`, covered by `specs/hotkeys.mjs::HK`.
The user accepted the initial behavior, revised picker, and modifier combinations.
`e2e/hotkeys.check.mjs` is registered as the tenth gate-5 check (120/120). Shared
`specs/hotkeys.mjs` registers HK0–HK46 on all three platforms. The id diff was
reviewed: no existing ids changed. Android physical keyboard delivery remains a
visible gap; emulator CDP input is covered. Final modifier results2026-11-01:web360/0/0(exit0),
Windows379/0/3 and Android369/0/3(expected native WARN exit1). Initial unrelated
icon/loop-fade failures passed unchanged retries; evidence retained. Android
original28-key debug-app snapshot was manually restored and verified FROM DISK;
runner flush/cold-read safety debt is recorded in PROJECT_STATE.md.

Covered cases:

- Trigger, repeated presses/overlap, loop behavior, priming consumed once and edit
  mode; exact modifier matching, no repeat/composition/Meta/AltGraph activation or Enter/Space double trigger.
- Editable descendants, every modal/drawer, drag, prevented event, capture cancel,
  listener cleanup/remount, blur and profile/import transition suppression.
- Duplicate refusal, rebind removes old dispatch, canceled draft unchanged,
  rename/move preserved, copy stays with original, delete/prune unresolved,
  duplicate sound id inert, repair and removal.
- Independent profiles, rapid switch without stale dispatch, reload persistence,
  duplicate/delete/defaults, native bundle round trip, legacy bundle with no field,
  new-profile legacy imports default to empty bindings; Merge keeps local bindings, malformed/unknown versions and failure rollback.
- Web and Windows real key dispatch through CDP, not only calling a helper.
  Android management/persistence/bundle regression tests plus explicit hardware
  keyboard coverage or a registered, visible hardware-test gap. Never use
  DOM.setFileInputFiles on Android; the renderer crash warning still applies.

After changes run the applicable AGENTS.md gates, report actual counts/exits, and
obtain the user's hand-test of the built app. Do not run E2E/orphan cleanup during
an active Android Studio release companion session. Spec review alone proves no
hotkey behavior and needs no app hand-test.

## 7. Current code anchors

- src/hotkeys.js:4: supported physical codes; :6: modifier mask and identity;
  :18: payload validation; :83: event policy.
- src/HotkeySettings.jsx:34: recording conflicts; :56: durable binding draft;
  :86: searchable target picker.
- src/App.jsx:897: profile state; :4566: exact dispatch; :7680: Settings.
- src/profileBundle.js:67: bundle format3 (record history; hotkeys introduced in2); key commit/export collection line numbers have shifted with merge support.

Historical planning/code anchors are preserved in docs/session-history.md.
