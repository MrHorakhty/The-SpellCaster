# Move / Copy Sound — Planning Spec

> **Status**: **Implemented 2026-10-04** (App.jsx: `transferSound`, `findSoundContainer`, `mintId`, per-card
> "Move or Copy Sound" button with picker modal). Do not change behaviour unless the user asks.
> **Created**: 2026-10-04
> **Related**: `src/App.jsx`, `moveSound()` (App.jsx:1707-1765), the drag-reorder path in `renderSoundCard`
> (App.jsx:3235-3268), `e2e/e2e-full.mjs`

---

## 1. Goal

In **edit mode**, let the user **move** or **copy** a sound from its current container into any other
container — between characters, between environment categories, and into or out of groups (both
`characters`-mode and `environment`-mode groups).

Today a sound can only be reordered *within* the container it already sits in (`moveSound`, App.jsx:1707).
Moving a sound to a different character, a different category, or a group means re-uploading the audio and
re-entering every playback setting (loop, fade in/out, color, brightness, glow, random-play). For a GM
assembling a library that is the single most tedious thing in the app.

**v1 scope**: entry from a per-card button, a modal target picker, move + copy, desktop/web + Android.
No cross-container drag-and-drop (§11 Deferred), no create-container-from-picker. A reference-count guard on
file deletion (§7) ships as a **separate follow-up commit**.

---

## 2. Decisions cemented 2026-10-04

These eight were put to the user and answered. They are **settled** — do not re-litigate during implementation
without asking.

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | On **copy**, does the copy share the source's audio file or get its own bytes? | **Share the file reference** | Free, instant, no async write, no localStorage quota risk. Accepted consequence in §7, fixed by the guard in §10 step 5. The alternative (duplicate bytes) was rejected as quota-heavy on web. |
| 2 | How is the feature triggered? | **Third button on the sound card** in edit mode | Matches the existing overlay-button idiom (App.jsx:3431-3448) exactly, and is directly addressable by CDP via a stable `title`. A context menu would need net-new portal/outside-click/z-index infrastructure; a fourth button in the card corners does not fit. |
| 3 | Does a **move** ask for confirmation? | **No confirm, silent success** | Consistent with every existing mutation (delete sound, rename, drag-reorder all complete silently). Copy is non-destructive anyway. **Deleting a sound, by contrast, must confirm 100% of the time** — see §6.5. |
| 4 | Where does the sound land in the destination? | **Append at the end** | Simplest, and the user can drag to reorder afterwards using the existing same-container drag. |
| 5 | How is the shared-file deletion hazard (§7) handled? | **Reference-count guard as a separate follow-up commit** | The guard can only ever *prevent* a delete, so it fails safe — worst case an orphaned file, never silent audio loss (§7). It touches 6 destructive call sites, so it ships as its own commit with its own E2E rather than blocking the feature. |
| 6 | How does a cross-slice move survive a partial write? | **Simple: one handler, rely on the existing `saveError` banner** | Effect order, not setter order, controls disk writes (§5.4), so a two-phase move would be the only way to get a real guarantee — and a move is **net-zero bytes**, so it can rarely *cause* a quota breach, only trip over one that was already full and already reported. Not worth a state pair, a ref and a tick of latency. |
| 7 | How does a target row offer Move vs Copy? | **Two buttons per row** — filled `Move` + outlined `Copy` | No mode state, so the destructive action can never be chosen by accident; "Move" requires a deliberate click on the word. Also cheaper to test — two stable `title=` selectors instead of mode state. Rejected the `IconPicker`-style segmented control (App.jsx:156-171) for exactly that safety reason. |
| 8 | What is a copied sound named? | **Auto-suffix `Name (copy)`**, then `Name (copy 2)`, … | Cards are identified by name + icon; two indistinguishable cards is a real usability bug the user may not notice when editing. Rename is one tap away via the existing Edit button if they want the original back. Moves are unaffected. |

---

## 3. Key facts that shape the design

All verified in the current code (`src/App.jsx`, 5751 lines):

| Fact | Detail | Consequence |
|---|---|---|
| A sound lives in **exactly one container, in one of four *populated* shapes** | the four branches of `moveSound`: `characters[].sounds` / `environmentSounds[].sounds` / `groups[].categories[].sounds` / `groups[].characters[].sounds` (App.jsx:1724-1764) | The container reference in §4 covers every shape a sound can actually reach today. |
| ⚠️ …but a **fifth shape is allocated and never used** | `addGroup` creates every group with a top-level `sounds: []` (App.jsx:2721-2729). **No** branch of `addSound` (:1492-1532), `moveSound` (:1724-1764), `updateSound` or `deleteSound` ever pushes into it. Only two sites read it defensively: `deleteGroup`'s file cleanup (:2742) and the delete-confirm name lookup (:5441) | Do **not** claim the four shapes are exhaustive — they aren't. `findSoundContainer` (§5.1) and the §7 guard must still walk it, or they are provably incomplete against a shape the codebase itself creates. It is always empty today, so walking it costs one line and cannot change behaviour. |
| `moveSound` **only reorders within one array** | its local `reorder()` (App.jsx:1712-1722) splices inside a single `list`; there is no remove-from-source / insert-into-target path anywhere in the file | Cross-container transfer is **new logic**, not an extension of `moveSound`. Leave `moveSound` untouched. |
| **Categories have no id** — identity is the display name | `cat.category === containerId` (App.jsx:1737); `activeGroupCategory` / `activeEnvironmentCategory` are name strings (App.jsx:3197-3199); a rename rewrites `cat.category` in place (App.jsx:2802-2814) | The picker **must** key on names, like everything else. Do **not** invent category ids in this feature. |
| **Sound ids are app-unique** | `sound_${Date.now()}_${rand}` (App.jsx:1472); the delete-confirm resolves a display name by flattening all containers (App.jsx:5431-5441) | A sound can be located by id alone, which is what makes the resolver in §5.1 possible. |
| **Audio bytes are keyed by filename, not sound id** | `toStoredFileName('sound', …)` (App.jsx:1843) mints `sound_<rand>_<safeName>`; bytes live at `uploads/<storedName>` under `BaseDirectory.AppData` on Tauri (`TAURI_STORAGE_DIR`, App.jsx:21; write at App.jsx:1906-1930) or at `localStorage['sound_file_<storedName>']` on web (App.jsx:1937). The sound object holds **only a reference** in `files[].storedName` | **The whole design risk.** See §7. |
| **Two sound-file shapes coexist** | `files: [{…}]` plus a legacy `file: "Name.mp3"`; `playSound` falls back to `sound.file` when `files` is empty (App.jsx:2856-2868) | A copy must preserve **both** fields verbatim. Never rebuild `files` from scratch. |
| **`deleteSound` does not delete files** | App.jsx:1767-1810 only filters the sound out of state | The hazard in §7 is about **container** deletion, not sound deletion. |
| **Container deletion removes files unconditionally** | character App.jsx:2194-2195, category App.jsx:2628-2629, group App.jsx:2744-2745 & 2763-2764, each calling `removeFileFromLocalStorage` (App.jsx:2828) per referenced file | → §7. |
| **The persisted shape does not change** | `DATA_VERSION = '3'` (App.jsx:257); keys `ttrpg_characters` / `ttrpg_environment` / `ttrpg_groups` | **Do not bump `DATA_VERSION`** — the mismatch path (App.jsx:313-319) renames the user's keys to `*_old` and resets to defaults. |
| The env data key is **singular** | `ttrpg_environment`, not `ttrpg_environments` (App.jsx:3176) | A latent bug that has fooled test harnesses before. Be careful in new code and in tests. |
| **Three independent auto-save effects**, one per top-level slice | App.jsx:3164-3191 | There is **no single write choke point**. A cross-slice transfer writes two keys and is **not atomic**. → §5.3. |
| `moveSound` falls back to the *active* group | `groupId \|\| activeGroup?.id` (App.jsx:1731, 1745) | The new code must **require** an explicit `groupId`. A cross-container operation cannot depend on which tab happens to be active. |
| The card knows its own container, the app knows the rest | `renderSoundCard(sound, containerType, containerId, splitTarget)` (App.jsx:3216) | The button can capture its own container as the **source**; only the destination needs resolving. |
| Card hit-testing only sees **rendered** cards | `document.querySelectorAll('[data-sound-card]')` + `getBoundingClientRect()` (App.jsx:3270-3275) | A sound in another container is never in the DOM, which is why cross-container **drag** is not in v1 (§11 Deferred). |
| Sound cards are `div role="button"`, not `button` | App.jsx:3228-3234 | E2E must query `[data-sound-card]`, never `button`. |
| There is **no unit-test tier** | `package.json` has no test script; coverage is CDP E2E only | Verification is §11 + §12. |

---

## 4. Container reference model

Do **not** introduce a new type. Reuse the 4-tuple that `dragRef.current` already carries today
(App.jsx:3243-3251), so the drag path and the menu path can share one resolver:

```js
// { containerType, containerId, groupId }
//   containerType: 'character' | 'environment' | 'group' | 'groupCharacter'
//   containerId:   character.id          | category (NAME string)
//                  cat.id                | ch.id
//   groupId:       null for character/environment, else the owning group's id
```

`groupId` is **required** (never defaulted) for `'group'` and `'groupCharacter'`, unlike `moveSound` (§3).

**Target list construction** — flatten every container into rows, keeping the section each row belongs to so
duplicate category names stay distinguishable:

| Section | Rows | Key |
|---|---|---|
| Characters | `characters` | `character.id`, label `character.name` |
| `<group name>` (mode `environment`) | that group's `categories` | `group.id` + `cat.category` |
| `<group name>` (mode `characters`) | that group's `characters` | `group.id` + `ch.id` |
| Environments | `environmentSounds` | `cat.category`, label `cat.category` |

Order the sections: Characters → groups in their existing sidebar order → Environments. Mirrors the sidebar
(`renderPanelSection`, App.jsx:3454) so the picker reads like the app.

---

## 5. Data model

No persisted-shape change. Three new pieces of logic, all in `src/App.jsx`.

### 5.1 `findSoundContainer(soundId)` — locate a sound

Returns `{ containerType, containerId, groupId, index, sound }`, or `null`.

Walks `characters` → `environmentSounds` → `groups[].categories` → `groups[].characters` → **`groups[].sounds`**
(the vestigial fifth shape, §3), returning on the first hit. Sound ids are app-unique (§3), so **first hit wins**
and no ambiguity handling is needed.

Walking the vestigial shape changes nothing today (it is always empty) but keeps the walker **total** — it cannot
silently miss a container if someone later populates it.

Reuse it for the **delete-confirm name lookup** (App.jsx:5441) if that proves cheaper than the existing nested
ternary — note that lookup *already* walks `g.sounds`, so it is the one place in the codebase that has not
forgotten the fifth shape. That refactor is optional clean-up, not part of v1, and **must keep walking all
five**.

### 5.2 `transferSound(soundId, targetRef, mode)` — `mode: 'move' | 'copy'`

Placed next to `moveSound` (App.jsx:1707). Steps:

1. `const source = findSoundContainer(soundId)`; bail if `null`, or if `mode === 'move'` and the target
   resolves to the same container.
2. Build the payload.
   - **move** → the *same object reference* (`source.sound`). Nothing about the sound changes; only its
     location does. Per decision #1 (§2) the audio reference comes along untouched.
   - **copy** → `{ ...source.sound, id: newSoundId(), name: nextCopyName(source.sound.name) }`.
     A reused id would give two cards the same `data-sound-id` and break every E2E assertion that keys off
     it. The name is handled by §5.3.
3. `insertInto(targetRef, sound)` — append to the end of the target's `sounds` array (App.jsx:1492-1532 is
   the existing append logic for all four shapes; mirror its branch structure).
4. `mode === 'move'` only → `removeFrom(source, soundId)`, scoped to the **single** source container.

⚠️ **Do not** implement step 4 by copying the global-sweep style of `deleteSound` (App.jsx:1774-1809), which
filters the id out of *every* character / category / group. That is correct for delete (the id is unique) but
wrong here — it would also strip a same-id sound from unrelated containers if a collision ever appeared.
Scope the removal to `source.containerType` / `source.containerId` / `source.groupId`.

Steps 3 and 4 must both use **functional** updaters (`prev => …`) so React applies them deterministically.

Extract the id minting from `addSound` (App.jsx:1472) into `newSoundId()` so sound, character, group and
group-item ids all come from one place. Same shape: `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`.

### 5.3 `nextCopyName(name)` — copy naming (decision #8 (§2))

`Name` → `Name (copy)` → `Name (copy 2)` → `Name (copy 3)`, picking the first suffix not already used **in the
destination container**. Applies to copies only; a move never renames.

Scope the uniqueness check to the destination container, not the whole app: the same sound name legitimately
exists in several characters already (that is the point of copying it), and a global check would walk to
`Name (copy 97)` on a well-used board.

### 5.4 Persistence is not atomic — and setter order does not help

Three independent auto-save effects exist (App.jsx:3164-3191, App.jsx:3174, App.jsx:3184), one per top-level
slice. A cross-slice move therefore performs **two `localStorage.setItem` calls that cannot both succeed or
both fail**, and there is no transaction around them.

**React flushes passive effects in hook declaration order, not setter-call order.** So:

| Move | Persisted first | Persisted second |
|---|---|---|
| character → group | `ttrpg_characters` (**the removal**) | `ttrpg_groups` |
| group → environment category | `ttrpg_groups` (**the removal**) | `ttrpg_environment` |
| character → environment category | `ttrpg_characters` (**the removal**) | `ttrpg_environment` |

In every cross-slice case the **removal lands first**. Calling the append before the removal in the handler
does not change this and must not be relied on.

**The accepted guarantee (decision #6):** best-effort, surfaced, not atomic. Do not build a two-phase move
— see decision #6 for why the cost is not justified. Severity is bounded by two facts:

- A **move is net-zero bytes** and a **copy adds metadata only** (audio is shared, decision #1), so move/copy is
  rarely the operation that *causes* a quota breach. It can only trip over a quota that was already full.
- When a write does fail, `reportSaveFailure` (App.jsx:3158) already raises the `role="alert"` banner
  (App.jsx:3843-3860) with quota-specific advice from `describeSaveFailure` (App.jsx:245-254). The user is
  told their save failed.

True atomicity needs a unified storage slice — i.e. the `PROFILE_SYNC_SPEC.md` refactor, which is **parked**.
If it ever happens, revisit this section.

---

## 6. UI

### 6.1 Entry point — third overlay button

Add to the edit-mode fragment in `renderSoundCard` (App.jsx:3431-3448). The class string is copied verbatim
from its two siblings, including the `isMobile` ternary — desktop hover-revealed, mobile always-visible with a
26×26 hit target:

```jsx
className={`absolute bottom-1 left-1/2 -translate-x-1/2 p-0.5 rounded-full bg-purple-600 text-white
  hover:bg-purple-700 transition-colors z-10 ${isMobile
    ? 'min-h-[26px] min-w-[26px] flex items-center justify-center opacity-100'
    : 'opacity-0 group-hover:opacity-100'}`}
```

Placement is **bottom-centre** because both top corners are taken (delete at `top-1 left-1`, edit at
`top-1 right-1`). Anchor it to the wrapper div (App.jsx:3223-3227), not the card, so it does not inherit the
card's `pointerdown` drag handler (App.jsx:3235).

`title="Move or Copy Sound"` — stable, and what §12 asserts on.

**Icon**: must be added to the import block at App.jsx:3-14. That block carries an explicit warning (App.jsx:7-8)
that every name is verified against the installed `lucide-react`, because a missing name breaks the build.
Candidates not currently imported: `ArrowRightLeft`, `FolderInput`, `Copy`, `MoreHorizontal`. Verify before
adding. Keep it out of `ICON_MAP` (App.jsx:12) — that is the icon-*picker* catalogue, not UI chrome.

### 6.2 Target picker modal

New modal, hand-rolled like every other one (there is no `Modal` component; the shell one-liner at
App.jsx:4909 is repeated verbatim at 5233, 5297, 5361, 5425, 5465, 5663, 5693):

- Shell copied from the sound modal (App.jsx:4909-4923), including
  `style={{ paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined }}` and
  `max-h-[90vh] overflow-y-auto ${isMobile ? 'min-h-[80vh]' : ''}`.
- Body: the §4 section list inside `max-h-[35vh] overflow-y-auto`, the same scroll idiom `IconPicker` uses
  (App.jsx:172).
- Section headers: `px-3 py-2 text-xs font-semibold uppercase text-slate-400`.
- Each row shows the destination name plus, where a name could be ambiguous, the section it lives in (§8).
- **Two buttons per row** (decision #7 (§2)): filled `Move` and outlined `Copy`.
  - `Move` → `px-3 py-1 rounded-lg bg-lime-600 text-white hover:bg-lime-700` (matches the active-state
    treatment at App.jsx:156-171).
  - `Copy` → `px-3 py-1 rounded-lg bg-dark-700 text-slate-200 hover:bg-dark-600 border border-dark-600`.
  - Distinct stable titles: `title="Move to <name>"` / `title="Copy to <name>"` so E2E can target one action
    on one specific row unambiguously.
  - ⚠️ The `Move` button **stops propagation**. The row is not itself clickable, but the card it belongs to
    is inside a drag-enabled subtree in edit mode (App.jsx:3235-3268) — verify no pointerdown reaches a card
    handler from the picker (the picker is a sibling overlay at `z-50`, so this should hold).
- Close via the `X` button and Esc, matching the other form modals.

**Modal state** — add alongside the existing block (App.jsx:954-1014):

```js
const [showMoveCopyModal, setShowMoveCopyModal] = useState(false)
const [moveCopySoundId, setMoveCopySoundId] = useState(null)
const [moveCopySource, setMoveCopySource] = useState(null)   // the container ref from §4
```

⚠️ The focus-trap effect at **App.jsx:996** tests `!showSoundModal && !showCharacterModal && !showCategoryModal`
explicitly. **Add `!showMoveCopyModal`** to it, or the new modal will not participate in the trap and Esc/close
behaviour will differ from every other dialog.

### 6.3 Source vs destination

- **move** → the sound's current container is **not listed**. Moving a sound into itself is a no-op at best.
- **copy** → the current container **is** listed and allowed, labelled `(duplicate here)`. Same-container
  duplication is harmless under decision #1 (§2) (`deleteSound` does not remove files, App.jsx:1767) and it is the natural
  way to get the same audio with a different colour, fade or icon. The §5.3 suffix keeps the two cards
  distinguishable.

### 6.4 Feedback

There is no toast system, and **do not introduce one**. Match the three existing channels:

| Situation | Mechanism |
|---|---|
| Success | **Silent.** Consistent with delete, rename and drag-reorder. |
| Invalid (sound vanished, target gone) | `alert()` — the established validation channel (App.jsx:2085, 2482) |
| Persist failed | `reportSaveFailure(scope, err)` (App.jsx:3158) → the `role="alert"` banner (App.jsx:3843-3860), whose text comes from `describeSaveFailure` (App.jsx:245-254) and already special-cases quota errors. This is also the whole of the §5.4 guarantee — there is no second safety net. |

**No warning about file sharing at copy time.** The hazard in §7 only materialises on *container deletion*,
which is already a confirm-dialog moment (`Confirm Delete`, App.jsx:5424-5461) — that is the right place for
any message, not the copy dialog. And once the §7 follow-up guard lands, the hazard is gone and any such
warning becomes unnecessary. A warning shown at copy time would simply train users to dismiss it while the
actual risk is three clicks away.

### 6.5 Deleting a sound must always confirm — invariant

**Requirement, restated by the user 2026-10-04: deleting a sound shows a confirmation dialog 100% of the
time. No exceptions, no bypass path, no "hold to delete".**

**This already holds today — do not regress it, and do not add a path around it.** Verified:

| Fact | Detail |
|---|---|
| The card's delete button opens the dialog, not the delete | `onClick={() => handleDeleteSound(sound.id)}` (App.jsx:3434) → `handleDeleteSound` sets `deleteType = 'sound'` + `showDeleteConfirm` (App.jsx:1812-1816) |
| `deleteSound` has exactly **one** call site | `confirmDelete` (App.jsx:1824) — reachable only from the dialog's red **Delete** button (App.jsx:5451-5456) |
| The dialog names the sound | App.jsx:5441 flattens all five shapes to resolve `name`, with `\|\| itemToDelete` as fallback |
| Cascading deletes also confirm | deleting a character / category / group goes through the same dialog via `deleteType` App.jsx:2184, 2619, 2735, 3579 |

⚠️ **The one thing this feature could break:** `transferSound`'s `removeFrom` (§5.2, step 4) removes
a sound from a container **without** a confirm. That is correct — it is the source half of a move, which decision #3 (§2)
says is silent — but it means the codebase will contain an unconfirmed sound-removal function. **Do not reuse
`removeFrom` for real deletes**, and do not refactor `deleteSound` to share it. If the two ever get merged, the
delete confirm silently stops firing. Add a comment at `removeFrom` saying so.

💡 Secondary benefit of decision #8 (§2) (auto-suffix): the delete-confirm dialog *names* the sound
(App.jsx:5441), so two cards both called `Fireball` would make the dialog ambiguous about which one is being
deleted. `Fireball (copy)` disambiguates it. Worth remembering before anyone proposes dropping the suffix.

### 6.6 Mobile

Both branches of the ternary are mandatory — the governing rule is that desktop/web stay untouched.
The button lives in the shared `renderSoundCard` (App.jsx:3216), so it appears in the single view, **both**
split panels and the drawer for free; that is why it must be added there rather than to a view. The picker
must scroll inside `min-h-[80vh]` on mobile, and each row needs a ≥26px hit target.

---

## 7. Accepted consequence: shared audio files

**This is the known cost of decision #1 (§2) and must not be quietly dropped.**

Under *copy shares the file reference*, two sound objects can name the same `storedName`. Today no two ever
do — `toStoredFileName` mints a fresh name per upload (App.jsx:1843) — so this situation is **new**.

Consequence: `removeFileFromLocalStorage` (App.jsx:2828) is called **unconditionally, per referenced file**
when a whole container is deleted:

| Deleting | Cleanup call sites |
|---|---|
| a character | App.jsx:2194-2195 |
| a group character | App.jsx:2216-2217 |
| an environment category | App.jsx:2628-2629 |
| a group / group category / group character | App.jsx:2744-2745, 2763-2764 |
| sound-modal audio removal | App.jsx:2031, 2036 |
| sound-modal icon removal | App.jsx:2045 |

So **deleting the container that holds the original will silently break the copy's audio** — the card stays,
the play button stops producing sound, and nothing warns the user. Deleting the *sound* is safe
(`deleteSound` does not remove files, App.jsx:1767). Removing a file from the sound modal is also unsafe
(App.jsx:2031, 2036).

Accepted because: copies are for reusing a sound, not for archiving one; the storage and quota cost of
duplicating bytes is real; and the fix belongs to container deletion, not to this feature.

**Committed follow-up (decision #5 (§2)) — a reference-count guard, as its own commit immediately after the
feature.** It is step 5 of §10, not an optional extra:

- New helper `isFileReferencedElsewhere(storedName, excludeRef)` scanning **all five** container shapes (§3 —
  including the vestigial `groups[].sounds`, which `deleteGroup` already walks at App.jsx:2742), returning
  whether any sound **other than** `excludeRef` still names that file. It must cover `sound.icon` as well as
  `files[]` — a copied custom icon dies by the identical mechanism.
- Guard every destructive cleanup site: character App.jsx:2194-2195, group character App.jsx:2216-2217,
  category App.jsx:2628-2629, group App.jsx:2744-2745 and 2763-2764, plus the sound-modal file removals
  App.jsx:2031, 2036 and icon removal App.jsx:2045.
  `excludeRef` is the container being deleted, so a file used only by that container is still removed.
- **It fails safe, which is the whole argument for doing it.** The guard can only ever *prevent* a delete, so
  the worst outcome is an orphaned file on disk — wasted bytes, recoverable — rather than silent audio loss.
- It is independently valuable: it also fixes the sound-modal removal path and any future file sharing.
- It gets its own commit and its own E2E case precisely *because* it touches eight destructive call sites and
  should not be able to block or destabilise the feature.

---

## 8. Edge cases

| Case | Handling |
|---|---|
| Destination container is empty (0 sounds) | Still listed. Appending creates its first sound. |
| Group in `characters` mode has no `categories`, and vice versa | List only the array that exists; never render an empty section header. |
| Two categories in different groups share a name | Keys collide (categories are name-keyed, §3). The row **must** show its section/group name so the two are distinguishable. This is a display fix, not a key fix — do not invent ids. |
| Legacy sound with only `file: "Name.mp3"`, no `files[]` | Copies verbatim. `playSound`'s fallback (App.jsx:2856-2868) already handles it; do not "normalise" it into `files[]` during a copy. |
| Sound is in a **split panel** | The card's own `containerType` / `containerId` / `splitTarget.groupId` is the source — never `splitSoundTarget` or `activeGroup`. This is what makes move/copy work from both split panels. |
| Move target is the current container | Row not rendered (§6.3). |
| Copy target is the current container | Allowed, marked `(duplicate here)` (§6.3). |
| Same sound id somehow present in two containers | `findSoundContainer` returns the first; the §5.2 warning forbids a global sweep, so the second is left alone rather than silently deleted. |
| Very many containers | The `max-h-[35vh]` scroll region handles it. No search field in v1 — a searchable combobox would be the first of its kind in this codebase. |
| Persist quota failure mid-move | Append-then-remove ordering (§5.3) means a duplicate, not a loss. Surface via `reportSaveFailure`. |
| `editMode` off | Button is inside the `editMode` fragment, so it does not exist. Playback is unaffected. |

---

## 9. Risks

1. **Shared audio deleted with its container** (§7) — the only user-visible data-loss path. Fixed by the
   committed §10-step-5 guard. **Between the feature commit and the guard commit the hazard is live**; they
   should land back to back in the same session. If the guard is dropped, this must stay recorded in
   `PROJECT_STATE.md`.
2. **Cross-slice persistence is not atomic and cannot be made so here** (§5.4) — the removal persists first
   because of effect order. Bounded by net-zero bytes plus the existing banner; a true fix needs the parked
   `PROFILE_SYNC_SPEC.md` storage refactor.
3. **Accidental global sweep** if the removal is modelled on `deleteSound` (App.jsx:1774-1809) — loses sounds
   in unrelated containers. Guarded by the §5.2 warning.
4. **A wrong `lucide-react` icon name breaks the build** (App.jsx:7-8) — verify against the installed version
   before adding (§6.1).
5. **Category-name keys make duplicate targets ambiguous** (§8) — mitigated by showing the section name;
   do not "fix" it by adding ids in this feature.
6. **`nextCopyName` scope creep** — if the uniqueness check is written against the whole app instead of the
   destination container, a well-used board produces names like `Fireball (copy 97)`. §5.3.
7. **Assuming the four container shapes are exhaustive** (§3) — a fifth, `groups[].sounds`, is allocated by
   `addGroup` (App.jsx:2726) and read defensively at App.jsx:2742 and 5441. Any walker that skips it is
   incomplete against a shape the codebase itself creates, even though it is empty today.
8. **Merging `removeFrom` into `deleteSound`** would silently disable the delete confirmation (§6.5). The two
   functions look alike and must stay separate.
9. **Monolith growth.** `src/App.jsx` is already 5751 lines. Do **not** start extracting `src/components/`
   for this one dialog — the repo is monolithic by convention and a single extraction is the odd move. If a
   refactor happens, it happens on its own.

---

## 10. Implementation order

Steps 1-4 are the feature; step 5 is the committed follow-up (decision #5 (§2)). **Land them back to back in one
session** — between step 4 and step 5 the §7 data-loss path is live.

1. **`newSoundId()`** extraction from `addSound` (App.jsx:1472) — alone, no behaviour change.
2. **`findSoundContainer(soundId)`** (§5.1) — pure read, no UI. Verify against existing sounds first.
3. **`transferSound(soundId, targetRef, mode)`** (§5.2) + **`nextCopyName`** (§5.3) — functional updaters
   throughout (§5.4).
4. **UI** — the button (§6.1), then the picker modal with two-button rows (§6.2), then the focus-trap fix
   (§6.2 ⚠️). E2E (§12) for steps 1-4 before calling the feature done.
5. **Reference-count guard** (§7) — `isFileReferencedElsewhere` + the six cleanup call sites, as its **own
   commit with its own E2E case**.
6. **Docs** — update `PROJECT_STATE.md` and the README if the feature is user-facing enough to document.

💡 **If the guard has not landed yet when step 4 is done, land it before anything else.** It is a pure no-op on
current data (no two sounds share a `storedName` today, §7), so it carries near-zero regression risk, and
shipping it *before* the feature would mean the data-loss window never opens at all. Order 4 → 5 is a
sequencing preference, not a technical requirement.

Steps 1-2 are independent of the UI and can land whenever; do not interleave them with step 4.

---

## 11. Verification checklist

- [ ] Move a sound from one character to another: source `sounds` length −1, target +1, the card count on
      screen is unchanged, and all playback settings (loop, fade in/out, color, brightness, glow,
      random-play, icon, `iconDisplayName`) survive.
- [ ] Move into a group category, into a group character, out of a group into a default environment
      category, and out of a default environment category into a character — all four `containerType`
      branches, each verified in `localStorage`.
- [ ] Move preserves `files[]` **and** the legacy `file` field.
- [ ] Move between two containers **in the same slice** (e.g. two different characters) is applied in one
      state update, and a cross-slice move leaves both `ttrpg_*` keys consistent with the DOM.
- [ ] Copy leaves the source untouched, adds to the target, and the two `data-sound-id` values **differ**.
- [ ] **Copy auto-suffix (decision #8, §5.3):** `Fireball` → `Fireball (copy)` → `Fireball (copy 2)`. Uniqueness is
      scoped to the **destination container** — the same name still allowed in a different container, and a
      copy never produces `Fireball (copy 97)`. Moves never rename.
- [ ] Copy does not write a second `sound_file_*` localStorage key and does not add a second file to
      `uploads/` on Tauri — i.e. the file is genuinely shared (decision #1).
- [ ] A copied sound **plays** audio, from both the original and the copy, on web and on Android.
- [ ] **Guard (§7, §10 step 5) — the case that motivated it:** copy a sound, delete the **container** that
      held the original, then assert the copy's `sound_file_*` key (web) / `uploads/<storedName>` (Tauri)
      **still exists** and the copy still plays. Repeat with a copied custom `sound.icon`. Then assert the
      negative: a file referenced *only* by the deleted container **is** still removed — no orphan leak.
- [ ] The picker lists every container, grouped by section; the current container is absent for **move** and
      present-but-labelled `(duplicate here)` for **copy** (§6.3).
- [ ] Each row has both a `Move` and a `Copy` button with distinct stable titles (§6.2), and there is no
      mode state anywhere — the picker cannot be in a "move mode".
- [ ] `[title="Move or Copy Sound"]` appears once per card, only in edit mode, on desktop hover **and**
      always-visible on mobile.
- [ ] The picker scrolls at `35vh` and reaches its bottom on a seeded board with many categories.
- [ ] Mobile: the button works from the drawer and from the split panels, and the modal respects
      `env(safe-area-inset-bottom)` and `min-h-[80vh]`.
- [ ] A persisted failure shows the `role="alert"` banner rather than failing silently.
- [ ] **Delete still confirms (§6.5):** clicking a card's Trash button opens `Confirm Delete` naming the sound,
      and the sound is only removed after clicking the red **Delete** — not on Cancel. Assert `deleteSound`
      is still reached **only** via `confirmDelete` (App.jsx:1824), i.e. no new unconfirmed delete path.
- [ ] A **move** does **not** open any dialog (decision #3) and does **not** invoke `removeFileFromLocalStorage`.
- [ ] Drag-to-reorder **within** a container still works and is unaffected (`moveSound` untouched).
- [ ] `DATA_VERSION` is still `'3'` (App.jsx:257) and no `*_old` keys appear — i.e. no data reset.
- [ ] `npx eslint .` → 0 errors (3 pre-existing warnings: `convertFileSrc`, `_`, `ev`); `npx vite build`
      succeeds; Android debug build launches.
- [ ] E2E: the new assertions pass in `e2e-full.mjs` on **both** the web and Windows phases, and in
      `e2e-mobile.mjs`.

### Deferred — not in v1

- [ ] Cross-container **drag-and-drop** by adding drop zones to the sidebar rows (App.jsx:3726-3810). The
      existing hit-test only queries rendered cards (App.jsx:3270-3275), so this needs new drop targets.
- [ ] Creating a new character / category / group from inside the picker.
- [ ] Moving or copying a **whole container** (all its sounds at once).
- [ ] Copying **bundled default** sounds — these reference `public/assets` by filename and are already
      identical on every install; copying them is safe but pointless.
- [ ] Atomic cross-slice persistence (§5.4) — needs the `PROFILE_SYNC_SPEC.md` storage refactor, which is
      parked.

---

## 12. E2E notes

No unit tier exists; this is CDP-driven, like every other suite.

- Extend `e2e/e2e-full.mjs` and `e2e/e2e-mobile.mjs`. Continue the existing ID sequences — `EDIT` is at `E5`
  (App.jsx:259-265 asserts `E1`-`E5`), `SOUND` is at `J8` (rename flow, e2e-full.mjs:310-336).
- Assertion style is the existing three-positional-arg form, e.g.
  `log('SOUND','J9: picker opens', r==='OK'?'PASS':'FAIL', r)`.
- **Existing fixtures are enough** — `SEED` already creates `Human Paladin`, `Elf Sorcerer`, environment
  categories, and the groups `Tavern Pack` (mode `environment`) and `Hero Pack` (mode `characters`)
  (e2e-full.mjs:200-212). No new seeding required; assert "removed from Human Paladin, present in Elf
  Sorcerer".
- Query cards with **`[data-sound-card]`**, never `button` — they are `div role="button"` (App.jsx:3228-3234).
- Model the per-card button count on the existing edit-mode assertions (e2e-full.mjs:259-265) and the mobile
  `title`-based counting already used at e2e-mobile.mjs:324-325.
- Follow the delete-with-confirm pattern (e2e-full.mjs:824-850) for asserting state changes in both the DOM
  and `localStorage`.
- If CDP cannot synthesise an interaction, **skip with a logged reason** rather than failing — the
  `X2: drag skipped` precedent (e2e-full.mjs:670).
- Both runners already snapshot and restore `localStorage` around a suite via `e2e/e2e-snapshot.mjs`, even on
  crash, so move/copy tests cannot clobber real characters or sounds. No new protection needed.
- **The guard (§10 step 5) needs a file-existence assertion, not a DOM one.** The copy-shares-the-file design
  (decision #1) means the bug is invisible in the UI: the card renders and looks fine, it just makes no sound. Assert
  on the presence of the `sound_file_*` key in `localStorage` (web) — the DOM will not tell you. On the Windows
  Tauri phase, assert via `appDataDir()/uploads/<storedName>` instead, since there is no localStorage there.
