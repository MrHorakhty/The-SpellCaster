# Record history and merge import

Record history and native merge were hand-tested and accepted by the user on
2026-11-01: rename, addition, deletion, playback and restart persistence. Full
regression results are in PROJECT_STATE.md. The user confirmed manual file transfer is the complete sync scope; no network transport is planned.

## Record history

Characters, environment categories, groups, group characters/categories and sounds
carry a stable `syncId` and integer millisecond `updatedAt`. Existing records start
at epoch (`0`), never at migration time: opening an old board cannot make it newer
than an actual edit. Existing identities derive from collection, parent and old
id/category. New records and copies get fresh random identities. A category rename
keeps its identity. A move to another container is a deletion plus a new membership;
its playback id survives. Cross-device legacy renames before migration cannot be
identified as the same record reliably.

The state setter boundary reconciles every board edit. It clocks changed fields
and child ordering, and independently clocks nested records. Changing a sound
does not clock its parent's name. A backward clock still advances the previous
record's timestamp by at least one millisecond. This is wall-clock last-write-wins,
not a claim of clock synchronization between devices.

Deleting a record saves `deletedAt` plus `updatedAt`, `syncId` and its UI identity.
Deleted containers drop their whole subtree; deleted sounds drop file/icon fields.
The normal file-reference guard may therefore release unreferenced upload bytes.
React renders a recursive live projection, while persistence, explicit flush and
export retain the raw history. Tombstones have no automatic expiry: removing one
without a known synchronization horizon can resurrect an old device's records.
Restore Defaults creates a fresh identity when restoring a deleted entry.

## Merge import

Create a new profile remains the default. Native export/import has exactly two
modes: New Profile and Merge. Replace was removed at the user’s request.
The complete bundle is parsed and its payload checksums
verified before a read-only preview reports record additions, updates and deletions.
The user confirms the preview before any snapshot or import writes occur.

Merge snapshots the active profile, imports its own content-addressed uploads and
commits the merged keys last. A key-write failure uses the existing snapshot rollback.
It never links files between profiles. Local uploaded web keys and device display
preferences are retained. Imported display settings and hotkeys are intentionally
not merged: those remain destination-local by policy.
Local hotkey targets follow any remapped local sound id; deleted targets remain
unresolved as they do after an ordinary UI deletion.

Rules:

- Same `syncId`: deletion wins permanently; explicit restoration creates a fresh
  identity. Among live edits, greater `updatedAt` wins. Other
  divergent equal-clock edits use canonical JSON ordering as a deterministic
  tie-break. Old bundles with no history use epoch, so their true edit order is
  unknowable. Importing into a new profile is safer when that distinction matters.
- Container fields and descendants merge independently. A deleted parent suppresses
  its subtree, even if an unseen descendant has a later timestamp. This remove-wins
  policy also makes merge grouping irrelevant after payload-free deletion; a
  newer offline edit cannot revive a subtree whose payload was already released.
- Records with different identities survive. Colliding live playback ids and
  category names are deterministically disambiguated. Duplicate sync identities
  within a collection are refused rather than silently dropping one.
- Merged collections use stable sync-identity ordering; entry order may change.
  Merge does not synchronize a separate concurrent root-list ordering history.

Bundle format **3** retains deletion history. Readers for formats 1/2 refuse format
3, protecting against silently displaying or stripping tombstones. This build can
still import formats 1/2. This is an additive record migration, with no DATA_VERSION
bump; downgrading an installed app that already saved record history is unsupported.

## Verification

`e2e/profileRecords.check.mjs` covers migration, clocks, copies, nested deletion,
restoration, pure merge conflicts, collision handling and nonmutation. Bundle
checks cover merge, storage preservation, preview, marker transfer and refusal.
The shared `specs/profileRecords.mjs` suite checks the React edit/delete/persistence
boundary on web, Windows and Android, and the native bundle merge path.

Existing board assertions use `window.__liveBoard` to inspect visible records.
The history suite deliberately reads raw persisted data instead, proving deletion
markers survive rather than merely hiding them from assertions.

## Manual sync workflow

1. Export the profile as a `.spellcaster` file on the source device.
2. Move that file yourself to the destination device using your preferred method.
3. Import it using **Merge into this profile** to combine tracked changes, or use
   **Create a new profile** to keep a separate copy. Review the merge preview first.

Repeat the export/transfer/import sequence in the opposite direction when needed.
Use the current app on both devices: older builds refuse format3. Tracked deletion
markers prevent older copies from reviving deleted records. Merge keeps the
receiving profile's settings and hotkeys.

The user explicitly chose this scope on2026-11-01. There is no app-managed folder
watcher, WebDAV, cloud transport, account or server setup planned. The earlier
server-sync proposal was abandoned, not left as unfinished work. Independent
browser-platform export/import remains parked in PROFILE_SYNC_SPEC.md; it is not
required for the native manual workflow.
