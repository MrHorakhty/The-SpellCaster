# Transfer improvements

Status: implemented, full regression passed, user hand-test accepted 2026-11-03. Atomic
persistence passed all platform gates before transfer implementation began.

User scope (2026-11-03): cross-container dragging, whole-container move/copy and
destination creation inside the transfer picker. Whole-container actions include
both transferring every sound into an existing destination and transferring the
container itself, preserving its name and icon.

## Common rules

All operations stay inside the active profile. Moves retain sound IDs and file
references so hotkeys continue to resolve. The existing hierarchical merge format
represents a move across parents as a tombstone at the old location plus a new
sync-record identity at the destination. Preserve that contract: retaining the old
sync identity in both places makes current bundle validation reject the board.
Copies mint new identities recursively; they share uploaded bytes and do not inherit the original
sound's hotkey bindings. Names must be unique where names identify a container.
Silent move removal must never call deletion handlers or remove uploaded bytes.
The source and destination changes belong to one React commit and one atomic save.
The current unsaved-change warning remains authoritative on storage failure.

## Destination creation

The existing sound picker offers creation of a character, environment category,
group, or a character/category inside a group. Capture and validate the destination
before committing. Cancelling creation or transfer changes nothing. An empty group
is a valid location for creating its first character/category. Group mode and
existing container names determine which destinations are offered; never hide
existing content simply because a group's mode is stale. Creating a destination
should not unexpectedly navigate the source board away.

## Bulk and container transfer

Expose actions from character/category/group controls in edit mode. Distinguish
"All sounds" from "Container" in the picker so users can see whether the wrapper
is retained. Bulk sound transfer appends in source order, with unique copy names;
a bulk move empties the source without deleting its wrapper. Reject self-moves
and show empty-source guidance. Group bulk actions walk all sound-container shapes.

Moving a character/category wrapper between its main section and a group preserves
its name/icon, sounds and UI identity; copying creates a separate wrapper and separate
sound identities. Resolve name collisions without overwriting existing containers.
If an older profile has the same wrapper ID in both locations, remap the moved
wrapper's ID at the destination while retaining every sound ID and hotkey target.
The current data model has no nested groups: do not introduce nesting implicitly.
Offer group duplication at the root and group sound transfers into destinations.
Preview the affected container and sound count before committing.

## Cross-container dragging

Retain current same-container reordering, drag ghost, cancellation and auto-scroll.
Add explicit destination hit regions for visible sidebar containers and split
panels, using the same transfer operation as the picker. Dropping on an invalid,
deleted or current destination must leave the board unchanged. A normal drop moves
the sound; copying remains available through the picker. Do not overload the
existing prime gesture outside edit mode. Touch behavior must have an actual
reachable destination rather than silently claiming desktop-only coverage.

## Verification

Register focused shared E2E for destination creation/cancellation, both bulk modes,
all wrapper locations, copy identity/file ownership, hotkey retention after moves,
name collisions, empty/deleted targets, reload and real drag gestures. Exercise
desktop split panels and Android's reachable drag destinations. Run all static and
Node gates between features; full web/Windows/Android E2E at milestone completion.
User hand-test of the built app remains required before acceptance.

Current automated verification (2026-11-03): web417/0/0(exit0),Windows427/0/3
(expected exit1),Android417/0/3(expected exit1). All25shared transfer cases passed,
including Windows mouse and Android touch drops. Initial Windows426/1/3 had the
existing Z22 fade sampling failure; unchanged retry passed. Original Windows22
keys/8uploads restored; Android28keys matched after cold restart. Static/13Node
and Android tooling gates passed. Desktop/mobile picker and creation form reviewed
without horizontal overflow. Evidence: logs/keep/transfers-20261103/verification.md.
Standalone release built/opened; user accepted all transfer behavior after testing on2026-11-03.
