# Profiles + Sync — Planning Spec

> **Status**: Planning — **parked by user decision on 2026-09-27**. Documentation only; do not implement without a fresh request.
> **Created**: 2026-09-27
> **Related**: `ICON_FEATURE_SPEC.md` (also parked)

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

Verified in the current code:

| Fact | Detail | Consequence |
|---|---|---|
| **Default sounds ship with the app** | 71 files / 29 MB in `public/assets`, referenced by filename only | They are already identical on every install. **They never enter a bundle.** |
| **Only uploads need syncing** | `TAURI_STORAGE_DIR = 'uploads'` (App.jsx:10) under `BaseDirectory.AppData` | Bundles stay small |
| **Custom sound icons are also uploads** | `storeFileInLocalStorage(storedName, file)` → `icon: storedName` (App.jsx:1564-1566) | A bundle needs an `icons/` folder too — easy to miss |
| **Two different sound-file shapes coexist** | character sounds use `files: [{...}]`; legacy environment sounds use `file: "Name.mp3"` (see `src/data.json` `environmentSounds`, and the playback fallback at App.jsx:2532) | The exporter must walk **both**, and `files[]` entries are themselves heterogeneous (`name` / `storedName` / `displayName` / `url`) |
| **Custom background image is an inline data URL** | `backgroundSettings.imagePreview`, up to 5 MB base64, written straight into localStorage (App.jsx:2147-2194) | **Deliberately NOT synced** — it is a per-device display preference, and re-picking one image is far cheaper than rebuilding a library of sounds. It stays exactly where it is today. Export must **strip** it (§7) so a 5 MB blob never rides along inside `data.json` |
| **No timestamps exist anywhere** | 0 hits for `updatedAt` / `createdAt` / `deletedAt` in `src/App.jsx` and `src/data.json` | Last-write-wins is impossible today. Add timestamps + tombstones **now** — it is the prerequisite for A/C later |
| **Env data key is singular** | `ttrpg_environment`, not `ttrpg_environments` (App.jsx:410) | A latent bug that has fooled test harnesses before; be careful in any new code |
| **fs scope is AppData-only** | `src-tauri/capabilities/default.json` grants only `fs:allow-appdata-*` plus a few pathless perms | Writing a bundle to a user-picked path needs a widened scope; enumerating `uploads/` needs `read-dir` (verify whether `fs:default` already grants it) |

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

Every existing key moves under a per-profile namespace. `readStoredData(key, fallback)` (App.jsx:91) becomes profile-aware:

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

A **single storage adapter** owns this mapping. All 23 existing `localStorage.*` call sites (11 `setItem`, 9 `getItem`, 3 `removeItem`) go through it — no call site keeps a hard-coded key.

### 4.3 Timestamps (new, additive) — **optional in v1, recommended**

Added to every entity, optional on read (absent = epoch):

| Entity | New fields |
|---|---|
| Character / GroupChar | `updatedAt`, `deletedAt?` |
| Environment category / GroupCat | `updatedAt`, `deletedAt?` |
| Sound | `updatedAt`, `deletedAt?` |
| Group | `updatedAt`, `deletedAt?` |

`deletedAt` is a **tombstone**: deletes set it instead of splicing the array, so a later sync can propagate the deletion. Filtered out of the UI.

**Status: cut from the v1 critical path.** These fields were originally required for merge-import conflict resolution — and merge is no longer in v1 (§8), so nothing in the first release actually reads them. They are kept here as the cheapest possible insurance for the deferred options: Merge, and folder/cloud sync (A/C), both need them, and adding timestamps after users have data in the field is far harder than adding them now. `normalizeStoredData` (App.jsx:43) already guarantees array shapes, so it is also the place to default missing timestamps — no `DATA_VERSION` bump required. **If you want minimum v1, cut this section and step 2 with it; nothing else breaks.**

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
- `originalName` preserves the human-readable filename for restore/inspection. On import, the app may keep the content-addressed name as `storedName` and show `originalName` as `displayName` — matching the existing `files[]` entry shape.

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
2. Walk **both** sound-file shapes (`files[]` and legacy `file`) and both `files[]` entry variants, plus every custom icon (`sound.icon` that is an upload, not a bundled asset).
3. Classify each reference as **bundled** (resolves under `public/assets`) or **uploaded**. Only uploads are added. Prefer a write-time provenance flag over filename guessing (see §11, risk 2).
4. Hash each upload, dedupe by hash, stream into the zip.
5. Write `manifest.json` and `data.json` — **with `background.imagePreview` forced to `null`**, so a 5 MB base64 blob is never serialised into the bundle.
6. Stream the zip to the chosen path.
7. Show a progress dialog; allow cancel.

### Where the file goes

| Platform | Mechanism |
|---|---|
| Windows / Linux / macOS | `tauri-plugin-dialog` save dialog → `tauri-plugin-fs` write to the picked path |
| Android | SAF save via `tauri-plugin-dialog`; fallback = write to `BaseDirectory.Download` and show the resolved path |
| Web | **Out of scope for v1** — see below |

**Web is excluded from v1.** The web build keeps working exactly as it does today (a viewer/editor with its own localStorage data), but it gets no export/import buttons. The reason is structural, not a preference: web audio lives as base64 data-URLs in localStorage under `sound_file_*`, which caps out around 5 MB, so a web export could only ever be metadata and would be a misleading promise. Supporting web properly means first moving web audio out of localStorage into real files, which is a separate piece of work. The interface should be written so web can be enabled later behind the same byte-level `exportBundle`/`importBundle` functions (§9.3) with no rework.

> **Spike this first.** Android SAF is the least-verified piece of the whole feature. Prove "save a 5 MB zip to a user-picked location and read it back" on a real device before committing to the design.

---

## 8. Import pipeline (atomic)

1. Read the bundle (path, `File` object, or bytes).
2. Parse `manifest.json`. **Refuse cleanly** if `formatVersion` is newer than this build supports, with a message naming both versions.
3. Verify every `files[].sha256`. Any mismatch → abort, report the file, write nothing.
4. Write payloads into a **temp** dir `uploads/.import-<stamp>/`.
5. Run `data.json` through `normalizeStoredData` (App.jsx:43) — the existing forward-migration entry point — and through `normalizeHex` (App.jsx:1964).
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

The Settings modal (App.jsx:5021) is already a bottom sheet on mobile and a centered dialog on desktop — reuse that pattern for a "Profiles & Sync" section rather than adding a seventh modal:

- **Export profile…** → name, optional "include audio" checkbox, destination picker. No passphrase field (§6).
- **Import profile…** → source picker, then the mode choice, then a progress + per-file report.
- **Reset to starter sounds** → restores the bundled `src/data.json` defaults for the active profile.
- A one-line note: *an exported profile is an ordinary, unencrypted zip containing the audio you added; you are responsible for sharing it lawfully.*

### 9.3 Testability requirement

`importBundle(bytes, options)` and `exportBundle(options) → bytes` are **pure functions that take/return bytes**. The UI's only job is handing them picker output. This is what lets the E2E suite test import on all three platforms without touching a native file dialog.

---

## 10. Required plugin / capability changes

| Change | Where | Why |
|---|---|---|
| `tauri-plugin-dialog` | `src-tauri/src/main.rs` **and** `src-tauri/src/lib.rs` | save + open file pickers. **Both entry points** — plugins registered only in `main.rs` are silently missing on mobile (`plugin fs not found` class of bug) |
| `fs:allow-read-dir` (if `fs:default` does not already cover it) | `src-tauri/capabilities/default.json` | enumerate `uploads/` to build a manifest |
| Widened `fs` scope for a user-picked destination | `src-tauri/capabilities/default.json` | today only `fs:allow-appdata-*` is granted; a picker path will be denied otherwise |
| New frontend deps: **`fflate`** (zip) + a SHA-256 helper | `package.json` | streaming zip create/extract; small, fast, no native build step. For hashing use a small pure-JS implementation (e.g. `@noble/hashes`) — **not** `crypto.subtle`, which is unavailable outside a secure context, and not a Rust command, which would re-add the native work this design no longer needs |

**No custom Rust commands are required.** With encryption dropped there is no crypto to do in Rust, so the whole feature is frontend work plus registering `tauri-plugin-dialog`. The only native surface is the plugin registration, the fs scope, and the platform pickers.

Integrity hashing is still worth keeping (it is what makes "abort on corrupt bundle" possible), and it can be done in pure JS. If it ever proves slow on large libraries, promoting just the hash to a Rust command is an isolated, low-risk change.

---

## 11. Risks

1. **The storage refactor can destroy existing user data.** This is the only high-severity item. Do it as its own commit, snapshot `ttrpg_*` keys to `ttrpg_*_old` first (reuse the existing pattern at App.jsx:79-87), and test the migration against a copy of real data before shipping.
2. **Bundled-vs-uploaded misclassification** puts 29 MB of built-in audio into every bundle, or drops a user's own uploads. Use a write-time provenance flag, and add an E2E assertion on bundle size for a known seed.
3. **Android SAF save is unverified.** Spike first (§7).
4. **`formatVersion` becomes a permanent support burden** once public. Keep the reader permissive and the writer conservative; never reuse a field name with different meaning.
5. **Merge semantics surprise users.** Deferred (§8), so this is a v2 concern. When it lands, default to "New profile" and show a preview of what would be added.

---

## 12. Implementation order

1. **Storage adapter + profile refactor + first-run migration.** Alone, in its own commit. Nothing else starts until existing users are proven safe.
2. **Timestamps + tombstones** — *optional*, see §4.3. Cut this step for minimum v1; nothing else depends on it any more.
3. **Provenance flag** for uploads vs bundled assets.
4. **Bundle format** — `manifest.json` / `data.json` schema + zip read/write.
5. **Import** (atomic, both v1 modes) — before export, so a bundle is provably readable before we can produce one.
6. **Export + destination pickers** (desktop + Android SAF; web excluded in v1).
7. **UI** — profiles modal, Settings section, progress + report.
8. **E2E suite** + docs (README testing section).

---

## 13. Verification checklist

- [ ] A profile created on desktop exports; imported on Android; **all** characters, categories, groups, sounds, colors, loop/fade settings, theme and box size survive the round trip byte-identically.
- [ ] A bundle is a plain, unencrypted zip — openable with any standard zip tool, with no crypto fields in the manifest.
- [ ] A bundle with a corrupted payload is rejected on checksum, with the offending filename named.
- [ ] A bundle exported by a **newer** `formatVersion` is refused with both versions named.
- [ ] Import is atomic: kill the app mid-import → the previous profile is intact and usable.
- [ ] A known 3-character / 11-sound seed produces a bundle containing **only** user uploads (assert total bytes < 1 MB) — proves provenance classification.
- [ ] A custom sound icon survives export/import as a **file** in `icons/`, not as inline base64.
- [ ] The custom background image is **absent** from the bundle: `data.json` contains no `imagePreview` and no `background/` entry, and a fresh import falls back to the theme colour until the user picks an image. A user with a 5 MB background set still gets a bundle under 1 MB.
- [ ] "New profile" import leaves the active profile untouched; "Replace active" is recoverable.
- [ ] **Unresolvable audio:** a bundle referencing a sound this app does not have imports successfully — the character/category is kept, the sound is dropped, and the summary names it and reports the count. A missing icon falls back to the default rather than dropping the sound.
- [ ] Deleting a profile removes its uploads from disk (no orphaned blobs).
- [ ] Migration: a localStorage snapshot from the current release upgrades to a default profile with no data loss.
- [ ] Android: export → import on the same device via a user-picked SAF location.
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
- Wire `-Suite profiles` into `e2e-full.ps1`; the Windows phase still lacks the crash-safe snapshot that the Android phase has.
