# Profiles + Sync — Planning Spec

> **Status**: **Steps 3–6 SHIPPED 2026-10-13.** The provenance classifier (§3), the bundle format (§5), atomic
> import in both v1 modes (§8) and export with its destination pickers (§7, §10) are implemented in
> `src/profileBundle.js` plus a shared `src-tauri/src/scope.rs`, and carry a 36-assertion node check
> (`node e2e/profileBundle.check.mjs`, 36/36). The scope grant was then **measured on real desktop hardware**,
> 11/11. Step 1 shipped earlier as `577505d`; **step 7 (UI) is partially done** — the Export/Import section exists
> in Settings > Profiles — and **step 8 (the shared E2E spec) has not started**, which is why the feature entry in
> `e2e/coverage.manifest.json` correctly stays `status: planned`.
> ⚠️ **No native picker has ever been opened and the user has not hand-tested the built app.** §13 now records
> exactly which checklist rows are machine-asserted, which are only code-reviewed, and which are unrun.
> **Revised**: 2026-10-04, 2026-10-06, 2026-10-11, 2026-10-13
>
> **Original status notes (superseded, kept for the reasoning):** Both platform unknowns remain **closed**: Android
> spiked 2026-10-04, **desktop spiked 2026-10-06** — a user-picked path *is* writable after a one-command runtime
> scope grant, no blanket fs scope needed (§10). The 2026-10-04 revision that fixed a wrong `fs:default`/`read_dir`
> claim was itself wrong; §3 and §10 are corrected below. **Every code reference in this spec was re-verified
> against `src/App.jsx` at 6769 lines on 2026-10-11**, not inherited from the 6240-line draft — and the file is now
> **~7300 lines after step 6**, so treat every `App.jsx:NNNN` as "roughly right, verify before you rely on it".
> The three open design decisions are **SETTLED** (§0.3).
> **Created**: 2026-09-27 · **Related**: the icon feature (formerly `ICON_FEATURE_SPEC.md`, implemented & verified
> 2026-09-28; that spec file was deleted 2026-09-28), Restore Defaults (shipped as `bde7483`), the move/copy feature
> (shipped as `f7f316e`), per-sound volume (shipped 2026-10-06), and sound priming (shipped 2026-10-08).

---

## 0. Revision log — what changed since 2026-09-28, and why

The design below still holds. Three features landed in the week after this spec was written, and they
move facts, not decisions. Nothing in §1, §2, §5, §6 or §8 needed to change.

| # | Change | Sections touched |
|---|---|---|
| 1 | Every `src/App.jsx` line number moved — the file was 5751 lines when this was written, it is **6240** now, and **6769** as of the 2026-10-11 refresh | §3, §7, §8, §9.2, §10 |
| 2 | **`localStorage` call sites went 23 → 27** (13 `setItem` / 11 `getItem` / 3 `removeItem`), and two keys were added that this spec never knew about | §4.2 |
| 3 | The code also **enumerates** `localStorage.length` / `localStorage.key(i)` to sweep `sound_file_*`. A storage adapter that only wraps get/set/remove is **not enough** | §4.2, §12 step 1 |
| 4 | **Restore Defaults shipped** (`bde7483`) — §9.2's "Reset to starter sounds" is existing behaviour that only needs profile-scoping | §9.2, §13 |
| 5 | **Provenance is already solved in code** — a bundled reference has **no `storedName`**; an upload always does. This replaces §11 risk 2's filename-guessing worry | §3, §7 step 3, §11 |
| 6 | **Move/copy shipped** (`f7f316e`) — two sounds can now legitimately name the **same `storedName`**, so dedupe-by-hash is mandatory, not an optimisation | §5, §7, §11 |
| 7 | **§10's open fs question is answered** — `fs:default` does **not** grant directory listing, and the permission is `fs:allow-read-dir` (**singular** — this spec had it wrong twice; see §10) | §10 |
| 8 | ✅ **The Android SAF spike was run on 2026-10-04 and it PASSES** — `dialog.save()` returns a `content://` URI and `plugin-fs` writes/reads it byte-identically. §7 and §10 record what it proved | §7, §10 |
| 9 | ✅ **The desktop spike was run on 2026-10-06 and it PASSES too.** A user-picked path **is** writable; it needs **one** of two fixes, and the narrow one is a 5-line Rust command. It also **falsified a fact this spec asserted** (`fs:default` *does* grant `read_dir`), **found a missing capability** (`dialog:allow-save`), and **found a silent-corruption trap** (a plain `Array` payload is stringified). **There are now no unverified platform unknowns left in this spec.** | §3, §7, §10, §11, §12, §13 |
| 10 | ✅ **2026-10-11 refresh — every line number re-verified against the 6769-line file**, and the two features shipped since revision 2 are folded in: **per-sound volume** (`volume` is now a sound field the bundle must carry) and **priming** (explicitly *not* profile content). The `uploads/` chokepoint count is corrected **10 → 4 real ones** (§0.2), the `settings` block gains `volume`, and §13/§14 are rewritten for the refactored E2E harness and the coverage gate | §3, §4.2, §5.2, §7, §9.2, §11, §12, §13, §14 |

**Status: both platform unknowns are now closed** (Android 2026-10-04, desktop 2026-10-06). What remains before
implementation is a **design decision**, not a spike: pick the desktop route in §10 (recommend the runtime grant)
and review the whole spec.

### 0.3 ✅ The three open design decisions — SETTLED 2026-10-11

These were the only genuinely open choices. They are now decided, and the consequences are folded into the
sections below, so an implementer does not re-litigate them.

| # | Question | **Decision** | What it changes |
|---|---|---|---|
| 1 | **Timestamps + tombstones (§4.3) — keep or cut from v1?** | ✅ **CUT from v1** | §4.3 stays as a record for the deferred Merge / folder-cloud sync work, but there is **no** implementation step. §12's step list loses it. Adding the fields later is cheap: `normalizeStoredData` (App.jsx:269) is the single place shapes are repaired, so a later migration can default them there without a `DATA_VERSION` bump. **Nothing in v1 reads them**, so shipping them would be dead weight — and dead weight in a *storage schema* is the expensive kind, because every later bundle format has to carry it |
| 2 | **Profile switch — full remount or in-place state reload?** | ✅ **FULL REMOUNT for v1** | Settles §11 risk 7 and §11 risk 10. Switching profiles remounts the app with the new profile as the first-load state, so the three auto-save effects (App.jsx:3922-3949) **never run against a stale prefix** — the race is designed out rather than guarded against. ⚠️ **The price is a brief reload flash**, which is a real cost on Android where a remount also drops cached object URLs. That is the correct trade for v1: profiles are a rare, deliberate action, and correctness beats a smooth transition. 💡 If a future release wants the animation back, the correct route is a `switchingRef` guard the three effects consult — **not** a partial in-place reload |
| 3 | **`DATA_VERSION` mismatch — reset or migrate?** | ✅ **MIGRATE** | Settles §11 risk 11. The **existing** mismatch path (App.jsx:319-325) resets a key to defaults and renames the old value to `<key>_old` — a destructive move that exists today only because there has never been a real version skew. Once namespaced, it fires **per profile**, and the worst case is an imported bundle from an older build wiping the user's board. **Migrate instead**: run the bundle through `normalizeStoredData` (App.jsx:269) and forward-repair, never reset. ⚠️ This means the profile code path must **not** reuse the existing mismatch branch as-is; it needs a sibling that repairs rather than discards. And `DATA_VERSION` still must not be bumped casually — it gates every profile at once |

⚠️ **Decision 2 is load-bearing for the implementation order.** A remount means the profile switch must be
**proven in the same commit as the storage adapter** — before any bundle code exists — because the switch is what
validates the adapter's shape. §12's step 1 is therefore bigger than "wrap 27 call sites", and §13's
byte-identical A → B → A assertion is the gate that says it worked.

**Created**: 2026-09-27 · **Revised**: 2026-10-04, 2026-10-06, 2026-10-11

### 0.1 Three things that did not exist at the last revision

These are the parts of the 2026-10-11 refresh that are more than line-number churn. Each one changes what the
bundle has to carry or how the tests have to be written, so each is called out where it applies.

1. **Per-sound volume shipped** (2026-10-06). `volume` is an optional per-sound field, a **trim on top of**
   master, defaulting to `1`. It lives inside each sound object in `ttrpg_characters` / `ttrpg_environment` /
   `ttrpg_groups`, so it is carried by `data.json` automatically (§5.2) — **no schema change and no new
   `localStorage` key** (asserted by `specs/volume.mjs` `P14a`/`P14b`, which is why the §4.2 census below is
   still exactly 27). The one thing to watch: the **new-sound save path is an explicit allowlist**, not a spread,
   so an export/import implementation that rebuilds a sound by hand must carry `volume` too or it will be
   silently dropped on write-back (§5.2).
2. **Sound priming shipped** (2026-10-08). Priming is **one-shot, session-only, and has no `localStorage` key at
   all** — the absence is deliberate. So it is **not profile content** and must not appear in `manifest.json`,
   `data.json` or the bundle. A "prime a sound on device A, hear it on device B" expectation would be a bug
   report, not a missing feature; note it in the README when this ships (§13).
3. **The E2E harness was refactored** (2026-10-10/11) into shared specs plus a machine-checked coverage gate.
   §14 previously described a world with a standalone `e2e/e2e-profiles.mjs` and a `-Suite profiles` switch;
   **neither exists any more** and the old advice would produce a suite that cannot be wired. §14 is rewritten.

### 0.2 The `uploads/` path count is 4, not 10 — and that is good news

The previous revision claimed "`uploads/` paths are built in **10 places**" and warned that a per-profile prefix
changes 10 sites. **Re-counted 2026-10-11: that figure was counting *lines that mention the constant*, not
distinct code paths.** There are **4 real chokepoints**, and 3 of them are single functions:

| Chokepoint | Line | What it does |
|---|---|---|
| `TAURI_STORAGE_DIR` | App.jsx:22 | the constant itself |
| `getTauriStoragePath(fileName)` | App.jsx:2604 | builds `uploads/<fileName>` — **the single read/write path builder** |
| `storeFileInLocalStorage(fileName, file)` | App.jsx:2606 | the one write path (Tauri `writeFile`, web `sound_file_*`) |
| the web→Tauri migration sweep | App.jsx:1300-1345 | the one-time sweep; walks `sound_file_*` and re-writes each into `uploads/` |

`getTauriStoragePath` is called from exactly **three** places (App.jsx:2613, 2662, 3529) — read, write and
remove. So adding a profile segment is, in the common case, **a change to one function**, not ten edits, and the
§11 risk-1 severity comes down accordingly. ⚠️ **This is a count, not a licence to skip a site.** `getFileFromLocalStorage`
also branches to `appDataDir`/`join` (App.jsx:2667-2669) and resolves by **absolute path** rather than through
`getTauriStoragePath`, so the profile prefix must be threaded through there too. Re-verify before relying on
either number — the previous revision's census had already gone stale twice.

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

**Re-verified 2026-10-11** against `src/App.jsx` at **6769 lines**. Line numbers in earlier drafts of this
table were from the 5751-line file and were all wrong; the 2026-10-06 pass corrected them against the
6240-line file, and the two features shipped since have moved them again. **Treat every `App.jsx:NNNN` in this
spec as "roughly right, verify before you rely on it"** — the *structure* is what this table is for.

| Fact | Detail | Consequence |
|---|---|---|
| **Default sounds ship with the app** | 71 files / 29 MB in `public/assets`, referenced by filename only | They are already identical on every install. **They never enter a bundle.** |
| **Only uploads need syncing** | `TAURI_STORAGE_DIR = 'uploads'` (App.jsx:22) under `BaseDirectory.AppData` | Bundles stay small |
| **Custom sound icons are also uploads** | `handleIconUpload` → `icon: storedName` + `iconDisplayName` (App.jsx:2572-2580) | A bundle needs an `icons/` folder too — easy to miss |
| **Two different sound-file shapes coexist** | character/group sounds use `files: [{…}]`; legacy environment sounds use `file: "Name.mp3"` (see `src/data.json`, and the playback fallback at App.jsx:3565 in `playSound`) | The exporter must walk **both**, and `files[]` entries are themselves heterogeneous (`name` / `storedName` / `displayName` / `url`) |
| ✅ **Provenance is a structural fact, not a guess** | a **bundled** reference has **no `storedName`** — `src/data.json` ships `{"name":"Caustic_Blast_Acid_1.mp3"}` and nothing else. An **uploaded** one always has `storedName` set to `sound_<rand>_<safeName>`, and its `name` is *also* rewritten to the storedName with the human name kept in `displayName` (App.jsx:2692-2716). Confirmed 2026-10-11: `src/data.json` contains **zero** `"volume"` keys and its sound entries are exactly `{id,name,type,icon,files[],randomPlay,color,duration,loop,fadeIn,fadeOut}` | **The exporter classifies by `storedName` presence.** Do not infer from filenames, and do not add a write-time provenance flag (the old §11 risk 2) — the data already says which is which. Icons classify the same way: bundled icons are plain filenames (`Caustic_Blast_Acid.png`), custom icons always carry the `icon_<rand>_<name>` shape (App.jsx:2543). |
| ✅ **Shipped sounds are also identifiable by id** | `mergeShippedDefaults` builds `allShippedSoundIds` from `src/data.json` (App.jsx:355) | A second, independent provenance signal, and the one Restore Defaults already trusts. Useful as a cross-check in E2E. |
| 🆕 **A sound carries an optional `volume` trim** | shipped 2026-10-06. `normalizeSoundVolume` (App.jsx:705) is the single definition of "absent === 100%", used in **both** save paths (App.jsx:1709 hydrate, 1776/1876 save). `src/data.json` has **no** `volume` key — bundled sounds are always 100% | **It is content, so it syncs** — a per-sound level is not a device preference. It rides inside the sound object, so `data.json` carries it for free (§5.2). ⚠️ **The new-sound save path is an explicit allowlist, not a spread** (App.jsx:1774-1776 says so in a comment), so any code that *rebuilds* a sound by hand must carry `volume` or it is silently dropped. Use `normalizeSoundVolume`, never `?? 1` — `0` is a legitimate level |
| 🆕 **Priming is deliberately not profile content** | shipped 2026-10-08. `primedRef` (App.jsx:1507) is the authority; **there is no `localStorage` key and none should be added** — the absence is asserted by `P31a` | **Do not put priming in the bundle.** It is one-shot and session-only by decision (2026-10-06). A user who primes on device A and expects it on device B has misunderstood, so say so in the README |
| **A `storedName` can now be shared by two sounds** | move/copy's copy **shares** the source's reference by design; `isFileReferencedElsewhere` (App.jsx:2255) exists because of it | Export **must** dedupe by content hash — two references, one blob (§5). Deleting a profile must not assume one owner. |
| **`isFileReferencedElsewhere` scans only in-memory state** | it walks `allSoundContainers()` (App.jsx:2087) over the *current* React state | With profiles, "the current state" is **one profile**. Cross-profile sharing cannot happen through the UI today, so per-profile `uploads/<id>/` dirs stay correct — but say so in a comment before anyone "simplifies" it. |
| **Custom background image is an inline data URL** | `backgroundSettings.imagePreview`, up to 5 MB base64, written straight into localStorage (App.jsx:3201, applied 3149-3173) | **Deliberately NOT synced** — it is a per-device display preference, and re-picking one image is far cheaper than rebuilding a library of sounds. It stays exactly where it is today. Export must **strip** it (§7) so a 5 MB blob never rides along inside `data.json` |
| **No timestamps exist anywhere** | 0 hits for `updatedAt` / `createdAt` / `deletedAt` in `src/App.jsx` and `src/data.json` — re-checked 2026-10-11, still true | Last-write-wins is impossible today, so Merge (§8) and folder/cloud sync (A/C) cannot be conflict-resolved when they arrive. ✅ **v1 does not add them** (§0.3 decision 1) — but whoever builds Merge will have to add them *to existing user data*, which is the expensive order. Decide then, not now |
| **Env data key is singular** | `ttrpg_environment`, not `ttrpg_environments` (written at App.jsx:3934) | A latent bug that has fooled test harnesses before; be careful in any new code |
| **`localStorage` access is 27 call sites and includes enumeration** | 13 `setItem` / 11 `getItem` / 3 `removeItem`, plus `localStorage.length` + `localStorage.key(i)` in the `sound_file_*` sweep (App.jsx:1310-1311) and 4 `ttrpg_*_icon` writes (App.jsx:1141-1149). **Re-counted 2026-10-11: still exactly 27 + 2** — per-sound volume and priming both added zero keys, which is asserted by `P14a`/`P14b` and `P31a` | The "single storage adapter" of §4.2 must own **enumeration and prefix matching**, not just get/set/remove. This spec's earlier "23 call sites" figure was already stale once. |
| 🆕 **The three auto-save effects write the whole slice, undebounced** | `ttrpg_characters` (App.jsx:3922-3929) → `ttrpg_environment` (3932-3939) → `ttrpg_groups` (3942-3949). Each is `JSON.stringify(<entire slice>)` into localStorage on every state change | ⚠️ **This is the hard part of a profile switch and it is new.** See §11 risk 10 — a switch that changes the prefix but not the state will have the *old* profile's data written into the *new* profile's keys by these three effects. There is no write choke point and no transaction |
| 🆕 **`uploads/` paths are built in 4 chokepoints, not 10** | `TAURI_STORAGE_DIR` (App.jsx:22), `getTauriStoragePath` (App.jsx:2604), `storeFileInLocalStorage` (App.jsx:2606), and the migration sweep (App.jsx:1300-1345). `getTauriStoragePath` has exactly 3 callers: 2613 (write), 2662 (read), 3529 (remove). ⚠️ but `getFileFromLocalStorage` also builds an absolute path via `appDataDir`/`join` (App.jsx:2667-2669) and **bypasses `getTauriStoragePath` entirely** | The previous "10 path sites" figure counted lines mentioning the constant. Prefix `getTauriStoragePath` and the write helper and the per-profile dir mostly follows — but **do not skip the absolute-path branch in `getFileFromLocalStorage`** |
| **fs scope is AppData-only** | `src-tauri/capabilities/default.json` grants `fs:default`, `fs:allow-appdata-*`, `fs:allow-exists`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-mkdir`, `fs:allow-remove` | Anything outside the app directories is denied — **for reads as well as writes** (proven: `exists()` on a Desktop path is refused too, §10) |
| ❌→✅ **CORRECTED 2026-10-06: `fs:default` *does* include `read_dir`** | earlier drafts of this spec claimed it did not. It does: `fs:default` → `read-app-specific-dirs-recursive` → `allow-read-dir` **+ `scope-app-recursive`**. Verified in the resolved crate (`tauri-plugin-fs-2.5.2/permissions/default.toml`) and **empirically**: `readDir('uploads', AppData)` listed **90 entries** and the AppData root listed `uploads`, with **no capability change at all** | **`fs:allow-read-dir` is NOT needed.** Building a manifest by enumerating `uploads/` works today. (The plural-vs-singular warning below is still right about the *name*, but the permission is not needed either way — drop that row from §10.) |
| ✅ **On desktop the picker returns a plain path string, and cancel resolves `null`** | driven on Windows 2026-10-06: the save dialog is a real `#32770` that honours the `title` option; accepting it resolved a `string` (`"C:\Users\emire\Documents\spellcaster-picked.spellcaster"`), cancelling resolved `null` (`desktop.rs save_file` → `Option<FilePath>`) | **Not** a `file://` URL, **not** an object, and **not** a rejection — this is the opposite of Android, which rejects with *"File picker cancelled"*. One `try/catch` + a null check covers both platforms |
| ⚠️ **On desktop, a plain `Array` byte payload is silently stringified** | `write_file` receives its data as the fetch body (`scripts/process-ipc-message-fn.js` returns `{contentType: 'application/octet-stream', data: message}` for arrays) — but `fetch` coerces an `Array` body to `toString()`. Measured: a 4100-byte payload landed as **12297 bytes** of `80,75,3,4,65,65,…`. A `Uint8Array` is a `BufferSource`, is sent raw, and round-tripped byte-identically | **Always pass a `Uint8Array`/`ArrayBuffer`, never `Array.from(bytes)`.** `App.jsx` already does (`new Uint8Array(arrayBuffer)` at App.jsx:1324 and 2612). 💡 This is also why the Android spike round-tripped perfectly while desktop did not: Android uses `postMessage` IPC, which preserves the array, whereas desktop uses the custom-protocol `fetch` (`canUseCustomProtocol = osName !== 'android'`) |
| ✅ **The dialog plugin needs its own capability entries** | with the plugin registered but no `dialog:*` permission, the call fails with *"Permissions associated with this command: dialog:allow-save, dialog:default"* — **not** "Plugin not found", which is the separate mobile failure | `capabilities/default.json` must gain `dialog:allow-save` + `dialog:allow-open` (or `dialog:default`). §10's table previously listed only the plugin registration and would have shipped broken |
| **Android cannot write outside AppData by path** | a raw write to `/storage/emulated/0/Download/…` is refused with *"forbidden path … maybe it is not allowed on the fs scope"* | The §7 `BaseDirectory.Download` fallback is **dead on Android**. Export must go through the SAF `content://` URI — which works (§7). |
| **On Android, `plugin-fs` accepts a `content://` URI as `path`** | `commands.rs` `#[cfg(mobile)] resolve_file` → `android.rs` `resolve_content_uri` → Kotlin `FsPlugin.getFileDescriptor` → `contentResolver.openAssetFileDescriptor` → raw fd → `std::fs::File`. Verified end to end, §7 | No scope change is needed on Android for the export destination — the URL branch skips the scope check entirely. This is the single most important fact for §7. |
| **Resolved fs plugin is 2.5.2** | `Cargo.toml` declares `tauri-plugin-fs = "2.5.1"`; semver resolves to **2.5.2** in the lockfile | Check the resolved version's permission names before adding any — the permission set is versioned. |
| **`tauri-plugin-dialog` is registered nowhere** | `main.rs:7` has fs, `lib.rs:4-5` has fs + os, `lib.rs:8-9` has log. No dialog (re-confirmed 2026-10-11) | It must be added to **both** entry points — see §10. |

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

(Read at App.jsx:1141-1142, written at 1145 and 1149. A profile whose section icon leaked across profiles would
look like a data bug, not a sync bug, so it is easy to miss in review.)

`localStorageMigrationCompleted` (App.jsx:1300-1345) is **not** namespaced: it records that the one-time
web→Tauri audio sweep has run, which is a property of the *device*, not of a profile. Leave it global and say
so in a comment.

A **single storage adapter** owns this mapping. All **27** existing `localStorage.*` call sites (13 `setItem`,
11 `getItem`, 3 `removeItem`) go through it — no call site keeps a hard-coded key. On top of that:

- **Enumeration is part of the adapter's job.** The migration sweep walks every key with
  `localStorage.length` / `localStorage.key(i)` looking for `sound_file_*` (App.jsx:1310-1311). A
  get/set/remove-only wrapper leaves that loop reading and deleting the *global* namespace. The adapter needs
  `keysWithPrefix(prefix)` / `removeAllWithPrefix(prefix)`.
- **`uploads/` paths are a second front, and there are 4 chokepoints — see §0.2.** `getTauriStoragePath`
  (App.jsx:2604) is the single path builder with exactly 3 callers, and `storeFileInLocalStorage`
  (App.jsx:2606) is the single write path. Do the localStorage keys without these and Tauri profiles will
  share audio. ⚠️ **`getFileFromLocalStorage` builds an absolute path via `appDataDir`/`join`
  (App.jsx:2667-2669) and bypasses `getTauriStoragePath`** — that is the site a "one-line change" misses.
- **Per-profile `uploads/` dirs are safe** even though a copy can share a `storedName`
  (`isFileReferencedElsewhere` only scans the active profile's in-memory state — see §3), but leave a comment
  saying so, or a future "simplification" will introduce cross-profile byte loss.
- 🆕 **The adapter must also know the active profile before any effect runs.** The three auto-save effects
  (App.jsx:3922-3949) fire on state change and stringify the entire slice; if the adapter reads
  `activeProfileId` at write time, a switch must set state *and* prefix atomically or the two disagree. See
  §11 risk 10 — this is the one genuinely new design problem in the refactor.

### 4.3 Timestamps (new, additive) — **optional in v1, recommended**

Added to every entity, optional on read (absent = epoch):

| Entity | New fields |
|---|---|
| Character / GroupChar | `updatedAt`, `deletedAt?` |
| Environment category / GroupCat | `updatedAt`, `deletedAt?` |
| Sound | `updatedAt`, `deletedAt?` |
| Group | `updatedAt`, `deletedAt?` |

`deletedAt` is a **tombstone**: deletes set it instead of splicing the array, so a later sync can propagate the deletion. Filtered out of the UI.

**Status: ✅ CUT from v1 (decided 2026-10-11, §0.3). There is no implementation step for this.** It was
originally required for merge-import conflict resolution — and merge is no longer in v1 (§8), so nothing in the
first release reads these fields. It is kept here as a record for the deferred work: Merge, and folder/cloud sync
(A/C), both need them, and adding timestamps after users have data in the field is harder than adding them now.
`normalizeStoredData` (App.jsx:269) already guarantees array shapes, so it is also the place to default missing
timestamps later — **no `DATA_VERSION` bump required** when that day comes.

💡 **Why cut rather than "cheap insurance now".** A field nothing reads is not free in a storage schema: every
later `manifest.json` / `data.json` revision has to carry it, every import has to decide what to do with a
tombstone from a bundle that may predate it, and `deletedAt` in particular implies a filter on the read path that
does not otherwise exist. The insurance premium is paid in every future format version; the policy is only claimed
if Merge or sync actually ships. Cut it, and take the small hit later if it is ever needed.

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
- `originalName` preserves the human-readable filename for restore/inspection. On import, the app may keep the content-addressed name as `storedName` and show `originalName` as `displayName` — matching the existing `files[]` entry shape (App.jsx:2698-2699 writes `{name: storedName, displayName: file.name, url: storedName}`; the hydrate path reads the same four fields at App.jsx:1677-1679).

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

**Two sound-level fields need a sentence each, because both are easy to lose and neither is a device preference:**

- 🆕 **`volume` (per-sound trim, shipped 2026-10-06) syncs.** It lives inside each sound object, so it is
  carried by `characters` / `environmentSounds` / `groups` with no schema change. Absent means `1`; use
  `normalizeSoundVolume` (App.jsx:705) to coerce, never `?? 1` — `0` is a legitimate level. ⚠️ `src/data.json`
  has **no** `volume` key at all (bundled sounds are always 100%), so a bundle of an untouched profile contains
  zero `volume` keys and that is correct, not a bug.
- **Priming does not sync, and never appears in the bundle.** It is one-shot and session-only by decision, with
  no `localStorage` key (§0.1). Nothing in `manifest.json` or `data.json` should mention it.

`data.json` in `src/` is the **shipped defaults**, not a profile export. Do not use it as the schema template
without stripping the two things it deliberately omits: `volume` (always 100% for bundled sounds) and any
`imagePreview`.

---

## 6. Two things deliberately left out

**Encryption — omitted.** The bundle is a plain zip, readable by anyone it is shared with. Accepted: the payload is sound effects and a list of names, not sensitive material, and a plain file makes "send it to my group in Discord" a one-action operation. Recorded here so a future reader asking "why isn't this encrypted?" gets the answer instead of re-litigating it.

The one consequence to keep in mind: audio a user adds may be material they have no right to redistribute, and an unencrypted bundle gives them no protection. That is the user's call at export time, and the UI note in §9.2 says so.

**Custom background image — not synced.** Per-device display preference, not content. Re-picking one image costs seconds; re-creating a library of sounds with names, colours, loop and fade settings costs an evening. The feature deliberately syncs the tedious thing and not the trivial thing.

---

## 7. Export pipeline

1. Read the active profile through the storage adapter.
2. Walk **both** sound-file shapes (`files[]` and legacy `file`) and both `files[]` entry variants, plus every custom icon (`sound.icon` that is an upload, not a bundled asset). Walk **all five container shapes** via `allSoundContainers()` (App.jsx:2087) — including the vestigial `groups[].sounds`. A sound in the wrong shape is a sound that silently does not get exported.
3. Classify each reference as **bundled** or **uploaded**. ✅ **This is now a structural test, not a heuristic: a reference with no `storedName` is bundled, one with a `storedName` is an upload** (§3). Do **not** add the write-time provenance flag the old draft of this spec asked for — the data already distinguishes them, and a new flag would be a second source of truth to keep in sync. Keep the classification in one helper (`isUploadedReference`) so the icon path and the audio path cannot disagree.
4. Hash each upload, dedupe by hash (**not** by `storedName` — see §5), stream into the zip.
5. Write `manifest.json` and `data.json` — **with `background.imagePreview` forced to `null`**, so a 5 MB base64 blob is never serialised into the bundle. Sound objects go across **verbatim** (so `volume` rides along, §5.2); do not rebuild them field by field, because the new-sound save path is an explicit allowlist and anything not on it is dropped silently.
6. Stream the zip to the chosen path — as a **`Uint8Array`**, after the desktop scope grant (§10).
7. Show a progress dialog; allow cancel.

### Where the file goes

| Platform | Mechanism | Proven? |
|---|---|---|
| Windows / Linux / macOS | `tauri-plugin-dialog` save dialog → **plain absolute path string** → runtime scope grant (§10) → `tauri-plugin-fs` write. **No capability scope widening** | ✅ **2026-10-06, Windows** |
| Android | SAF save via `tauri-plugin-dialog` → **the result is a `content://` URI, not a path** → hand that URI straight to `tauri-plugin-fs` (no scope check on that branch) | ✅ **2026-10-04, API 37 emulator** |
| Web | **Out of scope for v1** — see below | n/a |

### ⚠️ Write the bytes as a `Uint8Array`, on every platform
`exportBundle()` returns `bytes`; whatever hands them to `writeFile` must pass a **`Uint8Array`** (or
`ArrayBuffer`). A plain array is **silently corrupted on desktop** — see §3. The failure is quiet: the write
succeeds, the file is the wrong size, and the bundle is unopenable. Cheap guard: assert
`bytes instanceof Uint8Array` at the single call site, and let the §13 bundle-size check catch it.

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
5. Run `data.json` through `normalizeStoredData` (App.jsx:269) — the existing forward-migration entry point — and through `normalizeHex` (App.jsx:2998). ⚠️ `normalizeStoredData` is the **group-aware** path and returns `sounds: []` for the vestigial `groups[].sounds` (App.jsx:306), folding any legacy array into a `Default` category — so a bundle whose `groups[].sounds` was populated will come back reshaped. That is existing behaviour, not a bundle bug, but it means export→import is **not** byte-identical for that one vestigial array (§13 says the same about testing it).
6. **Atomically swap** the temp dir into `uploads/<targetProfileId>/`, then commit the namespaced keys. ⚠️ In
   **"Replace active"** this installs into the **live** profile, which is the one place a remount does *not*
   automatically protect — remount afterwards, or verify prefix/state agreement the way the switch does
   (§11 risk 10).
7. Report per file: imported / skipped (already present) / failed. ✅ **Step 7, 2026-10-15:** the report now
   carries `files: [{ path, label, status }]` and `skipped` is real — a blob already present in the target
   profile is not rewritten (`blobStore.has()`, existence not content; see §12 step 7 for why). `failed`
   still aborts the whole import, because the atomicity above depends on it (§12 step 7's plan, half b).

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

The Settings modal (App.jsx:6481, opened by `openSettingsModal` at App.jsx:2949, triggered from the header gear at
App.jsx:4766 and the mobile rail at App.jsx:5031) is already a bottom sheet on mobile and a centered dialog on
desktop — reuse that pattern for a "Profiles & Sync" section rather than adding a seventh modal:

- **Export profile…** → name, optional "include audio" checkbox, destination picker. No passphrase field (§6).
- **Import profile…** → source picker, then the mode choice, then a progress + per-file report.
  ✅ **Revised by the 2026-10-15 step 7 plan: a per-file report with NO progress dialog.** Both modes remount,
  so the Settings modal unmounts with the tree and a message set in it is discarded — the silence on success is
  structural, not an oversight. What ships is the per-file status list (§8 step 7) plus a **one-shot notice in a
  global `spellcaster_import_notice` key**, read on the next mount and shown as a dismissible banner, so the
  feedback outlives the remount without adding an eighth modal. A progress dialog during the write was
  considered and declined: a handful of files, under a second, is not worth a second modal.
- **Reset to starter sounds** → ⚠️ **this already shipped** as `bde7483`: `restoreDefaults` (App.jsx:2959,
  button at App.jsx:6698) backed by `mergeShippedDefaults` (App.jsx:349). It is **not new work** — it needs to
  become profile-scoped (operate on the active profile, and stop merging into whatever the previous profile left
  behind). Note it deliberately never deletes user content and is idempotent; **keep both properties** when you
  scope it, because they are what make the button safe to press twice. 💡 Two traps it already pins, which
  matter twice over once profiles exist: **environment categories have no `id`** — `category` IS the key
  (App.jsx:344, 370-373) — so a renamed default category is re-matched by falling back to a stored entry that
  still carries one of that default's sound ids; and a sound is user content only if its id appears in **no**
  default's sound list (App.jsx:355), so a shipped sound the user dragged into another character is restored
  home rather than duplicated. Both are asserted by `specs/reset.mjs` (`O7`, `O5`) — **reuse that spec as the
  fixture reference rather than re-deriving the rules.**
- A one-line note: *an exported profile is an ordinary, unencrypted zip containing the audio you added; you are responsible for sharing it lawfully.*
- A second one-line note: *priming is not saved or exported — it lasts for one trigger in this session.*

### 9.3 Testability requirement

`importBundle(bytes, options)` and `exportBundle(options) → bytes` are **pure functions that take/return bytes**. The UI's only job is handing them picker output. This is what lets the E2E suite test import on all three platforms without touching a native file dialog.

---

## 10. Required plugin / capability changes

**Re-verified 2026-10-11**; Android half *executed* 2026-10-04; desktop half *executed* 2026-10-06. Both spikes
needed the dialog plugin — **those spike edits were reverted afterwards** (at the user's request), so nothing below
was in the tree as of the 2026-10-11 refresh.

> ✅ **SHIPPED 2026-10-13 (spec step 6).** Every row below is now implemented and verified. `tauri-plugin-dialog`
> **2.7.3** (with `rfd` 0.16.0) is in `Cargo.toml`, registered in `main.rs` **and** `lib.rs`, `dialog:allow-save` +
> `dialog:allow-open` are in `capabilities/default.json`, and `grant_path` lives in a shared
> `src-tauri/src/scope.rs`. `cargo check --offline` is clean and `gen/schemas/capabilities.json` regenerated.
> **Three facts that cost time and are not in this table:**
> - **`tauri-plugin-dialog` is needed in `package.json` as well.** Registering the Rust crate does nothing for the
>   bundler; `vite build` fails with *"Rolldown failed to resolve import '@tauri-apps/plugin-dialog'"*.
> - **Pin the npm package to the crate's minor.** `^2` resolved npm to **2.8.2** against a Rust crate of
>   **2.7.3**, and every `tauri dev` then printed *"Error Found version mismatched Tauri packages"*. It is
>   `@tauri-apps/plugin-dialog@~2.7.3` now.
> - **`mod` cannot be declared inside a function body.** The shared `grant_path` module is `mod scope;` at the
>   *top* of both entry points, not inside `main()` / `run()`.

| Change | Where | Why |
|---|---|---|
| `tauri-plugin-dialog` | `src-tauri/src/main.rs` **and** `src-tauri/src/lib.rs` | save + open file pickers. **Both entry points** — plugins registered only in `main.rs` are silently missing on mobile. Adding it to only one is not a shortcut: with it missing from `lib.rs` the app rejects the call with **`dialog.save not allowed. Plugin not found`**, which is exactly the failure this row exists to prevent (observed during the Android spike) |
| ⚠️ **`dialog:allow-save` + `dialog:allow-open`** (or `dialog:default`) | `src-tauri/capabilities/default.json` | **This row was missing and would have shipped broken.** Registering the plugin is not enough: with no `dialog:*` permission the call fails with *"Permissions associated with this command: dialog:allow-save, dialog:default"*. Verified on desktop 2026-10-06 — that error only appears **after** adding the permission does the picker open |
| ❌ **`fs:allow-read-dir` — NOT NEEDED, drop it** | ~~`capabilities/default.json`~~ | This spec used to claim `fs:default` has no directory listing. **It does**: `fs:default` → `read-app-specific-dirs-recursive` → `allow-read-dir` + `scope-app-recursive`. Measured 2026-10-06 with the **unmodified** capability file: `readDir('uploads', AppData)` → **90 entries**, AppData root → `uploads`. Enumerating `uploads/` to build a manifest therefore needs **no permission change at all**. (The earlier build error that rejected `fs:allow-read-dirs` was real, but it was fixing a non-problem: `permissions/read-dirs.toml` defines a *set* named `read-dirs`; the per-command permission is `allow-read-dir`. Keep that in mind if you ever do need it.) |
| ✅ **Desktop destination: a runtime scope grant — RECOMMENDED** | **one new Rust command**, see below | Answering the old "last unverified item". **Both** routes below were built and measured; the grant is the one to ship |
| New frontend deps: **`fflate`** (zip) + a SHA-256 helper | `package.json` | streaming zip create/extract; small, fast, no native build step. For hashing use a small pure-JS implementation — **not** `crypto.subtle`, which is unavailable outside a secure context, and not a Rust command, which would re-add the native work this design no longer needs. ✅ **Both installed** (added by `fd57d3a`, first imported by step 4). ⚠️ **`@noble/hashes` v2 has an explicit-`.js` exports map**: the import is `@noble/hashes/sha2.js`, **not** `@noble/hashes/sha2`, which fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Current deps are `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-os`, `@noble/hashes`, `fflate`, `lucide-react`, `react`, `react-dom` |
| (`src-tauri/Cargo.toml`) | — | `tauri-plugin-dialog = "2"` **must be added** alongside `tauri-plugin-fs = "2.5.1"` / `-log = "2"` / `-os = "2.2.0"`; it resolves to **2.7.3** and pulls `rfd 0.16.0`. All 12 added packages were already in the local cargo cache, so `cargo check --offline` resolved without network. The resolved fs version is **2.5.2**, so read permission names from the resolved crate, not the declared one |

### ✅ Desktop destination: the last unknown, closed (spiked 2026-10-06, Windows)

**The question.** `dialog.save()` returns an absolute path the user chose, but today's fs scope is AppData-only, so
`writeFile` to that path fails: *"forbidden path: C:\Users\emire\Desktop\… maybe it is not allowed on the scope for
`allow-write-file` permission in your capability file"*. **Reads are denied too** — `exists()` on the same path
fails identically. (On Android none of this applies: the `content://` URI branch skips the scope check entirely.)

**Both fixes work. They were built and measured, not reasoned about.**

| | **A — runtime scope grant (recommended)** | **B — static capability scope** |
|---|---|---|
| What | one Rust command, below | `{ "identifier": "fs:scope", "allow": [ "**" ] }` in `capabilities/default.json` |
| Rust code | ~5 lines | none |
| Write to a picked Desktop path | ✅ 4100-byte round trip byte-identical | ✅ same |
| Blast radius | **that one file only** — a sibling file in the same directory stayed denied | **the whole filesystem** — Desktop, Documents and Temp all wrote, and an ungranted sibling file wrote too |
| Verdict | narrow, explicit, auditable | ⚠️ a public app whose frontend can write anywhere is a different security posture; only reasonable if you also accept that any future XSS or injected dependency can write anywhere |

The code for A — the *same mechanism the fs plugin itself uses for drag-and-drop*
(`tauri-plugin-fs-2.5.2/src/lib.rs`, `RunEvent::WindowEvent::DragDrop` → `app.fs_scope().allow_file(path)`).
`FsExt::fs_scope()` returns a clone of the plugin's shared `Arc<ScopeInner>`, so the mutation is immediately
visible to the command layer's own `is_allowed` check:

```rust
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn grant_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.fs_scope().allow_file(&path).map_err(|e| e.to_string())
}
```

Register it with `.invoke_handler(tauri::generate_handler![grant_path])` and call it between the picker and the
write. No capability file change, no `fs:scope` entry, no `**`.

⚠️ **`allow_file` covers that exact path only.** Granting a *directory* does **not** let you write a new file
inside it (measured) — that needs `allow_directory(dir, true)`, which is also what the plugin uses for
dropped folders. The save dialog returns a file, so `allow_file` is the right call.

💡 If you would rather not add a command, `std::fs::write` inside a command works too (verified) — but it moves
byte handling into Rust and breaks the §9.3 purity that keeps `exportBundle` testable. Prefer A.

**Net native surface: one ~5-line command, one plugin registration, two `dialog:*` capability entries, and no
fs-scope widening.** The earlier draft's "No custom Rust commands are required" is superseded: the desktop spike
showed the scope *can* be granted at runtime, which is the cheapest way to keep it narrow, and the command is the
entire price. With encryption dropped there is still no crypto in Rust.

Integrity hashing is still worth keeping (it is what makes "abort on corrupt bundle" possible), and it can be
done in pure JS. If it ever proves slow on large libraries, promoting just the hash to a Rust command is an
isolated, low-risk change.

### How the spike was driven (reproduce it without writing app code)

The dialog could be exercised **without touching `src/App.jsx`**, which is why this was cheap:

- **Desktop (2026-10-06):** the same CDP route as the Windows E2E phase —
  `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9224 --remote-allow-origins=*'`, then
  `npm run tauri dev` detached, then drive `window.__TAURI_INTERNALS__.invoke(...)` over
  `http://127.0.0.1:9224/json`. `tauri dev` rebuilt on each capability change in ~17-34 s (deps were cached).
- **Dismissing the native dialog from outside:** the save dialog is a Win32 `#32770` owned by `app.exe`.
  `EnumWindows` filtered to the app's PID found it; `PostMessage(hwnd, WM_COMMAND, IDCANCEL)` **cancelled** it
  (resolved `null`) and the same call with `IDOK` **accepted** the `defaultPath` (resolved the path string). 💡
  The dialog is **not** the foreground window when `tauri dev` runs hidden — polling `GetForegroundWindow`
  sees `Program Manager` forever. Enumerate by PID + class instead.
- **Android (2026-10-04):**
  - `tauri android dev` → Gradle builds `app-x86_64-debug.apk` but did **not** install it here; `adb install -r`
    the APK from `src-tauri/gen/android/app/build/outputs/apk/x86_64/debug/` and launch it manually.
  - Forward the WebView devtools socket (`adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>`) and
    drive the plugin over raw CDP: `window.__TAURI_INTERNALS__.invoke('plugin:dialog|save', { options })`.
  - The system picker is a separate activity, so it must be tapped from outside: `adb shell uiautomator dump`,
    find `text="SAVE"` bounds, `adb shell input tap <x> <y>`.
- ⚠️ **The two fs commands take the path in different places, on both platforms.** `write_file` expects it in a
  **header** (`encodeURIComponent`d) with the bytes as the body; `read_file` expects `{ path, options }` as
  **args**. Getting it wrong fails as `invalid args 'path' for command 'read_file'`, which looks like a
  permissions problem and is not. 💡 `read_dir`'s `baseDir` is a **`u16` enum**, not the `'$APPDATA'` string the
  JS API uses — passing the string fails with `invalid type: string "$APPDATA", expected u16` (`AppData` = 14).
- ⚠️ **Verify bytes on disk, not just the promise.** A rejected promise is unambiguous, but a *resolved* one can
  still have written the wrong bytes (§7, the `Array` trap). `Get-Item`/`ReadAllBytes` on the target after each
  write; that is what caught it.
- 💡 The WebView reloaded at least once mid-session (Android: `window.__saf` went from a resolved URI to
  `undefined`), almost certainly Vite HMR reacting to file writes. **Stash state on `window` and poll it in the
  same connection; do not assume it survives between separate CDP sessions.**

---

## 11. Risks

1. **The storage refactor can destroy existing user data.** This is the only high-severity item, and it got
   *bigger* since the first draft: 27 `localStorage` call sites, not 23, plus prefix enumeration (§4.2). Do it as
   its own commit, snapshot `ttrpg_*` keys to `ttrpg_*_old` first (reuse the existing pattern at App.jsx:319-325),
   and test the migration against a copy of real data before shipping. 💡 The *`uploads/`* half is **much smaller
   than the previous revision claimed** — 4 chokepoints rather than 10 sites (§0.2) — so most of the risk here is
   the localStorage keys, not the file paths.
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
7. ✅ **SETTLED 2026-10-11 — a profile switch is a FULL REMOUNT** (§0.3 decision 2). Today the app reads storage
   once at mount (`readStoredData` at App.jsx:317, first-load fallback at 683). The remount makes the switch an
   *explicit first-load* of the target profile, so `characters` / `environmentSounds` / `groups` / `boxSize` /
   `backgroundSettings` / section icons all rebuild together and cached object URLs (`objectUrlCache`,
   App.jsx:846, populated 2587-2600) go with the old tree — no stale blobs leak for the session. ⚠️ **The cost is
   a reload flash**, most visible on Android where a remount also drops the object-URL cache. Accepted: a profile
   switch is a rare, deliberate action, and this is the option that cannot corrupt data. 💡 If animation is wanted
   later, add a `switchingRef` guard the three effects consult — do **not** restore a partial in-place reload.
8. **NEW — a byte payload can be silently corrupted and it looks like success.** Desktop IPC sends the
   `write_file` body through `fetch`, and an `Array` body is coerced to a comma-joined string: the write
   *resolves*, and the file is 3× too large and unopenable (§3, §7). No error anywhere. Guard the single call
   site (`bytes instanceof Uint8Array`) and keep the §13 bundle-size assertion, which fails loudly on this.
9. **CLOSED — desktop picker-path write.** ✅ spiked 2026-10-06 (§10). Not a risk any more: the runtime grant
   works and is narrow. The only way to get this wrong now is to reach for the `fs:scope: ["**"]` shortcut,
   which works too and hands the frontend write access to the whole filesystem. Prefer the grant.
10. ✅ **DESIGNED OUT by the remount decision (§0.3 decision 2) — but this is why that decision was made.** The
    three auto-save effects (App.jsx:3922-3949) `JSON.stringify` the *entire* slice into localStorage on every
    state change, undebounced, with **no write choke point and no transaction**. A switch that sets
    `activeProfileId` and then calls three setters would, in the gap, have the **old** profile's `characters`
    written into the **new** profile's keys — silently, corrupting the profile the user just switched *to*.
    A **full remount** removes the gap entirely: the new profile is the first-load state and the effects only
    ever run with a prefix and a state that already agree. ⚠️ **The residual risk is the in-place paths that
    remain** — "Replace active" import (§8) installs into the live profile, and it must either remount too or
    verify prefix/state agreement the same way. Do not let the remount create a false sense that the race class
    is gone; §13's byte-identical A → B → A assertion is the guard, and it must also cover a switch immediately
    followed by an edit.
11. ✅ **SETTLED 2026-10-11 — mismatches MIGRATE, they do not reset** (§0.3 decision 3). `readStoredData`
    (App.jsx:319-325) resets a key to defaults when `ttrpg_data_version` does not match, renaming the old value
    to `<key>_old`. Once that key is `profile:<id>:ttrpg_data_version`, the reset fires **per profile** — so a
    profile created by an older build, or one imported from an older bundle, would silently lose its board to
    the same mechanism. **The profile path must migrate instead**: run the data through `normalizeStoredData`
    (App.jsx:269) and forward-repair, never discard. ⚠️ **This means the profile code must not reuse the existing
    mismatch branch as-is — it needs a sibling that repairs rather than resets**, and that sibling is the one the
    import path (§8 step 5) uses. ⚠️ And `DATA_VERSION` still gates **every profile at once**, so it must not be
    bumped casually: a bump with no forward-repair implemented is a simultaneous wipe of all users' boards.

---

## 12. Implementation order

0. ~~**Spike the two unknowns on real hardware first**~~ — ✅ **BOTH halves done** (Android 2026-10-04, desktop
   2026-10-06). Android: SAF save/read verified byte-identical on an API 37 emulator, no scope change needed.
   Desktop: `dialog.save` → plain path string, cancelled → `null`, and the write works after a runtime
   `allow_file` grant, byte-identical. **No platform unknowns remain.** What is left is the §10 design choice
   (grant vs `**`) — take the grant — and the user's review of this spec.
   **The three design decisions are also settled** (§0.3): timestamps cut, switch = full remount, `DATA_VERSION`
   migrates. **Everything below is now unblocked.**
1. **Storage adapter + profile index + first-run migration + a PROVEN profile switch.** Alone, in its own
   commit — nothing else starts until existing users are proven safe. Scope per §4.2: **27** `localStorage`
   sites, **4** `uploads/` chokepoints (§0.2 — not 10), prefix enumeration, and the two `ttrpg_*_icon` keys.
   `localStorageMigrationCompleted` stays global.
   ⚠️ **This step is bigger than "wrap 27 call sites", and that is by design.** The switch (a full remount,
   §0.3 decision 2) is what validates the adapter's shape, so it ships *here*, before any bundle code exists.
   Green means: two profiles, switch A → B → A, **both byte-identical to before** (§13).
   ⚠️ Build the migrate-not-reset sibling of the version-mismatch path (§0.3 decision 3) in this step too — the
   import path (§8 step 5) depends on it and retrofitting it later would mean touching the migration twice.
2. ~~**Timestamps + tombstones**~~ — ✅ **CUT from v1** (§0.3 decision 1). There is no step; §4.3 is kept only as
   a record for the deferred Merge / sync work.
3. ✅ **Provenance classifier** (`isUploadedReference`) — DONE 2026-10-13. A *structural* test (§3), no flag.
   In `src/profileBundle.js`: `isUploadedReference(ref)` for `files[]` entries and `isUploadedIcon(sound)` for the
   bare-string icon, both funnelled through ONE `classifySoundReferences(sound)` so the audio and icon paths cannot
   disagree. 💡 The icon needed its own predicate and the honest reason is worth keeping: `sound.icon` is a bare
   string in both cases, so no shape test separates them, and §3 forbids inferring from filenames. The evidence is
   `iconDisplayName`, which `handleIconUpload` writes in the same setState and `src/data.json` never has.
4. ✅ **Bundle format** — DONE 2026-10-13. `manifest.json` / `data.json` + zip via `fflate` (streaming `Zip` +
   `ZipPassThrough` on write, `unzipSync` on read) and SHA-256 via `@noble/hashes/sha2.js`. Sound objects go across
   **verbatim** (§5.2): spread, with only the *reference fields* rewritten to content-addressed names.
   **Three additions to this section that the draft did not have:**
   - **`settings.sectionIcons` was added** to `data.json`. §5.2's settings block listed only `boxSize` and
     `background`, but §4.2 makes both `ttrpg_*_icon` keys profile content, so without it a round trip silently
     dropped a custom Characters/Environment icon.
   - **`exportBundle` returns `{bytes, manifest, data}`, not bare `bytes`.** §9.3's purity requirement is that the
     UI can hand the result to `writeFile` without the bundle logic knowing about pickers, and it still can; the
     extra fields are so the success message can report real counts.
   - **The zip output is still buffered into one `Uint8Array`,** because `exportBundle` returns bytes and
     `writeFile` takes one buffer. "Streamed, never buffered whole in JS memory" holds for the *inputs* (each blob
     can be released once pushed), not the output. That is unavoidable given §9.3, and it is why §11 risk 8 matters.
   ✅ **Thin end-to-end round trip wired and green first**, as this step requires: `node e2e/profileBundle.check.mjs`,
   **36/36**, covering export → wipe → import → deep compare plus every refusal path.
5. ✅ **Import** (atomic, both v1 modes) — DONE 2026-10-13. `parseBundle` verifies every checksum before a byte is
   written; `importBundle` then writes all blobs and **commits the namespaced keys last**. That ordering IS the
   atomicity, because `fs:allow-remove-dir` does not exist and so a temp-dir swap — the textbook atomic replace —
   is not available (see rule 4 in the header comment of `src/profileBundle.js`). A failure anywhere before the
   commit leaves the previous board byte-for-byte intact and the half-written blobs as harmless orphans. "Replace active" snapshots the live profile's keys to a global
   `spellcaster_import_backups` (last 3 kept) **before** touching anything, and ends with `requestProfileRemount()`
   — §11 risk 10's residual case, the one path the remount-on-switch does not cover by itself.
6. ✅ **Export + destination pickers** — DONE 2026-10-13. `tauri-plugin-dialog` 2.7.3 registered in **both** entry
   points, `dialog:allow-save` + `dialog:allow-open` in `capabilities/default.json`, and the ~5-line `grant_path`
   command in a **shared `src-tauri/src/scope.rs`** (a file module cannot be declared inside a function block, so
   `mod scope;` sits at the top of both `main.rs` and `lib.rs`). Web excluded, as §7 requires.
   ⚠️ **`tauri-plugin-dialog` must be added to `package.json` too, not only `Cargo.toml`** — registering the Rust
   crate is not enough, and `vite build` fails with *"Rolldown failed to resolve import"* until the npm package is
   there. ⚠️ **Pin the npm package to the crate's minor** (`@tauri-apps/plugin-dialog@~2.7.3`, not `^2`): with `^2`
   npm took **2.8.2** against a Rust crate of **2.7.3** and every `tauri dev` printed *"Error Found version
   mismatched Tauri packages"*.
7. **UI** — profiles modal, Settings section, progress + report. Profile-scoped Restore Defaults (§9.2).

   > ✅ **SHIPPED 2026-10-15.** Both halves are done, and the first one needed **no code at all**.

   > 📋 **PLAN AGREED 2026-10-15 (user + opencode).** Two halves, and the first turned out to be a **proof, not a
   > change** — read the note below before writing any code for it.
   >
   > **(a) "Profile-scoped Restore Defaults" needs NO implementation — it needs a test.** `restoreDefaults`
   > (App.jsx:3307) only calls `setCharacters` / `setEnvironmentSounds`; it writes no storage itself. And the
   > three auto-save effects declare `activeProfileId` **fixed for the mount** (App.jsx:4270-4274), so a press
   > cannot land in another profile's namespace — which is §0.3 decision 2 (switch = full remount) doing the
   > scoping for us. §9.2's worry ("stop merging into whatever the previous profile left behind") was written
   > **pre-profiles** and is structurally answered. Nothing asserted it, which is the only reason the §13 row is
   > unchecked. So: **add `O11`–`O13` to `e2e/specs/reset.mjs`** — capture profile A's keys, create + switch to
   > profile B, press Restore Defaults on B, assert **A is byte-identical** and **B got the merged defaults**.
   > 💡 Reuse Suite F's helpers (`__newProfile` / `__switchTo`, profiles.mjs:49-66) and `__keysFor(pid)`
   > (page.mjs:121) rather than re-deriving them; and keep it **last in the spec** — the switch remounts the tree.
   >
   > **(b) The import report — per-file data + a notice that survives the remount.** NOT the full §9.2 wording:
   > **no progress dialog.** The reason the UI is silent on success today (§9.2's "progress + per-file report") is
   > structural, not an omission — both modes remount, so the Settings modal unmounts with the tree and any
   > message set in it is discarded. A dialog *during* the import would be a real second modal for a write that
   > is typically a handful of files and under a second. What ships instead:
   > 1. **`importBundle` returns per-file statuses** — `files: [{ path, label, status }]` with
   >    `status ∈ imported | skipped | failed`, plus counts. Pure, node-covered.
   > 2. **`skipped` becomes real**: skip the write when the blob is **already present** in the target profile
   >    (`blobStore.has()`). This is what §8 step 7's "skipped (already present)" has been waiting for — today
   >    every blob is rewritten unconditionally. ⚠️ **The rule is existence, not content**, and that is a
   >    deliberate trade: `storedName` is `sound_<rand>_<safeName>`, so a name collision means the *same* upload,
   >    and `stat` is **not granted** so a size check would mean reading the whole file — which is the cost
   >    skipping exists to avoid. The residual (a same-named, different-content file would be kept) is recorded
   >    rather than defended against.
   > 3. **A one-shot notice survives the remount**: the summary is written to a **global** `spellcaster_import_notice`
   >    key — global for the same reason `spellcaster_profiles` is, since an import can create a *new* profile —
   >    and the app reads it once on the next mount and renders a dismissible banner. **Not** re-adding
   >    per-file progress, and **not** a second modal.
   > 4. ⚠️ **A new storage key is the known hazard**: it must join `KNOWN_KEYS` in `e2e/lib/page.mjs`, which is
   >    the single list `P14a`, `P31a` and `Q9` all import. That is the `spellcaster_import_backups` precedent,
   >    and the reason those three read one list rather than three.
   >
   > **Out of scope for step 7**: the §13 rows that need a *second physical device* (Android SAF import,
   > cross-device round trip), and promoting the node checks to DoD gates.
8. **E2E shared spec** `e2e/specs/profiles.mjs` + **manifest registration** + docs (README testing section).
   ⚠️ This is not "add a file" any more — see §14. **Register the feature as `planned` in
   `e2e/coverage.manifest.json` when you *start*, not when you finish**: flipping `planned` → `shipped` is
   what forces the tests to exist, and the checker fails a `shipped` feature with no covering suite.

---

## 13. Verification checklist

> ✅ / ❌ marks below are as of **2026-10-13**, when steps 3–6 shipped. The unchecked ones are either step 7/8 work
> (UI beyond the minimal wiring, shared E2E spec) or things needing a real second device. **The `node
> e2e/profileBundle.check.mjs` rows are marked with the check name** rather than ✅, so a reader can tell a
> machine-run assertion from a claim.
>
> ⚠️ **Nothing here is covered by a browser spec yet.** The feature stays `planned` in
> `e2e/coverage.manifest.json` precisely because of that — step 8 is what turns these into `shipped`.

- [x] A profile created on desktop exports; imported on Android; **all** characters, categories, groups, sounds, colors, loop/fade settings, theme and box size survive the round trip byte-identically. → *"the imported board deep-compares to the exported one"*, plus a separate boxSize/background/section-icons row. ⚠️ **Desktop-only so far**; the Android half is unverified.
- [x] A bundle is a plain, unencrypted zip — openable with any standard zip tool, with no crypto fields in the manifest. → *"the bundle is a PLAIN zip - PK magic"* and *"assertUint8Array rejects a plain Array"*. 💡 **That second check matters more than it looks:** the Array form really does produce a comma-joined file — reproduced live during the step 6 probe, where a 64-byte payload landed as **189 bytes** of digits with no error.
- [x] A bundle with a corrupted payload is rejected on checksum, with the offending filename named. → *"a corrupt payload is refused on checksum, naming the file"*.
- [x] A bundle exported by a **newer** `formatVersion` is refused with both versions named. → *"a newer formatVersion is refused, naming BOTH versions"*.
- [x] Import is atomic: kill the app mid-import → the previous profile is intact and usable. → *"a failed blob write aborts BEFORE any key is touched"*, plus *"a refused bundle writes NOTHING"*. ⚠️ **Proven by an injected write failure, not by killing the app mid-import** — the ordering is what makes it hold, but the literal kill test is unrun.
- [x] A known 3-character / 11-sound seed produces a bundle containing **only** user uploads — proves provenance classification. → *"the manifest lists ONLY uploads"* + *"the bundle stays small - no 5 MB background image rides along"*.
- [x] A sound **copied** into another character (§ move/copy, `f7f316e`) appears **once** in the bundle, not twice — proves dedupe-by-hash (§5). → *"a copied sound is ONE blob, not two"*.
- [x] Export walks **all five** container shapes → *"all five container shapes are found"*. ⚠️ As §13 already warned, that array cannot be tested by seeding it and reloading; the check walks a plain fixture object, so it proves the *walker*, not a reload round trip.
- [x] A custom sound icon survives export/import as a **file** in `icons/`, not as inline base64. → *"classification agrees across the audio and icon paths"* + the manifest row listing `Fireball.png`.
- [x] The custom background image is **absent** from the bundle: `data.json` contains no `imagePreview` and no `background/` entry, and a fresh import falls back to the theme colour. → *"data.json carries no imagePreview"* + *"boxSize, background and section icons all follow the profile"* (which asserts `imagePreview === ''` on the importing side).
- [x] "New profile" import leaves the active profile untouched; "Replace active" is recoverable. → *"the previous profile is untouched"* / *"the replaced profile is RECOVERABLE"* / *"restoring the snapshot brings the old board back byte-for-byte"*.
- [x] **Unresolvable audio:** a bundle referencing a sound this app does not have imports successfully — the character/category is kept, the sound is dropped, and the summary names it and reports the count. → *"a sound the bundle cannot resolve is DROPPED but its container is kept"*.
- [ ] Deleting a profile removes **only its own** `uploads/<profileId>/` — ✅ covered by Suite F, ⚠️ but not re-run against a profile that came from an import.
- [x] Migration: a localStorage snapshot from the current release upgrades to a default profile with no data loss. → Suite F, and `profileStorage.check.mjs`.
- [x] **The two `ttrpg_*_icon` keys and `boxSize` follow the profile**, and `localStorageMigrationCompleted` does **not** get a profile prefix. → Suite F + `profileStorage.check.mjs` ("stays GLOBAL").
- [x] 🆕 **A profile switch does not corrupt either profile (the auto-save race, §11 risk 10).** → Suite F `F7`/`F6a`.
- [x] 🆕 **`DATA_VERSION` mismatch migrates and never resets (§11 risk 11).** → Suite F `F10`, plus *"the data version stamp is written so the first read does not fake a backup"*.
- [x] 🆕 **A profile switch remounts cleanly (§0.3 decision 2).** → Suite F.
- [x] 🆕 **A sound's `volume` trim survives the round trip**, including `0` and an absent value. → *"volume rides along verbatim, including the legitimate 0"*.
- [x] 🆕 **No priming state in the bundle.** → the bundle module has no priming import at all, and `P31a` asserts no key exists.
- [x] **Restore Defaults stays idempotent and non-destructive after being profile-scoped** → `specs/reset.mjs` covers the merge contract; ✅ **the "acts on the active profile only" half shipped 2026-10-15** as **`O11`–`O13`**. 💡 **No app code changed for it** — the scoping is a consequence of §0.3 decision 2 (`activeProfileId` is fixed for the mount, App.jsx:4270-4274), so this row was an *unasserted* property rather than a missing feature. `O12` is the byte-identical capture; `O11` exists because creating a profile already switches and remounts, so there is no second switch to drive.
- [x] 🆕 **The import report is per-file, with `skipped` real** → **`I18`** + `profileBundle.check.mjs` ("the report lists EVERY manifest file, each with a status", "a blob already present is SKIPPED and its bytes are left alone"). A store without `has()` still imports everything, which is what lets the older injected stores keep working.
- [x] 🆕 **The summary outlives the remount that destroys the modal** → `I19`/`I20`/`I21` + the node check. `I19` pins the *negative* case (`setActive:false` parks **nothing**, so no stale summary can survive); `I20` asserts the banner is on screen **without a reload**, because the remount is synchronous; `I21` that dismissal survives another reload.
- [x] **No `fs:scope: ["**"]` and no blanket write scope ships.** → `capabilities/default.json` carries no `fs:scope` entry at all; the only extra reach is the single-file `grant_path`.
- [x] **The grant is per-file, not per-directory.** → ✅ **measured on real hardware 2026-10-13**, 11/11: an ungranted `Documents` write AND read are refused, the granted file writes and reads byte-exact, and **a sibling in the same folder is still refused for both read and write**. Re-granting is idempotent.
- [x] Desktop: export → **a user-picked path outside AppData** → the file exists with the exact bundle bytes. → the grant probe wrote 64 bytes to the Desktop and read them back with the zip magic intact; ⚠️ **that was the probe's payload, not a real `exportBundle` result through the picker** — the picker itself has never been opened.
- [x] **Bytes are handed over as a `Uint8Array`.** → `assertUint8Array` at the single call site, *plus* the app reads the file back off disk after writing and compares size and magic before reporting success.
- [ ] Android: export → import on the same device via a user-picked SAF location. → the export half was proven 2026-10-04; ⚠️ **the import half needs its own `dialog.open()` and is unverified.**
- [x] ⚠️ **A picker cancel is handled on both platforms, and they differ.** → both arms are handled in `pickSavePath`/`pickOpenPath`: a `/cancel/i` rejection resolves to `null` (Android) and a `null` return is honoured (desktop). ⚠️ **Code-reviewed, not executed** — neither platform's picker was opened.
- [x] **The dialog permissions are present in `capabilities/default.json`** → ✅ present, and **verified live**: `plugin:dialog|message` was invoked over CDP against a real `tauri dev` and did **not** return "Plugin not found" or "Permissions associated with this command".
- [x] The web build is **unchanged** — no export/import controls, and its existing behaviour intact. → the section is gated on `isTauri`; web E2E is 223/0/0.
- [x] Two profiles side by side have fully independent data, settings and audio. → Suite F.
- [x] `npx eslint src/App.jsx` → 0 errors; `npx vite build` succeeds; `cargo check` clean. → all three, 2026-10-13.
- [x] 🆕 **`node e2e/check-coverage.mjs` is green**, and the `Profile sync and export/import` feature entry has flipped from `planned` to `shipped` **with a non-empty `coveredBy`**. → ✅ **2026-10-14, step 8**: the checker is green and the entry is **`status: shipped`** — the flip is what forced `specs/bundle.mjs` to exist. ⚠️ **These two rows were stale until 2026-10-15** and still said "step 8, not started" on a step that had shipped the previous day; corrected here, not in place of the work.
- [x] E2E: `e2e/specs/bundle.mjs` (seed → export → wipe → import → deep compare) runs from **both** entrypoints, green on web, Windows and Android. → ✅ **2026-10-14, step 8**: Suite **I (I0–I17)**, wired into both entrypoints, **all 17 ids green on Windows and Android**; the web arm is I1 + I2 only, which is correct rather than a gap (§7 — web audio is base64 in localStorage and caps around 5 MB). It found a real shipping bug on its first run (the missing `await` on `dirname`).
- [x] README documents export/import and states plainly that there is no account and no data leaves the device — including the priming note (§9.2). → ✅ **done 2026-10-13**: Features bullets for Profiles and Profile Export & Import, two Platform Support rows, and an explicit note that web has no export/import *and why*. 💡 **The README had documented neither priming nor profiles either** — both shipped weeks earlier and neither had ever reached it, so this row was less a steps-3-6 chore than a three-feature gap found by it.

### ⚠️ What is NOT proven, stated plainly

Steps 3–6 ship a working engine and a real, proven scope grant, and everything that can be asserted without a
human has been asserted. Three things remain unproven and none of them is covered by the 36 node checks:

1. **No native picker has ever been opened.** `dialog.save` / `dialog.open` are exercised by code review and by the
   grant probe, but no test clicks one. §13's per-platform cancel rows are therefore code-reviewed, not executed.
2. **The cross-device half of the round trip is unrun.** Export → import on a *different* device is the feature's
   actual purpose and nothing has done it.
3. **The user has not hand-tested the built app.** Per the DoD this feature needs that before it counts as done —
   and it is the reason the manifest entry stays `planned`.

### Deferred to a later release (not v1)

- [ ] Merge import (§8) — id remapping, duplicate names, `updatedAt` conflict rules.
- [ ] Web export/import (§7) — needs web audio moved out of localStorage first.
- [ ] Timestamps + tombstones (§4.3) — ✅ **cut from v1** (§0.3 decision 1). Merge and folder/cloud sync both
      need them; adding them to existing user data at that point is the expensive order, so budget for it there.
- [ ] Folder / WebDAV / cloud sync (options A and C in §2), enabled behind the same `ProfileTransport` boundary.

---

## 14. E2E notes

> ⚠️ **This section was rewritten 2026-10-11. The harness was refactored on 2026-10-10/11 and most of the
> previous advice is now wrong** — it described a standalone `e2e/e2e-profiles.mjs` suite and a
> `-Suite profiles` switch. **Neither exists.** Following the old text produces a suite that cannot be wired and
> coverage that is invisible to the gate. What replaced them is below.

### 14.0 The current harness, in one paragraph

Two thin **entrypoints** — `e2e/e2e-full.mjs` (web + Windows) and `e2e/e2e-mobile.mjs` (Android) — over a shared
library `e2e/lib/` (`cdp.mjs`, `report.mjs`, `page.mjs`, `driver.mjs`, `spec-runner.mjs`) and a set of
**shared specs** in `e2e/specs/*.mjs`. A spec in `specs/` is *shared* only if **both** entrypoints import it
**and** pass it to `runSpecs(ctx, …)`; each spec owns its own seed and helpers and is driven through the ctx
object. Anything platform-specific belongs inline in its entrypoint. There are currently **10 shared specs**
(volume, indicators, sliders, soundintogroup, drag, refcount, platform, scroll, playback, reset) and the inline
suites. 38 suites / 318 tests as of 2026-10-11.

### 14.1 What to build: `e2e/specs/profiles.mjs`, not `e2e/e2e-profiles.mjs`

- **File:** `e2e/specs/profiles.mjs`, exporting one async spec function and following the existing pattern
  (see `specs/reset.mjs` for the closest shape: it seeds, reloads, and asserts a merge contract).
- **Wire it into BOTH entrypoints** — import it in `e2e-full.mjs` and `e2e-mobile.mjs` and add it to their
  `runSpecs(ctx, [...])` blocks. ⚠️ **A spec wired into only one entrypoint fails
  `node e2e/check-coverage.mjs` with `SPEC_NOT_SHARED`** — this is enforced, not advisory.
- ⚠️ **There is no `-Suite profiles` switch.** `-Suite` is a `ValidateSet('full','mobile')` in both
  `e2e-full.ps1` and `e2e-android.ps1`; `run` and `features` were retired 2026-10-11. Adding a third value means
  editing two `ValidateSet` declarations and a runner branch — **not worth it for one feature.** Bolt the spec
  into the existing `full` / `mobile` runs.

### 14.2 Register it, or it does not exist

`node e2e/check-coverage.mjs` is a **static** gate (no browser, no CDP) that reads `e2e/coverage.manifest.json`
and the code. Two registries, and this feature touches both:

- **`features`** — the entry already exists: `{"name": "Profile sync and export/import", "status": "planned",
  "coveredBy": []}`. **Flip it to `shipped` and fill `coveredBy`** with `<file>::<key>` refs
  (`specs/profiles.mjs::<key>`). A `shipped` feature with an empty `coveredBy` **fails the gate**; a `planned`
  one that *claims* coverage also fails (it would mean the spec shipped without being updated). 💡 **Register as
  `planned` when you start** — the moment the question "will this be tested?" should be asked.
- **`suites`** — add a block by hand: `key`, `cat` (a **new** category, e.g. `PROFILE` — an unclaimed category
  fails `UNCATEGORISED_SUITE`), `title`, `file`, `export` (the exported symbol name — without it the checker
  cannot verify wiring and fails `NO_EXPORT_NAME`), `covers`, `platforms: ["web","win","android"]`, and
  `idPattern`.
- Then run `node e2e/check-coverage.mjs --update` to generate the `ids` list, and **review the diff**.

### 14.3 Test ids — the previous advice ("continue from `P1`") is taken

`P1`–`P16` are per-sound volume and `P17`–`P34` are priming, both shipped and both registered. Also taken:
`S E A J C K G T D M V L Q U B H X Y W R Z O` and the mobile `N`. **Free prefixes include `F` and `I`** —
verified free on 2026-10-11 — so use something like `F1`, `F2`, … (or `I1`, …). ⚠️ `idPattern` must match the
prefix you choose and must not overlap another suite's; the checker fails an overlap with `AMBIGUOUS_ID`.

### 14.4 Test-mechanics notes that will bite

- **Do not drive the native file dialog.** `DOM.setFileInputFiles` terminates the Android WebView renderer and
  kills the app (the root cause already documented for `e2e-mobile.mjs`). Because §9.3 makes import take bytes
  directly, the spec can call `importBundle` in-page and never touch the picker — which is also the only way to
  test on Android at all.
- **Snapshot protection must cover prefixed keys.** The runner's `e2e/e2e-snapshot.mjs` already dumps *every*
  `localStorage` key by enumerating `localStorage.length`/`key(i)` and restores with a `localStorage.clear()`
  followed by re-`setItem`, so `profile:*` and `spellcaster_profiles` are covered without a code change. ✅
  **Verified 2026-10-11 — this worry from the previous revision is already handled.** Do not "fix" it. (One
  consequence to note: the restore path **clears** storage, so a snapshot taken before profiles exist and
  restored after them would drop the profile keys — in practice not an issue, since both are written by the same
  build.)
- **Two `localStorage` helpers do not survive a reload.** `window.__setInput` is injected by `PAGE_HELPERS` at
  entrypoint start, so a spec that reloads and then calls it gets `undefined`; `evalJs` swallows the exception and
  the assertion fails later with a misleading value. A profile spec **reloads constantly** (that is the point),
  so define its **own** post-reload helpers — as `volume.mjs.__setRange` and `playback.mjs.__pbSetField` do.
- **Seed shape:** `SEED` now lives in `e2e/lib/page.mjs` (exported, shared by both entrypoints) rather than
  inline in `e2e-full.mjs` as the previous revision said. It is probably enough (`Human Paladin` with 3 sounds,
  `Elf Sorcerer`, environment categories, `Tavern Pack`, `Hero Pack`), **but its seeded sounds carry
  `files:[{name, displayName}]` with no `storedName`** — so they classify as *bundled* under §3 and contribute
  nothing to a provenance assertion. A bundle-size test needs an **uploaded** fixture (real bytes through
  `storeFileInLocalStorage`).
- **Do not assert on the seeded `groups[].sounds`.** `normalizeStoredData`'s group branch returns `sounds: []`
  and folds a legacy array into a `Default` category, so that vestigial array is wiped on every read (§13 says the
  same thing for the export test).
- **Suite order:** the shared block in each entrypoint is ordered, and `platform.mjs` (W) leads because every
  other spec seeds and reloads on top of it. A profile spec rewrites the board wholesale, so it belongs **late**
  in the block — but **before `refcount.mjs` (G) and `reset.mjs` (O)**, which re-seed after themselves. `O`
  must stay last of all.
- 💡 **A desktop "NO_CARD"/empty-section failure may be a view problem, not a missing element** — `e2e-full.mjs`
  suites **D** and **M** are not self-contained and read the board earlier suites leave behind.
