# Atomic profile persistence

Status: implemented and verified on web, Windows and Android (2026-11-03).
No data-version or bundle-format change. Evidence: PROJECT_STATE.md and
logs/keep/atomic-persistence-20261103/verification.md.

## Contract

Characters, environments and groups from one React commit save together or none
of them save. Explicit flush uses the same transaction before switching profiles,
or taking an import snapshot. Export reads the live board directly. Import metadata and snapshot restoration
also use a single transaction. Audio bytes remain outside this metadata transaction;
imports already install content-addressed bytes before referencing them.

Use an undo journal in the profile namespace. Before changing any requested key,
store its previous string value (including absence) in one localStorage write.
Apply all requested writes/removals synchronously. Removing the journal is the
commit point. A thrown write or an interrupted process leaves the old values in
the journal. Recovery restores all of them before removing it. Recovery can be
repeated after interruption. If recovery itself fails, reads use the old values
and further writes are blocked until recovery succeeds. Never replace that journal
with another transaction or silently accept the partially written keys.

The journal is internal: omit it from profile enumeration, exports and snapshots.
Logical enumeration includes old keys removed by an interrupted transaction and
excludes keys newly added by it. Profile deletion intentionally removes everything,
including the journal. Single-key writes/removals must recover first so they cannot
be overwritten by a later rollback. A malformed journal is an explicit storage
error, never permission to discard the recovery evidence.

## Limits and validation

This relies on localStorage's individual-operation atomicity; it is not a filesystem
fsync guarantee. A process termination before commit restores the previous complete
board; termination after commit loads the new complete board. Journal storage costs
additional space proportional to changed metadata, so a quota rejection can occur
earlier, leaving the original board intact and the existing save-error banner visible.
No transaction should be created when all requested values already match.

Concurrent writable app windows are not supported by this synchronous journal
protocol. No asynchronous work is allowed between journal creation and commit.
Uploaded-file deletion and profile-index CRUD are separate operations, outside this
cross-slice contract. Changing media garbage collection requires its own design.

Verify failures at journal creation, each data write, journal removal and rollback;
restart with each possible interrupted prefix, including persistent quota failures.
Verify profile isolation, deletion, logical enumeration, import and explicit flush.
Run full web, Windows and Android E2E after fault checks and existing Node gates.
