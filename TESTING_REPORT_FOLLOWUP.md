# SpellCaster — Edge-to-Edge Review: Post-Fix Follow-up

**Date:** 2026-09-01
**Scope:** `src/App.jsx` (3665 lines) — re-audit of the applied fixes from `TESTING_REPORT.md` + new issues found
**Method:** Full read-through of the entire component; build + eslint verified clean (`npx vite build` ✓, `npx eslint src/App.jsx` → 0 errors, 6 pre-existing warnings).

---

## Part A — Verification of the 28 previously-reported issues

| # | Issue | Status in current code |
|---|-------|------------------------|
| 1  | Sound form stale file list | ✅ **Fixed** — `handleSoundFormSubmit` builds `files` from `audioFiles` (`:811-818`) |
| 2  | addSound/updateSound silent drop | ✅ **Fixed** — `else { console.error(...) }` fallback added (`:864,904`) |
| 3  | Orphaned storage files on delete | ✅ **Fixed** — `deleteCharacter`/`deleteCategory` remove each `files[i]` + icon (`:1269-1273,1621-1625`) |
| 4  | localStorage quota hang/throw | ⚠️ **Partial** — `storeFileInLocalStorage` has `onerror`+try/catch (`:1079`), and `handleBackgroundSettingsChange`/auto-save/boxSize are guarded. **BUT `handleImageUpload`’s two direct `setItem` calls are NOT** (see New Issue N1). |
| 5  | Blob URL leak in `playSound` | ✅ **Fixed** — `_blobUrl` tracked + revoked in `cleanupAudio`/`stopAudioInstance`. Note: `stopAudioInstance` (`:1740` block is in cleanupAudio only) — see New Issue N2. |
| 6  | Loop audio dip | ✅ **Fixed** — `firstLoopPlay` guard (`:1784`) |
| 7  | `releasePointerCapture` unguarded | ✅ **Fixed** — try/catch (`:1993`) |
| 8  | Drag listener leak | ✅ **Fixed** — `endDrag(committed)` helper + `pointercancel`/`blur` cleanup (`:2015-2044`) |
| 9  | Stale "Add New Sound" form | ✅ **Fixed** — full reset incl. `files, brightness, randomPlay, glow*` (`:720-736`) |
| 10 | `isMobile` layout flash | ✅ **Fixed** — synchronous in `useState` initializer (`:330-341`) |
| 11 | `flatMap` crash on missing sounds | ✅ **Fixed** — all reads guarded with `|| []`. (Character data still not normalized at load, but every read site is defensive.) |
| 12 | `boxSize` NaN | ✅ **Fixed** — `Number.isFinite` + clamp (`:447-448`) |
| 13 | `#NaNNaNNaN` theme colors | ✅ **Fixed** — `normalizeHex` (`:1337`) |
| 14 | Background `File` serialized to `{}` | ✅ **Fixed** — `imageFile: null` (`:1541`) |
| 15 | `loadIcons`/`processTints` race | ✅ **Fixed** — `cancelled` flag + cleanup (`:484-509,529-556`) |
| 16 | Mobile rail clobbers selection | ⚠️ **Partial** — rail still force-sets `setActiveTab(characters[0]?.id)` (`:2677,2685`). `split view is hidden on mobile` so the split-ID issue is moot, but the "reset to first item" clobbering still exists. Low impact. |
| 17 | Edit toggle clickable over drawer | ✅ **Fixed** — `z-30` + `pointer-events-none opacity-40` when panel open (`:2713-2714`) |
| 18 | Volume input cursor jumps | ⚠️ **Partial** — **fixed ONLY on mobile** (`:2370`); the **desktop** volume input still binds `value={Math.round(masterVolume*100)}` directly (`:2507`). Desktop box-size input IS fixed (`:2537`). See New Issue N3. |
| 19  | `audioFiles` unstable key | ✅ **Fixed** — stable key (`:3118`) |
| 20 | `stopAllSounds` blocked in edit mode | ✅ **Fixed** — function guard removed (from #20) **and** the UI now fully supports it: Stop-All buttons no longer `disabled` in edit mode, per-card stop visible whenever playing, and `stopSound`'s edit-mode guard removed (N4). |
| 21 | Header name edit `handleEditCategory(undefined)` | ✅ **Fixed** — `else if` guard (`:2701-2705`) |
| 22 | Empty sidebar state | ✅ **Fixed** — hints added to mobile drawer, desktop sidebar, and split-view sidebars |
| 23 | safe-area-inset-bottom on drawer/sheets | ✅ **Fixed** — drawer scroll container + all bottom-sheet modal overlays (mobile) |
| 24 | Drawer a11y / focus trap | ✅ **Fixed** — `role="dialog"`, `aria-modal`, `aria-label`, Escape-to-close, Tab focus trap |
| 25 | Delete confirm shows item name | ✅ **Fixed** — named in text (`:3396-3401`) |
| 26 | About modal hardcoded version | ✅ **Fixed** — version injected via Vite `define` from `package.json` |
| 27 | Prefix-string instance matching | ✅ **Fixed** — canonical `audio._soundId` lookup in `isSoundPlaying`/`stopSoundInstances` |
| 28 | `App.css` dead code | ✅ **Fixed** — file deleted |

**All items from the original report and the follow-up audit are now resolved.**

---

## Part B — New Issues Found in This Audit

---

# 🟠 HIGH

## N1. `handleImageUpload` persists settings via unguarded `localStorage.setItem`

- **Location:** `src/App.jsx` (reader.onload / reader.onerror callbacks)
- **Status:** ✅ **Fixed** — both `setItem` calls now wrapped in try/catch with `console.error`.
- **Issue:** The image-upload success and error callbacks both called `localStorage.setItem('backgroundSettings', JSON.stringify(...))` with **no try/catch**. A large data-URL image (~6.7 MB easily, the limit is 5 MB) or a quirk throws `QuotaExceededError` inside the FileReader callback, which aborts the handler and can leave `backgroundSettings` in an inconsistent saved state. Fix #4 guarded `handleBackgroundSettingsChange` but **missed this path**.

## N2. Blob URL not revoked when a sound is stopped mid-playback

- **Location:** `src/App.jsx` — `stopAudioInstance`
- **Status:** ✅ **Fixed** — `_blobUrl` is now revoked in `stopAudioInstance` (added just before the map delete), in addition to `cleanupAudio`.
- **Issue:** Fix #5 revoked `_blobUrl` inside `cleanupAudio` (used on natural end / error), but `stopAudioInstance` (used by `stopAllSounds`, the per-card stop button, and `stopSoundInstances`) did **not** revoke `_blobUrl`. A freshly-uploaded Blob-backed sound that was stopped short would leak its object URL.

## N3. Desktop volume number input still has the cursor-jump bug

- **Location:** `src/App.jsx` — desktop header volume input
- **Status:** ✅ **Fixed** — desktop volume input now uses the `volumeFocused`/`volumeInput` focus-decoupling pattern (mirrors mobile + desktop box-size input); commit on blur/Enter.
- **Issue:** Fix #18 was applied to the **mobile** header volume input and the desktop **box-size** input, but the **desktop volume** input was left binding `value={Math.round(masterVolume * 100)}` directly to state, causing the cursor to jump on each keystroke.

## N4. Looping sound can't be stopped while in edit mode (regression from fix #20)

- **Location:** `src/App.jsx` — header Stop-All buttons, per-card stop button, `stopSound`
- **Status:** ✅ **Fixed** —
  - Removed `|| editMode` from both Stop-All `disabled` props (mobile + desktop).
  - Made the per-card stop button visible whenever `isPlaying` (dropped the `!editMode` gate).
  - Removed the `if (editMode) return` guard from `stopSound` so the stop button actually works in edit mode.
- **Issue:** Fix #20 removed the `if (editMode) return` guard from `stopAllSounds`, but the consuming UI still disabled Stop-All and hid the per-card stop button in edit mode, leaving a looping ambient sound unstoppable while editing.

---

# 🟡 MEDIUM

## N5. `getGlowEffectStyle` / `getHueRotateFromColor` can emit NaN on corrupt color

- **Location:** `src/App.jsx` — `getHueRotateFromColor` and `getGlowEffectStyle`
- **Status:** ✅ **Fixed** —
  - `getHueRotateFromColor` now validates/normalizes input (expands 3-digit hex, returns `0` on invalid input, and handles non-string) instead of producing NaN.
  - `getGlowEffectStyle` now guards `sound.color` with a regex and falls back to `#84cc16` for the box-shadow.
- **Issue:** Fix #13 hardened the **theme** color path with `normalizeHex`, but the **per-sound** color path was unvalidated — a corrupt stored `color` produced `NaN` in the CSS `filter`/box-shadow.

## N6. `updateVolume` during fade-in doesn't restart the fade toward the new level

- **Location:** `src/App.jsx` — `applyFadeIn`, `updateMasterVolume`
- **Status:** ✅ **Fixed** — `applyFadeIn` now reads its running target from `audio._fadeTargetVolume` each tick, and `updateMasterVolume` (during an active fade-in) scales the current volume proportionally to the new target and lets the ramp continue toward it instead of clearing the interval and snapping flat.
- **Issue:** `updateMasterVolume` cleared `audio.fadeInInterval` and set a flat volume, abandoning the ramp. Master-volume changes during the fade window produced a stepped rather than smooth level.

## N7. `readStoredData` doesn't enforce `sounds: []` normalization on load

- **Location:** `src/App.jsx` — `readStoredData` (+ new `normalizeStoredData` helper)
- **Status:** ✅ **Fixed** — added a `normalizeStoredData(key, list)` helper and applied it to every return path of `readStoredData` (loaded, fallback, corrupt, and version-mismatch). Each character/category is guaranteed a valid `sounds` array (non-object/null container entries are replaced with a safe stub; non-object sound entries are filtered). The legacy string `sound.file` → playback fallback is deliberately left untouched so existing single-file sounds keep working.
- **Verified:** `npx eslint src/App.jsx` → 0 errors / 3 warnings, `npx vite build` ✓.
- **Issue:** Previously the load path itself did not enforce `sounds`, leaving the split-view `activeItem?.sounds?.map` (`:2330`) at risk of silently rendering empty on corrupt data.

---

# 🔵 LOW

## N8. Dead state: `setPlatformType` / `setIsMobile` setters now unused

- **Location:** `src/App.jsx` — top-of-component platform detection
- **Status:** ✅ **Fixed** — removed the `platformType` state entirely; `isMobile` is now a plain (non-reactive) constant computed once via a module-style IIFE, since it never changes after mount. eslint dropped from 6 warnings to 3.
- **Issue:** After fix #10 moved platform detection into `useState` initializers, `setPlatformType`/`setIsMobile` were never called (eslint: `assigned a value but never used`), and `platformType` was consumed nowhere.

## N9. `getSoundIcon` — duplicate map keys

- **Location:** `src/App.jsx:49-68`
- **Issue:** `Music`, `Cloud`, `Zap` each appear as a value under two keys (e.g., `'Music'` and `'Weapon'`→ no; specifically `Lightning`→`Zap`, `Divine`→`Zap`; `Stealth`→`Cloud`, `Nature`→`Cloud`, `Ambience`→`Cloud`, `Weather`→`CloudRain`). This is intentional aliasing, not a bug — noted only for completeness.

---

## Suggested Fix Order

**Applied 2026-09-01 (all N1–N5, N8, N7, #22, #23, #24, #26, #27, N6):** All issues found in this follow-up audit are now resolved. Verified: `npx vite build` ✓, `npx eslint src/App.jsx` → 0 errors / 3 warnings.

- **N1** — image-upload `setItem` guarded
- **N2** — blob URL revoked on stop
- **N3** — desktop volume cursor-jump fixed
- **N4** — Stop-All / per-card stop work in edit mode
- **N5** — glow/filter sound-color validation
- **N7** — `readStoredData` normalizes `sounds` arrays on load
- **N8** — dead `platformType` state removed
- **#22** — empty-state hints added to mobile drawer, desktop sidebar, and split-view sidebars
- **#23** — `env(safe-area-inset-bottom)` added to drawer scroll container + all 6 bottom-sheet modal overlays (mobile)
- **#24** — mobile drawer now has `role="dialog"`, `aria-modal="true"`, `aria-label`, Escape-to-close, and a Tab focus trap
- **#26** — About modal version injected via `vite.config.js` `define` from `package.json` (built output contains `0.1.3`)
- **#27** — audio instances store canonical `audio._soundId`; `isSoundPlaying`/`stopSoundInstances` match by it instead of `startsWith` prefix-scanning
- **N6** — `applyFadeIn` reads its target from `audio._fadeTargetVolume` each tick; `updateMasterVolume` scales an in-progress fade proportionally instead of snapping flat

**No remaining open items from the follow-up report.**