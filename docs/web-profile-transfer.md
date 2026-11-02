# Browser profile file transfer

Implemented and user accepted on 2026-11-02. Browser profiles use the existing `.spellcaster` format and
New Profile / Merge behavior. Native file handling and the bundle format remain
unchanged. Manual file transfer is the scope; no server or automatic sync.

Audio and uploaded sound icons move from scoped `sound_file_*` localStorage
data URLs into the `spellcaster-uploads` IndexedDB database. The `files` store
uses `[profileId, storedName]` keys and a profile index. Board metadata and the
device-local background preference stay in localStorage.

Migration copies each legacy file, waits for transaction commit, reads it back,
compares MIME type and every byte, then removes the unchanged original key.
Failed verification retains the original. If migration cannot write, playback and
export can still read that original; new uploads report failures rather than
falling back to quota-limited localStorage. Operations serialize per profile;
Web Locks also serialize cooperating tabs where supported. Migration is retryable.
Playback, upload, bundle I/O, deletion and profile cleanup share the same store.

Browser export starts a Blob download. Browser import reads a user-selected
file and hands its bytes to the shared checksum validation and import engine.
Download initiation cannot prove that the browser saved a file to disk; the UI
must describe that distinction. Native export retains its disk read-back check.

Required verification includes migration/retry failures, profile isolation,
large uploads beyond the old localStorage limit, download contents, New Profile,
Merge, corrupt imports, reload playback, deletion and native regressions.
The user hand-tested importing an existing `.spellcaster` into a browser profile,
playing uploaded audio, checking its icon and exporting again successfully.
Automated checks also verify imported audio decodes after reload and that a
pending read cannot create a player after leaving its profile. Cached file URLs
are released on remount. Native transfer retains its existing format and pickers.


Verification is targeted by explicit user request. Browser checks include a real
7MiB audio import, uploaded PNG, native-engine format3 transfer, download checksums,
New Profile/Merge/cancel, corrupt/future refusals, reload decode, profile deletion
and pending-read/remount cleanup. The browser store has48 fault/round-trip Node
assertions registered in AGENTS.md. Coverage registers I24-I36; no IDs were removed.

For focused native Android fixture seeding, use the actual profile-remount hydration
boundary after writing keys. Page.reload can leave the old React board visible,
and BACK before disposal can write the old board over the fixture. Restoration
still needs independent snapshot comparison after cold restart. This is a driver
reliability warning, not a different browser/native file-transfer contract.
