# Global shortcuts, macros and hotkey-only transfer

Status: user-requested checkpoint2026-11-03. Global shortcut implementation passes static/Node/native compilation and focused web checks; full platform regression and physical background-key acceptance remain pending. Macros and hotkey-only file transfer are planned only. No macro runtime/UI exists.
User scope: Windows global shortcuts, macros including timed sequences, and
hotkey-only export/import. Browser and Android retain focused in-app shortcuts;
the Tauri global-shortcut integration is desktop-only. PC must remain on.

## Compatibility

Hotkeys now use schema3 and read schemas1/2. Global key metadata and distinct sound/macro target validation are present; macro targets are currently unresolved because the macro runtime/UI has not been implemented. Unsupported saved versions remain locked until explicit repair.

Macros need their own profile-owned key and validated versioned payload. Include
them in complete profile export/import, Merge, snapshots, removal and restoration.
Plan bundle format 4/minimum reader 4: existing format-3 readers cannot preserve
macro data. Older bundles remain importable. Review collision remapping for macro
step sound targets when merging independent records with colliding sound IDs;
names alone must never choose an ambiguous target.

## Global shortcuts

Use Tauri's supported global-shortcut plugin, guarded to desktop/Windows in both
native entry points. Official setup/permissions:
[Tauri global-shortcut setup and permissions](https://v2.tauri.app/plugin/global-shortcut/)

Global mode is opt-in per binding; require Ctrl or Alt and keep current reserved
chords. Show real registration failures and conflicts. Global and local listeners
must never fire the same binding twice. Register only the active profile's valid,
resolved bindings; cleanup and serialize registration changes on profile switch,
editing, imports and teardown. Keep existing modal/edit/capture suppression.
Check plugin registration on real Windows; background physical-key behavior also
needs user hand-testing if Computer Use input permission remains unavailable.

Implementation review: the Windows backend uses virtual keys and MOD_NOREPEAT;
it polls release separately. Handle Pressed once and do not add a release latch
that can swallow fast consecutive real presses. Review keyboard-layout mapping:
DOM physical codes and Windows virtual-key names are not interchangeable on all
layouts. Record a suitable native combination or clearly reject unsupported keys;
never silently bind a different key. Verify against the installed crate version.
[Upstream Windows backend](https://github.com/tauri-apps/global-hotkey/blob/dev/src/platform_impl/windows/mod.rs).

## Macros and timed sequences

Provide named profile-owned macros with play-sound, stop-sound and stop-all actions.
Each step has a delay before it; zero-delay steps run together/in order. Play uses
the same path as card/hotkey playback, including one-shot primes. Validate IDs,
delays, action types, maximum steps and missing/ambiguous targets before saving.
Keep unresolved references visible and repairable after sound deletion/import.

User confirmed restart on repeat trigger; preserve already-playing audio. Cancellation must prevent
remaining steps, profile switches must cancel the departing profile's runs, and
Stop All must stop playback plus scheduled work. Review pending async audio reads
so a stopped/cancelled run cannot create an orphan player. Do not execute imported
macros during preview/import. A fake-clock scheduler check must cover cancellation,
same-time ordering, failures, teardown and duplicate triggers.

User confirmed repeat behavior: restart pending steps, keeping already-started audio until stopped. Entering edit mode cancels pending steps: the existing shared play
path deliberately refuses playback in edit mode, so silently skipping timed steps
would be incorrect. A Stop All step should stop audio and other pending sequences
while allowing its own following steps; the main Stop All control cancels all runs.
Use a playback-request generation guard for delayed audio reads so stop actions
cannot be followed by an orphan player. Keep zero-delay batches ordered and use
absolute due times to avoid accumulating dispatch drift.

Expose Run/cancel controls and configuration on screen as well as keyboard binding,
so macros remain useful on Android without a hardware keyboard.

## Hotkey-only export/import

The small control file excludes board records and audio. Include macro definitions
needed by shortcut bindings (and clearly label the scope). Validate the entire file
before preview. Offer explicit conflict handling/merge versus replace and list
unresolved targets; never guess among equal names. Save bindings and macro data
in one profile metadata transaction, preserving the previous controls on failure.
Use native pickers on Windows/Android and browser download/file input on web.

Register each capability as planned before implementation. Extend meaningful Node
fault checks and shared UI E2E, register every new test ID, then run the full platform
gates once the combined keyboard milestone is ready. User hand-test remains required.

## Dependency preparation

Published crate inspection found plugin2.4.x requires native Tauri2.12, while this
project uses2.11.3. Prefer matched JS/Rust plugin2.3.2, whose native requirement is
Tauri2.10 and Rust1.77.2; JS requires API^2.11, and installed API2.12.3 satisfies it.
Installed rustc1.97.1 is sufficient. Pin the plugin and review the actual lockfile
diff rather than updating unrelated Tauri dependencies. Crate2.3.2 invokes handlers
while holding its shortcut map lock: use its asynchronous JS channel; never call
registration APIs synchronously from a Rust handler. Its global-hotkey0.8.0 Windows
backend was inspected from the published crate: MOD_NOREPEAT, virtual-key mapping
and50ms release polling are confirmed, so no frontend release latch is appropriate.
Implemented package, lockfile, Windows capability and both native entry-point changes use2.3.2. Cargo.lock added only5 packages; native Tauri remains2.11.5. The background physical-key hand-test and native GS conflict suite are still pending.
[Published source metadata](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/global-shortcut/package.json).

## Review points before implementation

Global and local keys need separate collision checks: local identity is physical
code+modifier mask; native identity follows the recorded Windows virtual key.
When a native chord owns an event, suppress local dispatch for that entire event,
including another binding whose physical code happens to match on this layout.
Old local bindings need re-recording before global mode can infer a native key.
Do not guess OEM punctuation mappings from a character. Resolve this explicitly
in validation and UI before shipping. Also review Windows AltGr, which can look
like Ctrl+Alt to native registration; current local hotkeys explicitly reserve it.

Keep registration calls serialized. A timeout can disable/fence callbacks and
show an error, but it cannot prove a hung native operation has stopped. Do not
start overlapping registrations after a timeout or let late cleanup unregister
a newer profile's shortcuts. Callback ownership must change synchronously on
profile switch/remount; native work follows it. On delayed completion, clean up
before reconciling the newest requested owner. Report a stuck registration as
requiring restart rather than pretending it was removed.

Use distinct target identities for sounds and macros rather than relying on a
magic sound-ID prefix. Existing sound picker data attributes can remain stable.
Merge must explicitly mark targets unresolved when their original sync identity
has disappeared; leaving an old UI ID can accidentally bind an unrelated incoming
sound with that ID. An explicit repair should clear that unresolved marker.
A macro should preflight all targets before starting and re-resolve immediately
before each delayed action; missing/deleted/ambiguous targets stop the run with
a visible error. Data validation never runs imported actions.

For macro playback, keep a cancellation token alive through pending audio reads,
not just until the last timer fires. A completed scheduling loop must not cancel
its final play action before its file resolves. Track outstanding action promises
separately from due timers; dispatch equal-time steps in order without awaiting
file I/O. Use global/per-sound stop generations plus the run token before creating
an Audio element. A Stop All step advances the audio generation and cancels other
runs, while its later steps capture the new generation. Main Stop All cancels all.
A primed trigger also needs a shared cancellation token for a primed file still
loading when its already-playing primary is stopped.

Control-file design proposal: use a small versioned JSON file (.spellkeys), containing
hotkeys, macro definitions and sound target metadata, with no board records or bytes.
Use sync identity for automatic sound remapping when unique; do not silently choose
an unrelated sound just because a UI ID or name matches. Preview unresolved targets
and allow importing them inert for explicit repair. Merge keeps current conflicting
bindings; Replace explicitly replaces controls. Macro-ID collisions during Merge
need new IDs and remapped imported macro bindings. Save both keys atomically only
after preview confirmation. Recheck active profile and current controls at commit,
so a delayed read/preview cannot overwrite another profile or newer edits.
