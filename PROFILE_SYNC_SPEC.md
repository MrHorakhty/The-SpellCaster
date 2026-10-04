# Profiles + Sync — Planning Spec

> **Status**: **Revised 2026-10-04** (docs only) after the user re-opened the feature. The parked
> 2026-09-27 decision is lifted for *design work*; **implementation is still not authorised** — do not
> write app code until the user gives the go-ahead. All code references were re-verified against
> `src/App.jsx` at 6240 lines; see §0 for what changed.
> **Created**: 2026-09-27 · **Revised**: 2026-10-04
> **Related**: the icon feature (formerly `ICON_FEATURE_SPEC.md`, implemented & verified 2026-09-28; that spec file was deleted 2026-09-28), Restore Defaults (shipped as `bde7483`), and the move/copy feature (shipped as `f7f316e`)

---

## 0. Revision log — what changed since 2026-09-28, and why

The design below still holds. Three features landed in the week after this spec was written, and they
move facts, not decisions. Nothing in §1, §2, §5, §6 or §8 needed to change.

| # | Change | Sections touched |
|---|---|---|
| 1 | Every `src/App.jsx` line number moved — the file was 5751 lines when this was written, it is **6240** now | §3, §7, §8, §9.2, §10 |
| 2 | **`localStorage` call sites went 23 → 27** (13 `setItem` / 11 `getItem` / 3 `removeItem`), and two keys were added that this spec never knew about | §4.2 |
| 3 | The code also **enumerates** `localStorage.length` / `localStorage.key(i)` to sweep `sound_file_*`. A storage adapter that only wraps get/set/remove is **not enough** | §4.2, §12 step 1 |
| 4 | **Restore Defaults shipped** (`bde7483`) — §9.2's "Reset to starter sounds" is existing behaviour that only needs profile-scoping | §9.2, §13 |
| 5 | **Provenance is already solved in code** — a bundled reference has **no `storedName`**; an upload always does. This replaces §11 risk 2's filename-guessing worry | §3, §7 step 3, §11 |
| 6 | **Move/copy shipped** (`f7f316e`) — two sounds can now legitimately name the **same `storedName`**, so dedupe-by-hash is mandatory, not an optimisation | §5, §7, §11 |
| 7 | **§10's open fs question is answered** — `fs:default` does **not** grant directory listing, and the permission is `fs:allow-read-dir` (**singular** — this spec had it wrong twice; see §10) | §10 |
| 8 | ✅ **The Android SAF spike was run on 2026-10-04 and it PASSES** — `dialog.save()` returns a `content://` URI and `plugin-fs` writes/reads it byte-identically. §7 and §10 record what it proved | §7, §10 |

Still unverified: **writing to a user-picked path on *desktop*** (§10). The Android side is now proven.

---

## 1. Goal

Add a **profile system** so a user can move their soundboard setup between devices (desktop ↔ Android ↔ web), and add **export / import** of a profile as a single portable file.

Constraints that drove the design:

- **Not intrusive.** No accounts, no sign-in, no telemetry, no third-party services.
- **No personal data collected.** The app must never require an email, a username, or a device identity that leaves the machine.
- **Ships publicly.** The design must serve a user who starts on Android and later installs the desktop app, and vice versa.
- **No encryption, no background image.** The bundle is an ordinary unencrypted zip, and a profile carries *content* — sounds, names, colors, loop/fade settings, theme — not per-device cosmetics. See §6.

The guiding rule: **sync the tedious thing, not the trivial thing.** Rebuilding a library of sounds with their names, colors and playback settings is an evening's work; re-picking a background image is ten seconds.

**v1 scope:** desktop (Windows/Linux/macOS) + Android, multiple named profiles per device, export/import as a plain `.spellcaster` zip, import modes **New profile** and **Replace active**. Web is excluded from v1, and Merge import is deferred. Everything deferred is listed in §13 and none of it changes the bundle format or the byte-level API.

---

## 2. Approaches considered

| # | Approach | Personal data | Accounts | Effort | Works when apart? | Verdict |
|---|---|---|---|---|---|---|
| A | **Folder sync** — profile stored in an ordinary folder, user's existing sync tool (Drive/OneDrive/Syncthing) moves it | none (own disk) | none | Low–Med | yes | Deferred; build the file format so A can be added later |
| B | **LAN device-to-device** — one device hosts, the other scans a QR | none (never leaves LAN) | none | High | no (same Wi-Fi only) | Rejected |
| C | **Self-hosted** — WebDAV / Nextcloud / S3 / R2 the user controls, client-side E2EE | none (ciphertext only) | none | Med | yes | Rejected for now; `ProfileTransport` keeps the door open |
| D | **Hosted provider** (Supabase / Firebase / PocketBase Cloud) | IP + device token | yes | Low–Med | yes | Rejected — contradicts "no personal data" |
| E | **Manual bundle** — export/import a `.spellcaster` file | none | none | Low | manual transfer | **CHOSEN** |

**Decision: ship E.** It is the only option requiring no transport, no accounts and no infrastructure, and it is the primitive that A, B and C are all built on. Design the bundle + storage layer so a later sync provider is an additive change, not a rewrite.

---

## 3. Key facts that shape the design

**Re-verified 2026-10-04** against `src/App.jsx` at 6240 lines. Line numbers in earlier drafts of this
table were from the 5751-line file and were all wrong.

| Fact | Detail | Consequence |
|---|---|---|
| **Default sounds ship with the app** | 71 files / 29 MB in `public/assets`, referenced by filename only | They are already identical on every install. **They never enter a bundle.** |
| **Only uploads need syncing** | `TAURI_STORAGE_DIR = 'uploads'` (App.jsx:22) under `BaseDirectory.AppData` | Bundles stay small |
| **Custom sound icons are also uploads** | `handleIconUpload` → `icon: storedName` + `iconDisplayName` (App.jsx:2287-2293) | A bundle needs an `icons/` folder too — easy to miss |
| **Two different sound-file shapes coexist** | character/group sounds use `files: [{…}]`; legacy environment sounds use `file: "Name.mp3"` (see `src/data.json`, and the playback fallback at App.jsx:3275 in `playSound`) | The exporter must walk **both**, and `files[]` entries are themselves heterogeneous (`name` / `storedName` / `displayName` / `url`) |
| ✅ **Provenance is a structural fact, not a guess** | a **bundled** reference has **no `storedName`** — `src/data.json` ships `{"name":"Caustic_Blast_Acid_1.mp3"}` and nothing else. An **uploaded** one always has `storedName` set to `sound_<rand>_<safeName>`, and its `name` is *also* rewritten to the storedName with the human name kept in `displayName` (App.jsx:2404-2425) | **The exporter classifies by `storedName` presence.** Do not infer from filenames, and do not add a write-time provenance flag (the old §11 risk 2) — the data already says which is which. Icons classify the same way: bundled icons are plain filenames (`Caustic_Blast_Acid.png`), custom icons always carry the `icon_<rand>_<name>` shape (App.jsx:1953-1956). |
| ✅ **Shipped sounds are also identifiable by id** | `mergeShippedDefaults` builds `allShippedSoundIds` from `src/data.json` (App.jsx:355) | A second, independent provenance signal, and the one Restore Defaults already trusts. Useful as a cross-check in E2E. |
| **A `storedName` can now be shared by two sounds** | move/copy's copy **shares** the source's reference by design; `isFileReferencedElsewhere` (App.jsx:1967) exists because of it | Export **must** dedupe by content hash — two references, one blob (§5). Deleting a profile must not assume one owner. |
| **`isFileReferencedElsewhere` scans only in-memory state** | it walks `allSoundContainers()` (App.jsx:1812) over the *current* React state | With profiles, "the current state" is **one profile**. Cross-profile sharing cannot happen through the UI today, so per-profile `uploads/<id>/` dirs stay correct — but say so in a comment before anyone "simplifies" it. |
| **Custom background image is an inline data URL** | `backgroundSettings.imagePreview`, up to 5 MB base64, written straight into localStorage (App.jsx:2913, applied at 2861-2885) | **Deliberately NOT synced** — it is a per-device display preference, and re-picking one image is far cheaper than rebuilding a library of sounds. It stays exactly where it is today. Export must **strip** it (§7) so a 5 MB blob never rides along inside `data.json` |
| **No timestamps exist anywhere** | 0 hits for `updatedAt` / `createdAt` / `deletedAt` in `src/App.jsx` and `src/data.json` | Last-write-wins is impossible today. Add timestamps + tombstones **now** — it is the prerequisite for A/C later |
| **Env data key is singular** | `ttrpg_environment`, not `ttrpg_environments` (App.jsx:3584) | A latent bug that has fooled test harnesses before; be careful in any new code |
| **`localStorage` access is 27 call sites and includes enumeration** | 13 `setItem` / 11 `getItem` / 3 `removeItem`, plus `localStorage.length` + `localStorage.key(i)` in the `sound_file_*` sweep (App.jsx:1207-1211) and 4 `ttrpg_*_icon` writes (App.jsx:1057-1065) | The "single storage adapter" of §4.2 must own **enumeration and prefix matching**, not just get/set/remove. This spec's earlier "23 call sites" figure was already stale. |
| **`uploads/` paths are built in 10 places** | `TAURI_STORAGE_DIR` (App.jsx:22) and `getTauriStoragePath` (App.jsx:2316), referenced at 1225-1235, 2325-2342, 2374-2385, 3241 | A per-profile `uploads/<profileId>/` prefix changes **10 path sites** on top of the 27 storage sites. Both sets must route through the adapter. |
| **fs scope is AppData-only, and `fs:default` has no directory listing** | `src-tauri/capabilities/default.json` grants `fs:default`, `fs:allow-appdata-*`, `fs:allow-exists`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-mkdir`, `fs:allow-remove`. The plugin's own `default` set is only `create-app-specific-dirs` + `read-app-specific-dirs-recursive` + `deny-default` — `read_dir` is **not** in it | Enumerating `uploads/` needs **`fs:allow-read-dir`** — **singular**, confirmed by a build failure: the app's build script rejected `fs:allow-read-dirs` and printed the valid id list. See §10. |
| **Android cannot write outside AppData by path** | a raw write to `/storage/emulated/0/Download/…` is refused with *"forbidden path … maybe it is not allowed on the fs scope"* | The §7 `BaseDirectory.Download` fallback is **dead on Android**. Export must go through the SAF `content://` URI — which works (§7). |
| **On Android, `plugin-fs` accepts a `content://` URI as `path`** | `commands.rs` `#[cfg(mobile)] resolve_file` → `android.rs` `resolve_content_uri` → Kotlin `FsPlugin.getFileDescriptor` → `contentResolver.openAssetFileDescriptor` → raw fd → `std::fs::File`. Verified end to end, §7 | No scope change is needed on Android for the export destination — the URL branch skips the scope check entirely. This is the single most important fact for §7. |
| **Resolved fs plugin is 2.5.2** | `Cargo.toml` declares `tauri-plugin-fs = "2.5.1"`; semver resolves to **2.5.2** in the lockfile | Check the resolved version's permission names before adding any — the permission set is versioned. |
| **`tauri-plugin-dialog` is registered nowhere** | `main.rs:7` has fs, `lib.rs:4-5` has fs + os, `lib.rs:8` has log. No dialog | It must be added to **both** entry points — see §10. |

---

## 4. Data model

### 4.1 Profile index (new)

New localStorage key `spellcaster_profiles`:

```json
{
  "version": 1,
  "activeProfileId": "p_a1b2c3",
  "profiles": [
    { "id": "p_a1b2c3", "name": "Home Campaign", "createdAt": 1758000000000, "updatedAt": 1758000000000 }
  ]
}
```

A "profile" is a named container. It is **not** an account and carries no identity beyond a random local id.

### 4.2 Namespaced storage (new)

Every existing key moves under a per-profile namespace. `readStoredData(key, fallback)` (App.jsx:317) becomes profile-aware:

| Today | After |
|---|---|
| `ttrpg_characters` | `profile:p_a1b2c3:ttrpg_characters` |
| `ttrpg_environment` | `profile:p_a1b2c3:ttrpg_environment` |
| `ttrpg_groups` | `profile:p_a1b2c3:ttrpg_groups` |
| `ttrpg_data_version` | `profile:p_a1b2c3:ttrpg_data_version` |
| `boxSize` | `profile:p_a1b2c3:boxSize` |
| `backgroundSettings` | `profile:p_a1b2c3:backgroundSettings` |
| `AppData/uploads/*` | `AppData/uploads/p_a1b2c3/*` |
| web `sound_file_*` | `profile:p_a1b2c3:sound_file_*` |

⚠️ **Two keys are missing from the original version of this table**, added by the section-icon feature after
this spec was written. They are per-board UI state and must be namespaced like everything else:

| Today | After |
|---|---|
| `ttrpg_characters_icon` | `profile:p_a1b2c3:ttrpg_characters_icon` |
| `ttrpg_environment_icon` | `profile:p_a1b2c3:ttrpg_environment_icon` |

(Read at App.jsx:1057-1058, written at 1061-1065. A profile whose section icon leaked across profiles would
look like a data bug, not a sync bug, so it is easy to miss in review.)

`localStorageMigrationCompleted` (App.jsx:1197-1242) is **not** namespaced: it records that the one-time
web→Tauri audio sweep has run, which is a property of the *device*, not of a profile. Leave it global and say
so in a comment.

A **single storage adapter** owns this mapping. All **27** existing `localStorage.*` call sites (13 `setItem`,
11 `getItem`, 3 `removeItem`) go through it — no call site keeps a hard-coded key. On top of that:

- **Enumeration is part of the adapter's job.** `migrateLocalStorageFiles` walks every key with
  `localStorage.length` / `localStorage.key(i)` looking for `sound_file_*` (App.jsx:1207-1211). A
  get/set/remove-only wrapper leaves that loop reading and deleting the *global* namespace. The adapter needs
  `keysWithPrefix(prefix)` / `removeAllWithPrefix(prefix)`.
- **`uploads/` paths are a second front.** `TAURI_STORAGE_DIR` (App.jsx:22) and `getTauriStoragePath`
  (App.jsx:2316) are referenced at 1225-1235, 2325-2342, 2374-2385 and 3241 — **10 path sites** that must all
  gain the profile segment. Do the localStorage keys without these and Tauri profiles will share audio.
- **Per-profile `uploads/` dirs are safe** even though a copy can share a `storedName`
  (`isFileReferencedElsewhere` only scans the active profile's in-memory state — see §3), but leave a comment
  saying so, or a future "simplification" will introduce cross-profile byte loss.

### 4.3 Timestamps (new, additive) — **optional in v1, recommended**

Added to every entity, optional on read (absent = epoch):

| Entity | New fields |
|---|---|
| Character / GroupChar | `updatedAt`, `deletedAt?` |
| Environment category / GroupCat | `updatedAt`, `deletedAt?` |
| Sound | `updatedAt`, `deletedAt?` |
| Group | `updatedAt`, `deletedAt?` |

`deletedAt` is a **tombstone**: deletes set it instead of splicing the array, so a later sync can propagate the deletion. Filtered out of the UI.

**Status: cut from the v1 critical path.** These fields were originally required for merge-import conflict resolution — and merge is no longer in v1 (§8), so nothing in the first release actually reads them. They are kept here as the cheapest possible insurance for the deferred options: Merge, and folder/cloud sync (A/C), both need them, and adding timestamps after users have data in the field is far harder than adding them now. `normalizeStoredData` (App.jsx:269) already guarantees array shapes, so it is also the place to default missing timestamps — no `DATA_VERSION` bump required. **If you want minimum v1, cut this section and step 2 with it; nothing else breaks.**

---

## 5. Bundle format

Extension `.spellcaster`. A **zip** container (streamed, never buffered whole in JS memory).

```
profile-<slug>-<yyyyMMdd-HHmmss>.spellcaster
├── manifest.json
├── data.json
├── audio/<contentHash>.<ext>
└── icons/<contentHash>.<ext>
```

A **plain, unencrypted zip**. No `background/` folder — see §6.

### 5.1 `manifest.json`

```json
{
  "formatVersion": 1,
  "appVersion": "0.1.3",
  "profile": { "id": "p_a1b2c3", "name": "Home Campaign" },
  "exportedAt": 1758000000000,
  "dataVersion": "3",
  "files": [
    { "path": "audio/9f2c1a.mp3", "kind": "audio", "sha256": "<hex>", "bytes": 184320, "originalName": "Caustic_Blast_Acid_1.mp3" }
  ],
  "counts": { "characters": 3, "environmentCategories": 2, "groups": 1, "sounds": 11, "files": 24 }
}
```

- `formatVersion` is the **bundle** version, independent of `DATA_VERSION` (the in-app data schema version). Bump it only for breaking layout changes.
- `files[].path` is **content-addressed** (`sha256` prefix + original extension). Two profiles containing the same upload dedupe to one entry, and blobs can never conflict.
- ⚠️ **Dedupe is now mandatory, not an optimisation.** Since move/copy shipped, two sounds in one profile can legitimately name the **same `storedName`** (`f7f316e`), so the reference count and the blob count are no longer 1:1. Hash-then-dedupe (§7 step 4) is what keeps that correct — keying blobs by `storedName` instead would emit the same bytes twice under two names.
- `originalName` preserves the human-readable filename for restore/inspection. On import, the app may keep the content-addressed name as `storedName` and show `originalName` as `displayName` — matching the existing `files[]` entry shape (App.jsx:2419-2424 writes exactly `{name, storedName, url, displayName}`).

### 5.2 `data.json`

Same shape as `src/data.json` (top-level `characters`, `environmentSounds`, `groups`) plus a `settings` block:

```json
{
  "characters": [...],
  "environmentSounds": [...],
  "groups": [...],
  "settings": { "boxSize": 1.0, "background": { "type": "color", "theme": "Forest", "color": "#0b1220" } }
}
```

The `background` block carries only the **colour/theme** choice. The custom background **image is intentionally absent** — it is re-picked per device. On import, `background.imagePreview` stays `null`; the app falls back to the theme colour until the user picks an image. The existing inline-`imagePreview` code path is untouched by this feature.

---

## 6. Two things deliberately left out

**Encryption — omitted.** The bundle is a plain zip, readable by anyone it is shared with. Accepted: the payload is sound effects and a list of names, not sensitive material, and a plain file makes "send it to my group in Discord" a one-action operation. Recorded here so a future reader asking "why isn't this encrypted?" gets the answer instead of re-litigating it.

The one consequence to keep in mind: audio a user adds may be material they have no right to redistribute, and an unencrypted bundle gives them no protection. That is the user's call at export time, and the UI note in §9.2 says so.

**Custom background image — not synced.** Per-device display preference, not content. Re-picking one image costs seconds; re-creating a library of sounds with names, colours, loop and fade settings costs an evening. The feature deliberately syncs the tedious thing and not the trivial thing.

---

## 7. Export pipeline

1. Read the active profile through the storage adapter.
2. Walk **both** sound-file shapes (`files[]` and legacy `file`) and both `files[]` entry variants, plus every custom icon (`sound.icon` that is an upload, not a bundled asset). Walk **all five container shapes** via `allSoundContainers()` (App.jsx:1812) — including the vestigial `groups[].sounds`. A sound in the wrong shape is a sound that silently does not get exported.
3. Classify each reference as **bundled** or **uploaded**. ✅ **This is now a structural test, not a heuristic: a reference with no `storedName` is bundled, one with a `storedName` is an upload** (§3). Do **not** add the write-time provenance flag the old draft of this spec asked for — the data already distinguishes them, and a new flag would be a second source of truth to keep in sync. Keep the classification in one helper (`isUploadedReference`) so the icon path and the audio path cannot disagree.
4. Hash each upload, dedupe by hash (**not** by `storedName` — see §5), stream into the zip.
5. Write `manifest.json` and `data.json` — **with `background.imagePreview` forced to `null`**, so a 5 MB base64 blob is never serialised into the bundle.
6. Stream the zip to the chosen path.
7. Show a progress dialog; allow cancel.

### Where the file goes

| Platform | Mechanism |
|---|---|
| Windows / Linux / macOS | `tauri-plugin-dialog` save dialog → `tauri-plugin-fs` write to the picked path. ⚠️ the fs scope must permit an arbitrary user-picked path — still unverified, see §10 |
| Android | SAF save via `tauri-plugin-dialog` → **the result is a `content://` URI, not a path** → hand that URI straight to `tauri-plugin-fs` (proven, see below) |
| Web | **Out of scope for v1** — see below |

**Web is excluded from v1.** The web build keeps working exactly as it does today (a viewer/editor with its own localStorage data), but it gets no export/import buttons. The reason is structural, not a preference: web audio lives as base64 data-URLs in localStorage under `sound_file_*`, which caps out around 5 MB, so a web export could only ever be metadata and would be a misleading promise. Supporting web properly means first moving web audio out of localStorage into real files, which is a separate piece of work. The interface should be written so web can be enabled later behind the same byte-level `exportBundle`/`importBundle` functions (§9.3) with no rework.

### ✅ Android SAF: SPIKED AND PROVEN (2026-10-04)

**The old "⚠️ spike this first" warning is retired — it was run and it passes.** Recorded here because the
mechanism is not what the rest of this spec assumes:

1. `dialog.save()` on Android returns **`content://com.android.providers.downloads.documents/document/<id>`** —
   a *Content URI*, not a filesystem path (`DialogPlugin.kt` `saveFileDialogResult` returns `uri.toString()`).
2. `plugin-fs` **transparently accepts that URI as `path`.** `commands.rs` has a `#[cfg(mobile)] resolve_file`
   which, for a `SafeFilePath::Url`, calls `webview.fs().open()` → `android.rs` `resolve_content_uri` → the
   Kotlin `FsPlugin.getFileDescriptor` → `contentResolver.openAssetFileDescriptor(uri, mode)` → a raw fd
   wrapped as a `std::fs::File`. The `content://` string never touches the filesystem as a path.
3. Measured on an API 37 emulator: wrote 4096 bytes (`PK\x03\x04` + 0x41 body), read back 4096 bytes
   byte-identical; re-wrote 64 bytes of 0x42 and read back 64 bytes of 0x42 (truncate works, not one-shot);
   `/sdcard/Download/<file>` existed with exactly those sizes (`adb shell ls -l`).
4. **Control: a raw path write to `/storage/emulated/0/Download/…` is REFUSED** — "forbidden path … maybe it is
   not allowed on the fs scope". So the §7 "fallback = write to `BaseDirectory.Download`" idea is **dead on
   Android**: scoped storage blocks it. The SAF URI is the only route, which is fine because it works.

Implementation consequences:

- **Pass the URI as a plain string** to `writeFile` / `readFile`. Do **not** wrap it in a `URL` object —
  `readFile` throws `TypeError('Must be a file URL.')` for a non-`file:` `URL` (`plugin-fs` dist-js).
- **No fs-scope widening is needed on Android.** The mobile `resolve_file` path takes the URL branch without a
  scope check, and raw paths are denied anyway. Scope widening is a **desktop-only** concern.
- The export UI must not try to parse, split or "beautify" the returned string. It is opaque. A file *name*
  for the success message has to come from `dialog`'s own input or be parsed from the URI's last segment with
  a fallback — do not depend on `Environment.getExternalStorageDirectory()`-style path reconstruction
  (`FilePickerUtils.getPathFromUri` exists in the dialog plugin but is **not** used by `save`).

---

## 8. Import pipeline (atomic)

1. Read the bundle (path, `File` object, or bytes).
2. Parse `manifest.json`. **Refuse cleanly** if `formatVersion` is newer than this build supports, with a message naming both versions.
3. Verify every `files[].sha256`. Any mismatch → abort, report the file, write nothing.
4. Write payloads into a **temp** dir `uploads/.import-<stamp>/`.
5. Run `data.json` through `normalizeStoredData` (App.jsx:269) — the existing forward-migration entry point — and through `normalizeHex` (App.jsx:2710).
6. **Atomically swap** the temp dir into `uploads/<targetProfileId>/`, then commit the namespaced keys.
7. Report per file: imported / skipped (already present) / failed.

### Import modes (v1 — two modes)

| Mode | Behaviour |
|---|---|
| **New profile** (default) | Create a new profile from the bundle; the current profile is untouched. **This is the recommended path and the safety story** — you can try an imported setup and switch back at will. |
| **Replace active** | Wipe the active profile and install the bundle. Snapshot the old profile first so it is recoverable. |

**Merge is deferred**, not cut. It is the most intricate logic in the feature (id collision remapping, duplicate-name rules, per-record conflict resolution) and it buys least. When it does arrive it will need §4.3's timestamps and the `updatedAt` rule already described there. Until then, "New profile" covers the same need safely: import alongside, compare, keep whichever you want.

### Unresolvable audio references

An imported profile can reference audio the local app does not have — a sound added on a newer app version, a bundled asset missing from this build, or an upload that failed to transfer. **Policy: keep the container, drop the sound, report the count.**

- The character / category / group itself is imported intact.
- A sound whose file cannot be resolved is **omitted** from the installed profile.
- The import summary states how many were dropped, names up to a handful, and suggests updating the app if the cause looks like a version mismatch.
- Nothing is ever installed as a half-broken entry, and no import fails because of one missing file.

The same rule applies to missing custom **icons**: fall back to the default icon rather than dropping the sound.

---

## 9. UI

### 9.1 Profiles — new modal

Reachable from the header settings gear, mobile rail, and the desktop sidebar. Fields: active profile name; profile list with per-row **switch / rename / duplicate / delete**; **New profile**. Deleting the last profile is blocked; deleting the active one switches to another first. Deleting a profile warns that its uploads go too.

### 9.2 Export / Import — inside the existing Settings modal

The Settings modal (App.jsx:5952-5953, opened by `openSettingsModal` at App.jsx:2661) is already a bottom
sheet on mobile and a centered dialog on desktop — reuse that pattern for a "Profiles & Sync" section rather
than adding a seventh modal:

- **Export profile…** → name, optional "include audio" checkbox, destination picker. No passphrase field (§6).
- **Import profile…** → source picker, then the mode choice, then a progress + per-file report.
- **Reset to starter sounds** → ⚠️ **this already shipped** as `bde7483`: `restoreDefaults` (App.jsx:2671,
  button at 6169) backed by `mergeShippedDefaults` (App.jsx:349). It is **not new work** — it needs to become
  profile-scoped (operate on the active profile, and stop merging into whatever the previous profile left
  behind). Note it deliberately never deletes user content and is idempotent; **keep both properties** when
  you scope it, because they are what make the button safe to press twice.
- A one-line note: *an exported profile is an ordinary, unencrypted zip containing the audio you added; you are responsible for sharing it lawfully.*

### 9.3 Testability requirement

`importBundle(bytes, options)` and `exportBundle(options) → bytes` are **pure functions that take/return bytes**. The UI's only job is handing them picker output. This is what lets the E2E suite test import on all three platforms without touching a native file dialog.

---

## 10. Required plugin / capability changes

**Re-verified 2026-10-04, and the Android half *executed* 2026-10-04.** The spike that verified §7 needed the
dialog plugin and these permissions — **those spike edits were reverted afterwards** (at the user's request),
so nothing below is in the tree yet. `cargo check` was clean both with and without them.

| Change | Where | Why |
|---|---|---|
| `tauri-plugin-dialog` | `src-tauri/src/main.rs` **and** `src-tauri/src/lib.rs` | save + open file pickers. **Both entry points** — plugins registered only in `main.rs` are silently missing on mobile. Adding it to only one is not a shortcut: with it missing from `lib.rs` the app rejects the call with **`dialog.save not allowed. Plugin not found`**, which is exactly the failure this row exists to prevent (observed during the spike) |
| **`fs:allow-read-dir`** (**singular**) | `src-tauri/capabilities/default.json` | enumerate `uploads/` to build a manifest. `fs:default` does **not** include `read_dir` (the plugin's `default` set is `create-app-specific-dirs` + `read-app-specific-dirs-recursive` + `deny-default`). ⚠️ **The name is the per-command permission `allow-read-dir`; `permissions/read-dirs.toml` defines a *set* called `read-dirs`, which is a different identifier.** This spec claimed the plural first and was wrong — the build rejected `fs:allow-read-dirs` with "Permission not found, expected one of …" and listed the valid ids. **Use the singular.** (Whether it is needed at all is unproven: `uploads/` is inside AppData, which is already readable, so the manifest could equally be built from state alone.) |
| ⚠️ Widened `fs` scope for a user-picked destination — **desktop only** | `src-tauri/capabilities/default.json` | today only `fs:allow-appdata-*` is granted, so a desktop picker path will be denied. **Not needed on Android** — proven: the mobile path takes the `content://` URL branch with no scope check, and raw paths are refused outright. **This is now the last unverified item in the feature** |
| New frontend deps: **`fflate`** (zip) + a SHA-256 helper | `package.json` | streaming zip create/extract; small, fast, no native build step. For hashing use a small pure-JS implementation (e.g. `@noble/hashes`) — **not** `crypto.subtle`, which is unavailable outside a secure context, and not a Rust command, which would re-add the native work this design no longer needs. Neither is installed yet: current deps are `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-os`, `lucide-react`, `react`, `react-dom` |
| (`src-tauri/Cargo.toml`) | — | `tauri-plugin-dialog = "2"` **must be added** alongside `tauri-plugin-fs = "2.5.1"` / `-log = "2"` / `-os = "2.2.0"`; it resolves to **2.7.3**. The resolved fs version is **2.5.2**, so read permission names from the resolved crate, not the declared one |

**No custom Rust commands are required.** With encryption dropped there is no crypto to do in Rust, so the whole feature is frontend work plus registering `tauri-plugin-dialog`. The only native surface is the plugin registration, the fs scope, and the platform pickers.

Integrity hashing is still worth keeping (it is what makes "abort on corrupt bundle" possible), and it can be done in pure JS. If it ever proves slow on large libraries, promoting just the hash to a Rust command is an isolated, low-risk change.

💡 If writing to a picker-chosen path turns out to need a runtime scope grant (i.e. `fs:scope` cannot express
"wherever the user just picked"), that *would* introduce the first custom Rust command. Find out during the
**desktop** spike, not during UI work. Android no longer has this risk.

### How the spike was driven (reproduce it without writing app code)

The dialog could be exercised **without touching `src/App.jsx`**, which is why this was cheap:

- `tauri android dev` → Gradle builds `app-x86_64-debug.apk` but did **not** install it here; `adb install -r`
  the APK from `src-tauri/gen/android/app/build/outputs/apk/x86_64/debug/` and launch it manually.
- Forward the WebView devtools socket (`adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>`) and
  drive the plugin over raw CDP: `window.__TAURI_INTERNALS__.invoke('plugin:dialog|save', { options })`.
- ⚠️ **The two fs commands take the path in different places.** `write_file` expects it in a **header**
  (`encodeURIComponent`d) with the bytes as the body; `read_file` expects `{ path, options }` as **args**.
  Getting this wrong fails as `invalid args 'path' for command 'read_file'`, which looks like a permissions
  problem and is not.
- The system picker is a separate activity, so it must be tapped from outside: `adb shell uiautomator dump`,
  find `text="SAVE"` bounds, `adb shell input tap <x> <y>`.
- 💡 The WebView reloaded at least once mid-session (`window.__saf` went from a resolved URI to `undefined`),
  almost certainly Vite HMR reacting to file writes. **Stash state on `window` and poll it in the same
  connection; do not assume it survives between separate CDP sessions.**

---

## 11. Risks

1. **The storage refactor can destroy existing user data.** This is the only high-severity item, and it got
   *bigger* since the first draft: 27 `localStorage` call sites, not 23, plus 10 `uploads/` path sites, plus
   prefix enumeration (§4.2). Do it as its own commit, snapshot `ttrpg_*` keys to `ttrpg_*_old` first (reuse
   the existing pattern at App.jsx:319-325), and test the migration against a copy of real data before
   shipping.
2. ~~**Bundled-vs-uploaded misclassification**~~ — ✅ **resolved by the code, see §3.** A reference with no
   `storedName` is bundled. What replaces the risk is smaller: an exporter that walks only four of the five
   container shapes would still silently drop sounds. Keep the E2E assertion on bundle size for a known seed
   as the regression guard.
3. ~~**Android SAF save is unverified**~~ — ✅ **spiked 2026-10-04 and it works** (§7). What it changed: the
   dialog returns a `content://` URI, not a path; `plugin-fs` accepts that URI as `path` on mobile; and a raw
   `BaseDirectory.Download` fallback is **impossible** under scoped storage (the original §7 fallback row had
   to be deleted). **Residual risk:** the URI grant is transient — it lasts for the app session, so a bundle
   written in one session must not be assumed readable in a later one. Persisting the grant (or re-picking) is
   the fix if that ever matters; for export-then-share it does not.
4. **`formatVersion` becomes a permanent support burden** once public. Keep the reader permissive and the
   writer conservative; never reuse a field name with different meaning.
5. **Merge semantics surprise users.** Deferred (§8), so this is a v2 concern. When it lands, default to
   "New profile" and show a preview of what would be added.
6. **NEW — shared audio across profiles.** Move/copy made a shared `storedName` normal *within* a profile;
   importing a bundle into "New profile" could make it normal *across* profiles too (two profiles each holding
   a copy, or one file reference resolved per profile). `isFileReferencedElsewhere` only scans the active
   profile's in-memory state, so a future import path that links two profiles would delete bytes still in use.
   Rule to keep: **every profile owns its own `uploads/<profileId>/` directory; never hardlink or share blobs
   between profiles.** Content-addressed naming dedupes *within* a bundle, never across profiles.
7. **NEW — a profile switch is a state reload.** Today the app reads storage once at mount
   (`readStoredData` at App.jsx:317, first-load fallback at 683). Switching profiles means tearing down and
   rebuilding `characters` / `environmentSounds` / `groups` / `boxSize` / `backgroundSettings` / section icons
   in one go, plus revoking cached object URLs (`getObjectUrlForBlob` cache, App.jsx:2298) or the previous
   profile's blobs leak for the session. Design the switch as an explicit reload path rather than three
   setters, and decide early whether it is a full remount.

---

## 12. Implementation order

0. ~~**Spike the two unknowns on real hardware first**~~ — ✅ **the Android half is done** (2026-10-04, §7 and
   §10: SAF save/read verified byte-identical on an API 37 emulator, and it turned out **not** to need a scope
   change). **Remaining: the desktop picker-path write** (§10). It is a five-minute check on the Windows
   phase — do it before step 6, not during UI work.
1. **Storage adapter + profile refactor + first-run migration.** Alone, in its own commit. Nothing else starts
   until existing users are proven safe. Scope per §4.2: **27** `localStorage` sites, **10** `uploads/` path
   sites, prefix enumeration, and the two `ttrpg_*_icon` keys. `localStorageMigrationCompleted` stays global.
2. **Timestamps + tombstones** — *optional*, see §4.3. Cut this step for minimum v1; nothing else depends on it any more.
3. **Provenance classifier** (`isUploadedReference`) — ✅ a *structural* test now (§3), not a flag. Tiny, but do
   it before the bundle format so §13's bundle-size assertion has something to test.
4. **Bundle format** — `manifest.json` / `data.json` schema + zip read/write.
5. **Import** (atomic, both v1 modes) — before export, so a bundle is provably readable before we can produce one.
6. **Export + destination pickers** (desktop + Android SAF; web excluded in v1).
7. **UI** — profiles modal, Settings section, progress + report. Profile-scoped Restore Defaults (§9.2).
8. **E2E suite** + docs (README testing section).

---

## 13. Verification checklist

- [ ] A profile created on desktop exports; imported on Android; **all** characters, categories, groups, sounds, colors, loop/fade settings, theme and box size survive the round trip byte-identically.
- [ ] A bundle is a plain, unencrypted zip — openable with any standard zip tool, with no crypto fields in the manifest.
- [ ] A bundle with a corrupted payload is rejected on checksum, with the offending filename named.
- [ ] A bundle exported by a **newer** `formatVersion` is refused with both versions named.
- [ ] Import is atomic: kill the app mid-import → the previous profile is intact and usable.
- [ ] A known 3-character / 11-sound seed produces a bundle containing **only** user uploads (assert total bytes < 1 MB) — proves provenance classification.
- [ ] A sound **copied** into another character (§ move/copy, `f7f316e`) appears **once** in the bundle, not twice — proves dedupe-by-hash (§5).
- [ ] Export walks **all five** container shapes: a sound sitting in `groups[].sounds` (the vestigial array) is exported. Seed it by hand, since no UI puts anything there.
- [ ] A custom sound icon survives export/import as a **file** in `icons/`, not as inline base64.
- [ ] The custom background image is **absent** from the bundle: `data.json` contains no `imagePreview` and no `background/` entry, and a fresh import falls back to the theme colour until the user picks an image. A user with a 5 MB background set still gets a bundle under 1 MB.
- [ ] "New profile" import leaves the active profile untouched; "Replace active" is recoverable.
- [ ] **Unresolvable audio:** a bundle referencing a sound this app does not have imports successfully — the character/category is kept, the sound is dropped, and the summary names it and reports the count. A missing icon falls back to the default rather than dropping the sound.
- [ ] Deleting a profile removes **only its own** `uploads/<profileId>/` (no orphaned blobs, and the other profile's audio still plays).
- [ ] Migration: a localStorage snapshot from the current release upgrades to a default profile with no data loss.
- [ ] **The two `ttrpg_*_icon` keys and `boxSize` follow the profile**, and `localStorageMigrationCompleted` does **not** get a profile prefix (a prefixed one would re-run the one-time audio sweep).
- [ ] **Profile switch is clean:** switch A → B → A with different boards and different section icons; no bleed-through, and no stale blob URLs (a sound from A must not play after switching to B).
- [ ] **Restore Defaults stays idempotent and non-destructive** after being profile-scoped: press it twice on a profile with user sounds, and nothing user-created is lost (§9.2).
- [ ] Android: export → import on the same device via a user-picked SAF location. ⚠️ **Import needs its own
      `dialog.open()`, which returns a URI the same way — so the read path is proven by symmetry, but the
      picker is a second `ACTION_OPEN_DOCUMENT` and the *selected* document may be one this app no longer has a
      grant for. Test it rather than assuming.** The export half of this line is already proven (§7).
- [ ] ⚠️ **A user-cancelled picker rejects, it does not resolve to null.** `saveFileDialogResult` calls
      `invoke.reject("File picker cancelled")` on `RESULT_CANCELED`, so the export code needs a `catch` — an
      `await` with no handler produces an unhandled rejection and a silent no-op in the UI.
- [ ] The web build is **unchanged** — no export/import controls, and its existing behaviour intact.
- [ ] Two profiles side by side have fully independent data, settings and audio.
- [ ] `npx eslint src/App.jsx` → 0 errors; `npx vite build` succeeds; `cargo check` clean.
- [ ] E2E: new `e2e/e2e-profiles.mjs` (seed → export → wipe → import → deep compare) passes on web **and** Android, wired into `e2e-full.ps1`.
- [ ] README documents export/import and states plainly that there is no account and no data leaves the device.

### Deferred to a later release (not v1)

- [ ] Merge import (§8) — id remapping, duplicate names, `updatedAt` conflict rules.
- [ ] Web export/import (§7) — needs web audio moved out of localStorage first.
- [ ] Timestamps + tombstones (§4.3) if cut from v1.
- [ ] Folder / WebDAV / cloud sync (options A and C in §2), enabled behind the same `ProfileTransport` boundary.

---

## 14. E2E notes

- New suite `e2e/e2e-profiles.mjs`, same env contract as the existing suites (`CDP_PORT`, `LABEL`, `EXPECT_TAURI`, `SAVE_RESTORE`).
- **Do not drive the native file dialog.** `DOM.setFileInputFiles` terminates the Android WebView renderer and kills the app — that is the root cause already documented for `e2e-mobile.mjs`. Because §9.3 makes import take bytes directly, the suite can call `importBundle` in-page and never touch the picker.
- Add export/import to the harness's localStorage snapshot protection so a crashed run cannot eat a real profile.
  ⚠️ After the refactor the snapshot must cover **prefixed** keys too — a key-by-key list captured from the
  current release will silently miss `profile:*` and `spellcaster_profiles`, and the first crashed run would
  then leave a half-namespaced board. Snapshot by prefix scan, not by a hard-coded list.
- Wire `-Suite profiles` into `e2e-full.ps1`; the Windows phase still lacks the crash-safe snapshot that the Android phase has.
- Reuse the existing ID sequences rather than inventing a range: `EDIT` is at `E5`, `SOUND` is at `J8`, and
  move/copy took `M1-M22` + `G1-G5`. Continue from `P1`. Sound cards are `div role="button"`, so query
  `[data-sound-card]`, never `button`.
- Existing `SEED` (e2e-full.mjs:102-115) is a good starting point and is probably enough: `Human Paladin`
  (3 sounds), `Elf Sorcerer`, environment categories, `Tavern Pack` (mode `environment`, one category with a
  sound) and `Hero Pack` (mode `characters`, one character). Add seeding only for what a profile test
  genuinely needs. Note the seeded sound carries `files:[{name, displayName}]` with **no `storedName`** — i.e.
  it classifies as bundled under §3, so a provenance test needs an *uploaded* fixture too (the upload path
  writes real bytes through `storeFileInLocalStorage`).
