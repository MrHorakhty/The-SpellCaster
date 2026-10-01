# Restore Defaults — Spec

> **Status**: ✅ **IMPLEMENTED + VERIFIED (web) 2026-10-01.** Implemented in `src/App.jsx`; verified 34/34 with a purpose-built CDP harness plus 99/99 on the repo web suite. The four open questions in §11 were answered by the user and are now baked in. Not yet exercised on the Android emulator.
> **Created**: 2026-09-28 · **Implemented**: 2026-10-01
> **Related**: `PROFILE_SYNC_SPEC.md` (also parked). `opencode-summary.md` (SESSION 2026-10-01) carries the implementation + verification record.

---

## 1. Goal

Add a **Restore Defaults** button that, when pressed, brings the app's **built-in sounds** back to the shipped defaults — re-adding any default sound that was deleted and reverting any that were edited — **without touching user-created content** (custom categories, characters, groups, uploaded sound files, icons, themes, background settings).

User's words: *"a 'restore defaults' button. Which will only change (or add if they are removed) the default sounds."*

The button is a manual, on-demand, **scoped** reseed — distinct from the automatic `DATA_VERSION` reseed (which wipes everything) see §5.

---

## 2. Key facts that shape the design (verified in code, 2026-09-28)

| Fact | Detail | Consequence |
|---|---|---|
| **Shipped defaults are `src/data.json`** | `characters: [char_1 Elf Sorcerer (s_1..s_4), char_2 Human Paladin (s_5..s_7), char_3 Wood Elf Ranger (s_8..s_11)]`; `environmentSounds: [Background Music (env_1..env_3), Environmental Effects (env_4..env_7)]`; `groups: []` (data.json:1-247) | Defaults are a compile-time import; the button reads them directly |
| **Two different container shapes** | Characters are `{id, name, sounds[]}`; environment entries are `{category, sounds[]}` (no id on the category itself — only `env_N` on sounds) | The merge logic must branch on container kind |
| **State is initialized from localStorage** | `readStoredData('ttrpg_characters', data.characters)`, `('ttrpg_environment', ...)`, `('ttrpg_groups', ...)` (App.jsx:625-635) | Button must change React state, not raw localStorage, so the UI updates |
| **Auto-save is automatic** | Three `useEffect`s persist each array on change: `ttrpg_characters`/`ttrpg_environment`/`ttrpg_groups` (App.jsx:3098-3125) | The handler only sets state; persistence + save-error surfacing is already handled |
| **`DATA_VERSION` gates reads** | `readStoredData` (App.jsx:311) drops + backs up (`${key}_old`) and reseeds any storage whose `ttrpg_data_version !== '3'`; normalize (App.jsx:263) guarantees valid shapes | **Do NOT bump `DATA_VERSION` for this feature** — that would wipe user groups too (§5) |
| **Default-files play with no user data** | Default sounds reference files by filename only; played via `/assets/<name>` (e.g. App.jsx:3283 pattern); the `sound_file_*` localStorage cache (App.jsx:1883) only holds **user-uploaded** data URLs | Restoring defaults never needs user files and never touches the `sound_file_*` cache |
| **Built-in collection icons are separate keys** | `ttrpg_characters_icon` / `ttrpg_environment_icon`, plain strings, written only by the icon editors (App.jsx:994-998) | Out of scope — restore leaves them alone (user choice) |
| **Settings entry points exist on all platforms** | Desktop header gear (App.jsx:4066) and a second gear (~3815, top bar) both open `openSettingsModal` → Settings modal (App.jsx:5397-5570); mobile reaches the same modal via its header | One modal host = one button placement covers web + tauri desktop + Android |
| **No confirm-dialog primitive exists** | Only modal built so far is the Settings modal; no `window.confirm` usage found | Restore is destructive-adjacent → needs a small custom confirm (see §7) |
| **Active-selection effect is lazy** | `if (characters.length > 0 && !activeCharacterId) setActiveCharacterId(...)` (App.jsx:3127-3137) | After restore the handler must explicitly re-point active ids at the restored defaults (§7) |

---

## 3. Behavior contract (the "only default sounds" rule)

The button operates **only** on the two built-in collections. Everything else is untouched: `ttrpg_groups`, uploaded files (`sound_file_*`), collection icons, `backgroundSettings`, themes.

Per collection, the rule is **merge-by-id, default wins for defaults, user content never deleted**:

### 3.1 Characters (`ttrpg_characters`)
1. For each shipped default character (`char_1..char_3`):
   - **Missing** → insert the shipped entry (with its shipped `sounds`) at the end of the characters array.
   - **Present** → replace its `sounds` array with shipped sounds **by sound id**: every shipped sound `s_*` of that character becomes exactly the shipped object (name, type, icon, files, color, duration, loop, fades, glow…); any **user-added** sounds in that character whose id is not a shipped `s_*` id are **kept**, appended after the shipped ones. The character's own `name`/`id` are also reset to shipped values.
   - User-created characters (ids not `char_1/2/3`) are **never** removed or modified.

### 3.2 Environment (`ttrpg_environment`)
1. For each shipped category (`Background Music`, `Environmental Effects`):
   - **Missing** → insert the shipped category (with shipped `env_N` sounds) at the end.
   - **Present** → reset its shipped sounds by id (`env_1..env_7`) to the shipped objects; keep user-added sounds whose id is not a shipped `env_N` id, appended.
   - User-created categories are **never** removed or modified.

### 3.3 Idempotent
Re-running the button is a no-op (nothing changes) once storage is already default. This makes the button safe to press repeatedly.

---

## 4. Approaches considered

| # | Approach | Keeps user content? | Deletes nothing? | Matches user words? | Verdict |
|---|---|---|---|---|---|
| A | **Hard reset** — replace both arrays wholesale with `data.json` | ✗ (custom characters/categories/sounds inside the two collections are lost) | ✗ | ✗ | Rejected — *"only ... the default sounds"* implies non-default sounds survive |
| B | **Merge-by-id** (§3) — restore shipped entries/sounds, preserve everything else | ✓ | ✓ | ✓ | **CHOSEN** |
| C | **Bump `DATA_VERSION`** — reuse existing reseed machinery | ✗ (wipes `ttrpg_groups`, forces `_old` backups) | ✗ | ✗ | Rejected — too blunt; see §5 |

---

## 5. Interaction with `DATA_VERSION` (do not touch it)

`DATA_VERSION = '3'` (App.jsx:257). Bumping it makes `readStoredData` back up + drop **all three** keys and reseed from `data.json` — including wiping user `ttrpg_groups`. That is strictly more destructive than this feature and would defeat the merge requirement.

The button instead writes **new values into existing state**, which the auto-save effects persist to the same keys; `readStoredData` continues to pass them through unchanged (version still `'3'`). Future default changes that ship with a real version bump will still reseed automatically on first launch — the button and the bump are orthogonal.

---

## 6. Data model

No schema changes. Only the two existing keys mutate:

- `ttrpg_characters` → reseeded to defaults-with-user-extras per §3.1
- `ttrpg_environment` → reseeded to defaults-with-user-extras per §3.2

### 6.1 Optional safety backup (recommended)

Before merging, snapshot the current JSON of both keys to:

- `ttrpg_characters_restore_backup`
- `ttrpg_environment_restore_backup`

These are **read-only artifacts for manual recovery** — the app must never read them automatically (note this in a code comment so a future dev doesn't wire them up). This mirrors the existing `${key}_old` convention (App.jsx:316) without overwriting a real migration backup.

---

## 7. Implementation sketch

All in `src/App.jsx`.

### 7.1 Handler (near the other edit handlers, e.g. next to `openSettingsModal`)

```js
const restoreDefaults = () => {
    // 1. (recommended) snapshot backups:
    localStorage.setItem('ttrpg_characters_restore_backup', JSON.stringify(characters))
    localStorage.setItem('ttrpg_environment_restore_backup', JSON.stringify(environmentSounds))

    // 2. Build merged arrays (see §3). Deep-copy data.json entries so React
    //    never mutates the imported defaults.
    const mergedCharacters = mergeById(characters, data.characters, isDefaultChar)
    const mergedEnvironment = mergeById(environmentSounds, data.environmentSounds, isDefaultEnvCategory)

    // 3. Replace state (auto-save effects persist to localStorage):
    setCharacters(mergedCharacters)
    setEnvironmentSounds(mergedEnvironment)

    // 4. Re-point active selections at the restored defaults so the grid
    //    shows defaults immediately (the lazy effect at App.jsx:3127 won't
    //    fire when ids are still set):
    setActiveCharacterId(mergedCharacters[0]?.id ?? '')
    setActiveEnvironmentId(mergedEnvironment[0]?.category ?? '')
}
```

Notes:
- A "default" is identified purely by shipped id/name: chars `char_1..char_3`; env categories `Background Music`/`Environmental Effects`; shipped sound ids `s_*`/`env_*`. Never by position.
- Merge produces: shipped entries in shipped order, then user entries (deterministic, idempotent). Alternative (keep original positions of defaults) is fine too — just decide and test idempotency.
- `data` is already imported from `./data.json` (used at App.jsx:626).

### 7.2 Confirm dialog (recommended)

Small inline confirm inside the **Settings modal** (App.jsx:5397), matching its styling and using the same `setShowSettingsModal(false)` pattern:

- Copy: *"Restore the built-in sounds to their defaults? Your custom groups, characters, uploads and icons stay as they are. This can't be undone automatically."* → Buttons **Cancel** / **Restore defaults**.
- Replaces the current single-purpose "Background Settings" content area (the modal was already reused for the collection-icon editors in the prior session, so it is the established host).
- On web the same modal is reached from the same gear buttons (App.jsx:3815 / 4066) — no per-platform UI fork needed.

### 7.3 Where the button lives

A "Danger zone" section at the **bottom of the Settings modal**, behind the confirm. One implementation serves web, Windows Tauri and Android (the modal is reachable on all three).

---

## 8. Edge cases

| Case | Behavior |
|---|---|
| User deleted **all** defaults | Merge re-adds `char_1..char_3` + both env categories; active ids re-pointed to them by the handler |
| User renamed a default sound or char | Reset to shipped name/metadata (id is the anchor) |
| User added sounds inside a default character/category | Kept, appended after the shipped sounds (§3) |
| User created whole non-default characters/categories | Untouched, panned after defaults (orders preserved within "user" bucket) |
| User removed a single default sound | Re-added in shipped position of that character/category |
| Ids collide (user craftily used `char_1`) | Merged as a "default" — acceptable; ids are the contract |
| `localStorage` write fails (quota) | Existing auto-save effects already route failures through `reportSaveFailure`/`setSaveError` — no new error path needed |
| Mobile (Android) | No DevReach: localStorage is persisted by Tauri's storage DB; nothing extra to do (verified earlier this session for icon-key removals) |

---

## 9. Testing plan

Mirror the established harness patterns (`e2e/e2e-full.ps1`, `%TEMP%\opencode\colicon-*.mjs`, cold-start Android harness):

1. **Web (vite preview :5233 + headless Edge CDP :9333)** — seed a mutated state, click through Settings → Restore defaults → confirm, assert:
   - deleted `s_1` comes back; renamed `Elf Sorcerer` reverts; `char_1`'s user-added sound survives;
   - a custom character + a custom category + custom sounds + `ttrpg_groups` all survive byte-for-byte;
   - env `env_1` restored, custom env category untouched;
   - active character/category immediately = restored defaults;
   - **idempotency**: run again → identical arrays;
   - reload (same page session) → restored state persists.
2. **Android emulator (cold-start harness, `10.0.2.2:5173`)** — same functional spot-checks reachable on mobile; verify persistence across force-stop/relaunch.
3. **Desktop Tauri (WebView2)** — optional; the code path is identical to web (pure React + localStorage). Re-run `e2e-full.ps1` web suite afterwards for regressions (PASS=99 baseline).
4. `npx eslint src/App.jsx`, `git diff --check`.

AGENTS.md backup rule applies **before** implementing (desktop folder copy excluding `node_modules`/`dist`/`.git`/`src-tauri/target`/`src-tauri/gen`).

### 9.1 Results (all three platforms run, 2026-10-02)

| Target | Result |
|---|---|
| Web preview (Edge CDP) | main suite **34/34**, rename-anchor probe **9/9**, corner probe **8/8**, repo suite **99/99** |
| Desktop Tauri / WebView2 | `e2e-full.ps1 -Phase win` **99/99**, exit 0 |
| Android emulator WebView | cold-start harness **13/13** |

Two extra probes beyond the original plan, both of which found real bugs that the main suite missed:

- **rename-anchor probe** — renaming a default environment category used to re-add the shipped category next to the renamed copy, duplicating every default sound. Fixed with a shipped-sound-id fallback anchor.
- **corner probe** — a default sound could still land in two entries (a rename collision onto another default's name). Fixed by filtering "user sounds" against a **collection-wide** set of every shipped sound id.

Android gotcha worth keeping: the WebView commits localStorage asynchronously, so a plain `am force-stop` right after seeding **discards the seed** and the next launch silently re-seeds shipped defaults — which looks exactly like a data bug. The working sequence is `input keyevent KEYCODE_HOME` → ~3s (pause + flush) → `am force-stop` → `monkey` relaunch → re-`adb forward` to the new pid. Also note `readStoredData` wipes a key and re-seeds defaults whenever `ttrpg_data_version !== '3'` (old value kept in `${key}_old`), so a harness seeding data without the version key looks like a bug too.

---

## 10. Out of scope (explicitly)

- Deleting or migrating `ttrpg_groups`.
- Resetting collection **icons**, `backgroundSettings`, themes, volume, fullscreen, or any `sound_file_*` cache.
- A general "factory reset" of the whole app.
- Wiping the `${key}_old` / `*_restore_backup` artifacts.
- Any `DATA_VERSION` change.

---

## 11. Open questions — ANSWERED 2026-10-01 (user)

1. **User-added sounds inside a default character/category → KEEP** (appended after the shipped ones), as drafted in §3. Nothing the user added is ever deleted by this button.
2. **Ordering → shipped defaults first, then user entries** (deterministic, idempotent). Same for the environment category list.
3. **Placement + confirm → Settings modal, behind a confirm**, as drafted in §7.2/§7.3. The confirm renders **stacked above** the still-open Settings modal (so Cancel returns to Settings rather than dumping the user out of it).
4. **Safety backup keys → SKIPPED.** No `ttrpg_*_restore_backup` keys are written; §6.1 is void.

### Deviation from §3 that was RESOLVED during implementation (2026-10-01)

**Names now revert to the shipped values** (as §3.1 originally said) — this was changed after a real bug was found:

- **The bug**: an environment category has **no id** — `updateCategory` (App.jsx:2570-2574) rewrites `entry.category`, so the *name is the only anchor*. A first implementation that anchored on the name produced a **duplicate**: renaming "Background Music" → "Music Box" and pressing Restore Defaults re-added a fresh "Background Music" **and** kept "Music Box", so `env_1` (Forest Ambience) existed twice. The user saw the shipped name reappear and reported it as "it reverts the names" — which is exactly the symptom.
- **The fix**: `mergeShippedDefaults` matches on the key first, then **falls back to a stored entry that still carries one of that default's shipped sound ids**, claiming each stored entry at most once. The matched entry is then reset to the **shipped name** (so a rename is undone, no duplicate) and keeps its user-added sounds.
- **Icons are still preserved** on a matched entry. `data.json` ships no icon for characters/categories, so there is nothing to restore and clearing it would destroy a choice the app cannot recover.
- **A "user sound" is only a sound that belongs to no default at all.** A sound that belongs to a *different* default is not user content: it is filtered out by a collection-wide set of every shipped sound id. Without this, renaming a default category onto another default's name (e.g. "Environmental Effects" → "Background Music") let `env_4` (Rain) be kept *and* restored in its own home, duplicating it across both categories. Consequence, accepted: if a user deliberately moved a default sound into a different default, restore puts it back in its shipped home rather than keeping the copy.

Also changed from the original sketch: the active selection is **repaired, not reset** (`setActiveCharacterId(prev => stillExists ? prev : first)`), so a still-valid selection is kept while one deleted earlier is fixed.
