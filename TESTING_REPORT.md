# SpellCaster — Edge-to-Edge Testing Report

**Date:** 2026-08-31
**Scope:** `src/App.jsx` (3543 lines, single monolithic component) + Tauri backend
**Target:** Mobile (Android) first; desktop/web preserved per `MOBILE_ONLY_INSTRUCTIONS.md`.

This document catalogs all issues found during a code-level edge-to-edge review, with
the location, root cause, and a concrete fix for each. All fixes must stay gated behind
`isMobile` where noted, and must not break desktop/web behavior.

---

## Severity Legend

| Severity | Meaning |
|----------|---------|
| 🔴 **Critical** | Data loss, crash, or permanent resource leak |
| 🟠 **High** | Functional bug affecting real user flows (audio/nav/forms) |
| 🟡 **Medium** | Correctness/robustness edge cases |
| 🔵 **Low** | Polish, a11y, dead code, minor UX |

**Summary: 5 🔴 · 5 🟠 · 11 🟡 · 7 🔵 = 28 issues**

---

# 🔴 CRITICAL

## 1. Sound form submit can reference a stale file list (index-mismatch risk)

- **Location:** `src/App.jsx:791-806` (`handleSoundFormSubmit`), `1130-1141` (`removeAudioFile`)
- **Issue:** `removeAudioFile(index)` filters BOTH `audioFiles` and `soundFormData.files` by the **same index**. If these two arrays ever diverge in length/order (e.g., an `audioFiles` entry with no matching `soundFormData.files` entry), removing by index removes the wrong file — and on submit (`addSound` at `:808` / `updateSound` at `:844`) the persisted list comes from `soundFormData.files`, which may no longer match what the user sees in `audioFiles`. In the edit flow (`openEditSoundModal` `:735`) both arrays are populated independently, so divergence is the likely case.
- **Root cause:** Two parallel arrays keyed only by positional index with no shared stable key.
- **Fix:** Drive everything from `audioFiles` as the single source of truth. On submit, build the persisted `files` list directly from `audioFiles` instead of `soundFormData.files`:
  ```js
  const handleSoundFormSubmit = (e) => {
      e.preventDefault()
      const hasFiles = audioFiles.length > 0 || soundFormData.file
      if (!soundFormData.name.trim() || !hasFiles) return
      const payload = {
          ...soundFormData,
          files: normalizeStoredFileList(audioFiles.map(f => ({
              name: f.storedName, storedName: f.storedName,
              url: f.url, displayName: f.displayName
          }))),
      }
      editingSound ? updateSound(editingSound.id, payload) : addSound(payload)
      setShowSoundModal(false)
  }
  ```
  Remove the parallel `soundFormData.files` updates from `handleMultipleAudioUpload` (`:1114`) and `removeAudioFile` (`:1135`) so there is exactly one source of truth.

## 2. `addSound`/`updateSound` can silently drop a sound (no `else` fallback)

- **Location:** `src/App.jsx:829-841`, `857-879`
- **Issue:** Both functions branch on `tabType === 'characters' && activeCharacter` vs `tabType === 'environment' && activeEnvironmentCategory`. If neither branch matches (no active character/category, or a split-view state mismatch), the sound is **silently discarded** — and the modal was already closed in `handleSoundFormSubmit` (`:805`), so the user gets no feedback. Data loss with no error.
- **Root cause:** Toggle relies on two conditions that can both be false; no fallback path.
- **Fix:** Resolve the target container into a single explicit value (reuse the split-view active IDs) and add a defensive branch:
  ```js
  if (tabType === 'characters' && activeCharacter) {
      // ... existing character branch
  } else if (tabType === 'environment' && activeEnvironmentCategory) {
      // ... existing environment branch
  } else {
      console.error('addSound: no target container for', newSoundData.name)
      // Optionally surface a UI error instead of silently closing
  }
  ```
  Better: compute `currentActiveCharId`/`currentActiveEnvId` explicitly and use them for the actual insert regardless of `tabType`.

## 3. Deleted characters/categories leave orphaned audio files in storage

- **Location:** `src/App.jsx:1230-1244` (`deleteCharacter`), `1546-1554` (`deleteCategory`)
- **Issue:** When a character/category is deleted, its sounds' audio (and icon) files are not removed from Tauri FS / localStorage. Orphaned files accumulate and are never reclaimed. (The `removeFileFromLocalStorage` helper at `:1579` exists and is used elsewhere — it's simply not called here.)
- **Root cause:** Delete paths stop the sounds but never iterate their file entries to clean storage.
- **Fix:** Before/after removing a character/category, iterate its `sounds` and remove each file:
  ```js
  const deleteCharacter = (characterId) => {
      const character = characters.find(c => c.id === characterId)
      const ids = character?.sounds?.map(s => s.id) || []
      // stop the sounds...
      ;(character?.sounds || []).forEach(s => {
          (s.files || []).forEach(f => removeFileFromLocalStorage(f.storedName || f.name))
          if (s.icon) removeFileFromLocalStorage(s.icon)
      })
      setCharacters(prev => prev.filter(c => c.id !== characterId))
      // ...
  }
  ```
  Same pattern for `deleteCategory`.

## 4. `localStorage` quota exceeded in Promise/effect — silent hang or unhandled throw

- **Location:** `src/App.jsx:1050-1060` (web branch of `storeFileInLocalStorage`), `1278` (`handleBackgroundSettingsChange`), `1821-1828` (auto-save effects)
- **Issue:** The web branch of `storeFileInLocalStorage` uses a `Promise` with **no `reader.onerror` handler**. On a WebKit/Blink quota error, `FileReader.onload` never fires and the Promise never settles — callers `await` it forever. Separately, `handleBackgroundSettingsChange` and the auto-save effects call `localStorage.setItem` without catching `QuotaExceededError` (large base64 images ≈ 6.7 MB easily exceed the ~5 MB limit).
- **Root cause:** Missing error/abort handling on `FileReader`, and no `try/catch` around direct `setItem` calls.
- **Fix:**
  ```js
  return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
          try {
              localStorage.setItem(`sound_file_${fileName}`, e.target.result)
              resolve()
          } catch (err) {
              console.error('Quota exceeded', err)
              reject(err)
          }
      }
      reader.onerror = () => reject(new Error('File read failed'))
      reader.readAsDataURL(file)
  })
  ```
  And wrap all direct `localStorage.setItem` calls (`:1278`, the auto-save effects) in `try/catch` with `console.error` + graceful degradation.

## 5. Blob URL leak in `playSound` (never revoked)

- **Location:** `src/App.jsx:1629`
- **Issue:** When playing a file that is still an in-memory `Blob` (freshly uploaded, or explicitly listed in `files`), `playSound` creates `URL.createObjectURL(fileToPlay.file)`. This URL is **never revoked** — not on sound completion (`cleanupAudio` at `:1650`), not on stop, not on unmount. Repeated playback accumulates `blob:` URLs until the tab/app warns about memory.
- **Root cause:** Blob URLs are a one-shot resource; nothing tracks/revokes them per-`playSound`.
- **Fix:** Store the created URL on the resolved file entry, revoke on cleanup:
  ```js
  } else if (fileToPlay.file && typeof fileToPlay.file === 'object' && fileToPlay.file instanceof Blob) {
      soundUrl = URL.createObjectURL(fileToPlay.file)
      audio._revokeUrl = soundUrl   // attach so cleanup can revoke it
  }
  // inside cleanupAudio():
  if (audioEl._revokeUrl) {
      URL.revokeObjectURL(audioEl._revokeUrl)
      audioEl._revokeUrl = null
  }
  ```
  This guarantees each created URL is revoked exactly once when the instance is cleaned up.

---

# 🟠 HIGH

## 6. Loop audio dips/pops on every loop cycle

- **Location:** `src/App.jsx:1698-1711` (loop `timeupdate` handler) + `applyFadeIn` at `:246-276`
- **Issue:** The manual-loop `timeupdate` handler rewinds and then calls `applyFadeIn` again on every loop iteration. `applyFadeIn` resets volume to 0 and starts a new fade interval, producing an audible volume dip/pop at each loop boundary. A looped ambient sound stutters every cycle.
- **Root cause:** Fade-in is re-applied (and re-zeroed) on every rewind instead of only on the initial play.
- **Fix:** Only apply fade-in on the very first start (guard with a flag), not on subsequent rewinds:
  ```js
  let firstPlay = true
  // in the timeupdate loop handler, on rewind:
  audio.currentTime = targetTime
  if (firstPlay) {
      firstPlay = false
      applyFadeIn(audio, masterVolume, sound.fadeIn)
  }
  ```

## 7. `releasePointerCapture` not wrapped in try-catch

- **Location:** `src/App.jsx:1897`
- **Issue:** `setPointerCapture` (line `1873`) is correctly wrapped in try/catch, but `releasePointerCapture` is not. If the browser already auto-released pointer capture (e.g., after a `lostpointercapture` or multi-touch), calling it again throws an **uncaught exception** that aborts the drag mid-operation.
- **Root cause:** Inconsistent defensive handling between the two calls.
- **Fix:** Wrap the release in try/catch (desktop-only concern; touch drag is mobile):
  ```js
  try { e.target.releasePointerCapture(e.pointerId) } catch (_) {}
  ```

## 8. Drag event listeners can leak on `pointercancel`/out-of-window release

- **Location:** `src/App.jsx:1917-1932`
- **Issue:** `document.addEventListener('pointermove'/'pointerup', ...)` are added on drag start and only removed on `pointerup`. If the pointer is lifted outside the window, `pointercancel` fires, or a long-press context menu interrupts — `pointerup` never fires and the listeners are never cleaned up, leaving a permanent listener leak and a stuck drag state.
- **Root cause:** No `pointercancel`/`blur` cleanup path.
- **Fix:** Also remove the listeners on `pointercancel` and window `blur`, and factor removal into one `endDrag()` helper:
  ```js
  const endDrag = () => {
      document.removeEventListener('pointermove', moveHandler)
      document.removeEventListener('pointerup', upHandler)
      document.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('blur', endDrag)
  }
  document.addEventListener('pointercancel', endDrag)
  window.addEventListener('blur', endDrag)
  ```

## 9. "Add New Sound" inherits stale form fields from a previous edit

- **Location:** `src/App.jsx:715-726` (`openAddSoundModal`)
- **Issue:** The reset object omits `brightness`, `randomPlay`, `glowEnabled`, `glowProminence`, and `color` default handling for glow. If a user previously edited a sound with glow/brightness/random-play enabled and then opens "Add New Sound", the new sound inherits those values — confusing default sound state.
- **Root cause:** Incomplete reset of form state between modes.
- **Fix:** Reset every field used by `addSound`/`updateSound` explicitly:
  ```js
  setSoundFormData({
      name: '', type: '', icon: '', iconDisplayName: '',
      file: '', files: [], color: '#84cc16',
      brightness: 1, duration: 0, fadeIn: 0, fadeOut: 0,
      loop: defaultLoop, randomPlay: false,
      glowEnabled: false, glowProminence: 0.4, glowColor: '#84cc16',
  })
  ```
  (Match the exact field names used in `openEditSoundModal` `:762+` and in `addSound`.)

## 10. `isMobile` resolved in `useEffect` causes a layout flash on Android

- **Location:** `src/App.jsx:334-343`
- **Issue:** `isMobile` is computed in a `useEffect`, so the first render always uses the default `false` (desktop layout). On Android the desktop UI renders briefly before React re-renders with `isMobile = true` — a visible flash on every launch.
- **Root cause:** Platform detection deferred to effect rather than computed synchronously on first render.
- **Fix:** Compute the initial value synchronously (the summary confirms `platform()` from `@tauri-apps/plugin-os` is synchronous and safe to call at module/render time):
  ```js
  const isMobile = (() => {
      try { return platform() === 'android' } catch (_) { return false }
  })()
  ```
  Or combine with a `matchMedia('(pointer: coarse)')` fallback for the web view. Keep it in `useState` initializer pattern so it's stable and doesn't flash.

---

# 🟡 MEDIUM

## 11. `characters.flatMap` can crash on corrupt/missing `sounds` array

- **Location:** `src/App.jsx:486`, `529`, `1850`
- **Issue:** Code uses `characters.flatMap(char => char.sounds)` (and similar) assuming every character has a `sounds` array. Corrupt stored data (or a malformed save) with a missing/`null` `sounds` throws `sounds is not a function` — crashing the effect or the render.
- **Root cause:** No defensive `|| []` normalization at read time.
- **Fix:** Guard all reads: `(char.sounds || [])` and normalize in `safeParse`/`readStoredData` (`:12-46`) so every loaded character/category gets a `sounds: []` default.

## 12. `boxSize` from localStorage can be `NaN`

- **Location:** `src/App.jsx:448`
- **Issue:** `parseFloat(localStorage.getItem('boxSize'))` yields `NaN` on corrupt stored data. `NaN` breaks all `boxSize >= 1.5` comparisons (always false → grid stays 3 columns) and the number input shows "NaN".
- **Root cause:** Stored value not validated/clamped on load.
- **Fix:**
  ```js
  const storedBox = parseFloat(localStorage.getItem('boxSize'))
  const parsedBox = Number.isFinite(storedBox) ? Math.min(2, Math.max(0.5, storedBox)) : 1
  ```

## 13. `generateThemePalette`/color utils produce `#NaNNaNNaN` on invalid input

- **Location:** `src/App.jsx:1286-1367`, `1380` (`applyTheme`)
- **Issue:** Color utilities assume 6-digit hex. A 3-digit hex (`#abc`), empty string, or non-hex produces `parseInt(...,16) = NaN` → malformed `#NaNNaNNaN` applied to CSS variables. Also `applyTheme` uses `theme.primary || theme`; if `theme` is an object without `.primary`, the object is passed to `generateThemePalette` → `.replace` TypeError and crash.
- **Root cause:** No input validation/normalization for theme colors.
- **Fix:** Add a `normalizeHex()` that expands 3-digit hex, pads/rejects invalid input, and returns a safe fallback (`#090d16`). In `applyTheme`, coerce `theme` to a string safely:
  ```js
  const primary = typeof theme?.primary === 'string' ? theme.primary : (typeof theme === 'string' ? theme : '#090d16')
  ```

## 14. Background image `File` object is serialized to `{}`

- **Location:** `src/App.jsx:1467-1475` (`handleImageUpload`)
- **Issue:** `imageFile: file` (a `File` object) is stored and `JSON.stringify`'d → becomes `{}` on reload. Only `imagePreview` (data URL) survives. The `imageFile` field is dead/stale data and can mislead the "Remove Image" logic.
- **Root cause:** Storing a non-serializable `File` reference in persisted settings.
- **Fix:** Don't persist `imageFile` at all — persist only `imagePreview` (data URL) and `type`. Remove `imageFile` from the stored `backgroundSettings` object (or drop it in `readStoredData`).

## 15. `loadIcons`/`processTints` async effects race on unmount / re-run unnecessarily

- **Location:** `src/App.jsx:484-507`, `527-551`
- **Issue:** These async loops `await` `getFileFromLocalStorage`/`recolorImageToColor` and then call `setLoadedIcons`/`setTintedIcons` with no cancellation flag. If state changes mid-loop, stale data overwrites fresh state; on unmount they call setState after unmount. `tintedIcons`/`loadedIcons` are read from a stale closure (not in the dep array), causing redundant re-fetching on every render.
- **Root cause:** Missing cancellation + incomplete dependency arrays in async effects.
- **Fix:** Add a `let cancelled = false` guard cleared in a cleanup return, and include the relevant state in the dependency arrays (or use functional setState to avoid stale reads):
  ```js
  useEffect(() => {
      let cancelled = false
      ;(async () => {
          // ... build results
          if (!cancelled) setLoadedIcons(results)
      })()
      return () => { cancelled = true }
  }, [/** deps */])
  ```

## 16. Mobile icon rail clobbers/ignores the current selection

- **Location:** `src/App.jsx:2565`, `2573`
- **Issue:** Clicking the Characters/Environment rail icon forces `setActiveTab(characters[0]?.id || '')` — resetting the user's current selection to the first item even if they had selected something else. In split view, the rail sets `activeTab` which is ignored (`currentActiveCharId` comes from `activeCharacterId`), so the button highlights but doesn't actually switch the visible pane — misleading UI.
- **Root cause:** Rail buttons unconditionally set the first item rather than preserving selection; split-view IDs are a separate state that the rail never touches.
- **Fix:** On rail click, only switch `tabType` (and toggle split/non-split if needed) without clobbering `activeTab`/`activeCharacterId`:
  ```js
  const switchTab = (type) => {
      setTabType(type)
      // do NOT reset activeTab/activeCharacterId here
  }
  ```
  In split view, update `activeCharacterId`/`activeEnvironmentId` (not `activeTab`) so the rail actually drives the correct pane.

## 17. Mobile drawer: edit toggle stays clickable above the open drawer (z-index)

- **Location:** `src/App.jsx:2598` (`z-[60]`) vs `2617-2619` (overlay `z-40`, panel `z-50`)
- **Issue:** The grid-header edit button is `z-[60]`, above the drawer overlay (`z-40`) and panel (`z-50`). While the drawer is open, the edit button remains clickable underneath — toggling edit mode behind the drawer unexpectedly.
- **Root cause:** Edit button z-index exceeds the drawer stacking context.
- **Fix:** Lower the edit button's z-index below the drawer overlay (e.g., `z-30` or inline as needed relative to the drawer's wrapper), OR hide/`pointer-events:none` the button while the panel is open.

## 18. Desktop volume number input jumps cursor on each keystroke

- **Location:** `src/App.jsx:2391-2403`
- **Issue:** Unlike the mobile input (which has `volumeFocused`/`volumeInput` focus decoupling), the desktop volume input uses `value={Math.round(masterVolume * 100)}` directly. Each keystroke triggers `updateMasterVolume` → re-render → value re-assignment, causing cursor position jumps and making multi-digit entry awkward.
- **Root cause:** Display value bound directly to state without a focus-aware/local editable buffer.
- **Fix:** Mirror the mobile pattern — add `volumeFocused`/`volumeInput` states and use `volumeFocused ? volumeInput : Math.round(masterVolume * 100)` as the value; commit on blur/Enter. (This mirrors the existing `boxSizeInput`/`boxSizeFocused` approach.)

## 19. `audioFiles` list uses `key={index}` — DOM reuse bugs on removal

- **Location:** `src/App.jsx:3002`
- **Issue:** `audioFiles.map((fileObj, index) => <div key={index} ...>)` triggers the React key warning and can reuse the wrong DOM node (stale `<audio>` src) after a file is removed/reordered.
- **Root cause:** Unstable element key.
- **Fix:** Use a stable key from the file entry (safe to use regardless of position):
  ```js
  audioFiles.map(fileObj => (
      <div key={fileObj.storedName || fileObj.name || ...} ...>
  ))
  ```

## 20. `stopAllSounds` is blocked in edit mode, leaving sounds playing

- **Location:** `src/App.jsx:1802`
- **Issue:** `stopAllSounds` returns early `if (editMode)`. If sounds were started before entering edit mode, they continue playing with no way to stop them until edit mode is exited.
- **Root cause:** Over-broad guard.
- **Fix:** Remove the blanket `if (editMode) return` (or limit it so only the *drag/pointer* handlers are blocked, not the stop-all action). Stopping sounds is harmless during editing; the guard was likely intended for drag conflicts only.

## 21. Header name edit on mobile can call `handleEditCategory(undefined)`

- **Location:** `src/App.jsx:2590-2594`, `~2825`
- **Issue:** `activeCharacter ? handleEditCharacter(...) : handleEditCategory(activeEnvironmentCategory?.category)` — if neither `activeCharacter` nor `activeEnvironmentCategory` resolves (rapid tab switch, empty data), `handleEditCategory(undefined)` is called, potentially opening a modal with an undefined name or throwing.
- **Root cause:** Missing guard for the "no active item" edge case.
- **Fix:** Add an early guard before opening either editor:
  ```js
  if (activeCharacter) handleEditCharacter(activeCharacter.id)
  else if (activeEnvironmentCategory?.category) handleEditCategory(activeEnvironmentCategory.category)
  else return
  ```

---

# 🔵 LOW

## 22. No empty state in the sidebar lists

- **Location:** `src/App.jsx:2148-2208`
- **Issue:** When `characters`/`environmentSounds` is empty, the sidebar renders blank with no "add something" hint. A fresh user sees an empty rail with no guidance.
- **Fix:** Render a placeholder row (e.g., "No characters yet — tap to add") when the list is empty.

## 23. Mobile drawer / modals lack `safe-area-inset-bottom`

- **Location:** `src/App.jsx:2621` (drawer), `3304` (Settings), `3486` (About)
- **Issue:** Bottom sheets and the drawer pad the top with safe-area but not the bottom (`env(safe-area-inset-bottom)`). On notched devices with a home indicator, the last nav item / close button can be hidden.
- **Fix:** Add `paddingBottom: 'env(safe-area-inset-bottom)'` (or a Tailwind equivalent) to the drawer scroll container and bottom-sheet modals.

## 24. Mobile drawer missing a11y attributes and focus trap

- **Location:** `src/App.jsx:2615-2718`
- **Issue:** The drawer has no `role="dialog"`, `aria-modal="true"`, `aria-label`, or focus trap. Screen readers can't identify it as a modal, and keyboard focus escapes behind it.
- **Fix:** Add `role="dialog"`, `aria-modal="true"`, an `aria-label`, and manage focus (focus first item on open, trap Tab within the drawer while open).

## 25. Delete-confirm modal doesn't show which item is being deleted

- **Location:** `src/App.jsx:3279`
- **Issue:** The modal text reads `this {deleteType}` without naming the actual sound/character/category, so a user can't confirm they're deleting the right thing.
- **Fix:** Display `itemToDelete` (name/id) in the confirmation text when available.

## 26. About modal hardcodes the version string

- **Location:** `src/App.jsx:3503`
- **Issue:** `Version 0.1.0` is hardcoded and drifts from the real version (currently `0.1.3` in `tauri.conf.json` / `package.json`).
- **Fix:** Read the version from `tauri.conf.json` (via `@tauri-apps/api` at runtime) or `package.json`, or inject via Vite define/environment variable.

## 27. `isSoundPlaying`/`stopSoundInstances` use fragile string-prefix matching

- **Location:** `src/App.jsx:1749-1751`, `1788`
- **Issue:** Instance keys are `soundId_<timestamp>_<random>` and matching uses `key.startsWith(soundId + '_')`. If one sound ID is a string-prefix of another (e.g., `snd_1` vs `snd_12`), the delimiter `_` prevents most collisions, but two generated IDs like `x` and `x_1` would false-match.
- **Root cause:** Prefix-string matching instead of structured key lookup.
- **Fix:** Keep a per-sound reverse index (`soundId -> Set<instanceKey>`) in `audioElementsRef`/a ref, or store the canonical `soundId` on the audio element and match by it rather than prefix-scanning the map keys.

## 28. `src/App.css` is dead code

- **Location:** `src/App.css` (184 lines)
- **Issue:** Vite starter template CSS, never imported (only `index.css` is imported in `src/main.jsx`). Leftover dead code; its `.wheel-*` classes are not used.
- **Fix:** Delete `src/App.css` (and optionally document/implement the unused `.wheel-container`/`.wheel-item` radial layout from `index.css:100-114` if it's a planned feature).

---

# Suggested Fix Order

Prioritize by (a) data-loss/crash risk and (b) mobile-relevance. Apply within `isMobile` gates where the fix is mobile-only; keep desktop/web behavior identical everywhere else.

1. **#2** — `addSound`/`updateSound` silent drop (data loss)
2. **#1** — `handleSoundFormSubmit` file-list divergence (data loss)
3. **#3** — orphaned storage files on delete (storage leak)
4. **#5** — blob URL leak in `playSound` (memory leak)
5. **#4** — `localStorage` quota hang/unhandled throw
6. **#6** — loop audio dip
7. **#7** + **#8** — pointer capture/drag-listener robustness (mobile drag)
8. **#9** — stale "Add New Sound" form state
9. **#10** — `isMobile` layout flash
10. **#11**–**#14** — NaN/corrupt-data guards (crash prevention)
11. **#15**–**#21** — async races + mobile nav/z-index/form edge cases
12. **#22**–**#28** — polish, a11y, dead code
