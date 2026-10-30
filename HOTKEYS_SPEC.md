# Hotkeys — Planning Spec

> Status: design reviewed against the working tree on 2026-10-31. Spec review is
> authorized; app implementation is not yet authorized. No hotkey code is shipped.
> Profiles v1 and one-shot priming are shipped, so the original prerequisite is met.
> Related: PROJECT_STATE.md and PROFILE_SYNC_SPEC.md (future merge/sync scope).

## 1. Scope and behavior

V1 binds one physical key to one sound in the active profile, while the app has
focus. No new native dependency or OS-wide registration. Global shortcuts, chords,
macros, MIDI and separate binding-set export remain deferred.

A press behaves like clicking the sound card: call `playWithPrimes`, not
`playSound` directly. Each accepted press triggers playback, including another
instance if that sound is already playing; it does not toggle stop. This applies
to loops too. Existing stop controls retain their current behavior, including
primed-group stopping. Edit mode suppresses triggering. Priming remains one-shot:
the first accepted trigger consumes it; rejected/unresolved presses do not.

Bindings work across all tabs of the active profile, including sounds off screen.
A sound may have several different keys; each key has exactly one target.
Duplicate codes are refused with the existing target named; no silent reassignment.

## 2. Key policy and event handling

Store and compare `KeyboardEvent.code`, with a separate recorded `key` label for
display. Physical position is the contract across keyboard layouts; the recorded
label can become stale after a layout change, so show the code alongside it.

V1 allowlist: `KeyA`–`KeyZ`, `Digit0`–`Digit9`, `Numpad0`–`Numpad9`.
Reserve Enter, Space, Escape, Tab, arrows, navigation keys, function keys,
punctuation and all modifier keys. This avoids card activation, focus navigation,
modal Escape and platform shortcut collisions. Reject Ctrl, Meta, Alt, Shift,
AltGraph, composition/dead/process/unidentified events and auto-repeat during both
recording and triggering. A shifted key is not a second binding.

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
  "label": "1",
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
Payload: `{ "version": 1, "bindings": [] }`. Missing key means no bindings.
Validate ids, codes, target shapes and duplicate codes on load/import. Invalid
rows must never register; surface an actionable warning and preserve original
stored data until repair is explicitly saved. An unknown payload version must
not be overwritten by an automatic empty-state save.

Bindings must be wired explicitly into all of these paths during implementation:

- App initialization, durable writes and profile switch/create/duplicate/delete.
- `collectProfileForExport`, bundle payload validation and `commitKeys` (including
  its written-key allowlist), plus normalized return/state hydration.
- Snapshot/restore, rollback, replacement import and restore-default behavior.
- Profile storage/key guards and browser/native fixture seed/cleanup inventories.

Planned bundle field: `data.hotkeys`, using the versioned payload above. A bundle
without it imports as empty bindings, including replace-active; it must not retain
the previous board's keys. A new-profile import keeps sound ids and resolves only
within that new profile. Profile duplication copies bindings into the new namespace.
No bindings belong in GLOBAL_KEYS. Do not add a new key to the legacy migration
list merely because it is profile-scoped; it never existed before profiles.

Export is currently an explicit field selection, and replace-import deletes keys
outside its allowlist. A separate binding collection does NOT ride the bundle
for free. Test format compatibility and decide whether the bundle format version
must advance before shipping; older builds must not silently destroy bindings
under a claimed lossless round trip. Native bundle support does not authorize or
supply web audio bundle export/import, which remains deferred.

During switching/import, stop hotkey dispatch before changing the profile and
resume only after target data and bindings are hydrated. A failed switch/import
restores both consistently. No outgoing-profile write may land in the incoming
namespace. Failed storage writes must use the existing actionable error handling.

## 5. Settings UI

Add a Hotkeys section to the existing Settings modal, alongside the shipped
Profiles controls. Show key label/code, sound and location, and explicit unresolved
status. Provide Add, Record/rebind, Choose/repair target and Remove actions.
Use the existing move/copy picker patterns across all five container shapes.
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

## 6. Implementation and coverage plan

Hotkeys are already registered as a planned feature
in `e2e/coverage.manifest.json`. When implementation is authorized, add pure
validation/resolution/event-policy Node
checks and register their command/count in AGENTS.md gate 5. Pick a fresh suite
prefix after checking the manifest; do not reserve a supposedly free numeric
range in an existing suite. Register platform wiring, run --update and review ids.

Required cases:

- Trigger, repeated presses/overlap, loop behavior, priming consumed once and edit
  mode; no repeat/composition/modifier activation or Enter/Space double trigger.
- Editable descendants, every modal/drawer, drag, prevented event, capture cancel,
  listener cleanup/remount, blur and profile/import transition suppression.
- Duplicate refusal, rebind removes old dispatch, canceled draft unchanged,
  rename/move preserved, copy stays with original, delete/prune unresolved,
  duplicate sound id inert, repair and removal.
- Independent profiles, rapid switch without stale dispatch, reload persistence,
  duplicate/delete/defaults, native bundle round trip, legacy bundle with no field,
  replace-active clears old keys, malformed/unknown versions and failure rollback.
- Web and Windows real key dispatch through CDP, not only calling a helper.
  Android management/persistence/bundle regression tests plus explicit hardware
  keyboard coverage or a registered, visible hardware-test gap. Never use
  DOM.setFileInputFiles on Android; the renderer crash warning still applies.

Before shipping run all AGENTS.md gates in order, report actual counts/exits, and
obtain the user's hand-test of the built app. Do not run E2E/orphan cleanup during
an active Android Studio release companion session. Spec review alone proves no
hotkey behavior and needs no app hand-test.

## 7. Current-code anchors (reviewed 2026-10-31)

- `src/App.jsx:1280`: drawer key handler; `:3066`: move/copy capture handler;
  `:4802`: drag Escape handler (recheck exact positions before implementation).
- `src/App.jsx:2661`: transfer references; `:2739`: five-shape sound index;
  `:2757`: sound-container lookup. Existing first-match lookup needs ambiguity
  handling for imported hotkey targets, not blind reuse.
- `src/App.jsx:4189`: playback entry; `:4496`: stopTrigger; `:4511`:
  playWithPrimes; `:4860` and `:4868`: card click/keyboard paths.
- `src/App.jsx:7470`: Settings; `src/profileStorage.js:53`: legacy keys;
  `src/profileBundle.js:889`: commitKeys; `:1102`: collectProfileForExport.

The earlier plan changed because profiles have shipped, card triggering is now
verified, groupTop exists, and bundle serialization requires explicit work.
Global-shortcut plugin placement is deferred research: inspect current platform
entry points, dependency cfgs and capabilities if global scope is later requested.
