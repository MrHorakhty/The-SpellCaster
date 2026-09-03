# Icon Feature for Groups — Planning Spec

> **Status**: Planning — do not implement until approved.
> **Created**: 2026-09-03

---

## 1. Goal

Add icon assignment to **Groups**, **Group Characters**, and **Group Categories** so each entity has a visual identifier beyond its name. Icons are selectable via a picker (emoji + Lucide tabs) and displayed throughout the mobile drawer, desktop sidebar, rail tabs, and group headings.

---

## 2. Where Icons Appear

| Location | Current | After |
|---|---|---|
| **Group tabs** — mobile rail | First letter of name | **Icon** (emoji or Lucide); if no icon set, fallback to first letter |
| **Group tabs** — mobile drawer | Text name only | **Icon + name** |
| **Group tabs** — desktop sidebar | Text name only | **Icon + name** |
| **Group heading** (sound grid top) | Text name only | **Icon + name** (icon left of name) |
| **Character rows** — drawer + sidebar | Hardcoded `<User>` | Default `User` Lucide icon; **changeable** via edit-mode tap |
| **Category rows** — drawer + sidebar | Hardcoded `<Music>` | Default `Music` Lucide icon; **changeable** via edit-mode tap |
| **Group modal** (add/edit) | Name field only | **Name + icon picker** |

---

## 3. Data Model Changes

### 3.1 New fields (string, nullable)

| Entity | New field | Default | Example values |
|---|---|---|---|
| **Group** | `icon` | `''` (empty = show first letter) | `'🏰'` (emoji), `'Flame'` (Lucide name) |
| **Group character** | `icon` | `'User'` (Lucide) | `'User'`, `'Dragon'`, `'🧙'` |
| **Group category** | `icon` | `'Music'` (Lucide) | `'Music'`, `'TreePine'`, `'🌲'` |

### 3.2 Icon value convention

- **Empty string `''`**: no icon assigned; UI falls back to first letter (groups) or default Lucide (characters/categories).
- **Lucide icon name** (e.g. `'Flame'`, `'Shield'`, `'TreePine'`): rendered as `<Icon size={...} />` from `lucide-react`.
- **Emoji string** (e.g. `'🏰'`, `'🐉'`): rendered as `<span>` with appropriate font sizing.

### 3.3 Entities affected

```
Group:       { id, name, mode, icon, categories: [...], characters: [...] }
GroupChar:   { id, name, icon, sounds: [...] }
GroupCat:    { category, icon, sounds: [...] }
```

### 3.4 Migration (`normalizeStoredData`)

- `...entry` spread in `normalizeStoredData` (line ~55) already preserves unknown fields, so existing data without `icon` simply gets `undefined` → treated as `''` / default.
- **No data version bump needed** — missing `icon` field gracefully falls back.
- Characters and categories created by mode toggle (`toggleGroupMode`) must carry `icon` through:
  - env→chars: `cat.icon` → `newChar.icon` (default `'User'` if missing)
  - chars→env: `ch.icon` → `newCat.icon` (default `'Music'` if missing)

### 3.5 Create handlers — icon defaults

| Handler | Sets icon to |
|---|---|
| `addGroup` | `''` (empty, shown as first-letter fallback) |
| `addGroupCharacter` | `'User'` (from form, default `'User'`) |
| `addCategory` (group mode) | `'Music'` (from form, default `'Music'`) |

---

## 4. Icon Picker Component

### 4.1 Structure

A new reusable `<IconPicker>` component (rendered inside modals and edit-mode popovers):

```
┌─────────────────────────────────────────┐
│  [Emoji] [Lucide]          [× clear]    │  ← tab bar
├─────────────────────────────────────────┤
│  🏰 🐉 🌲 ⚔️ 🛡️ 🔥 💀 🌙 ...         │  ← grid (emoji tab)
│  🧙 🎵 🗡️ 🏠 🌊 ⚡ 🎲 ✨ ...           │
│  ...                                    │
├─────────────────────────────────────────┤
│  (or Lucide grid when Lucide tab active)│
│  Shield  Sword  Flame  TreePine  ...    │
│  User    Music  Heart  Cloud    ...     │
│  ...                                    │
└─────────────────────────────────────────┘
```

### 4.2 Emoji set (~120 curated)

Organized by TTRPG-relevant categories (displayed as a flat scrollable grid):

**People & Characters**: 🧙 🧝 🧛 🧟 🤖 👹 👺 🤠 🥷 🧙‍♀️ 🧝‍♀️ 🧛‍♀️ 🧟‍♀️ 👩‍🦰 🧔 👦 👧 👴 👲 🤵 👸 🫅

**Creatures**: 🐉 🐲 🦅 🐺 🐍 🕷️ 🦇 🐙 🦄 🐻 🦁 🐸 🦂 🐉

**Nature & Elements**: 🌲 🌳 🌿 🌺 🌸 🌙 ☀️ ⛈️ 🌊 🔥 💨 ⚡ 🌑 🌈 ❄️ 💎

**Places & Structures**: 🏰 🏰 🏠 🏚️ ⛪ 🏕️ 🏛️ 🗼 🌋 ⛰️ 🏞️ 🕳️ 🚪 🏗️

**Items & Equipment**: ⚔️ 🗡️ 🛡️ 🏹 🔮 🧪 📜 🗝️ 💰 🧰 ⚒️ 🪓 🪄 🎲 📖

**Magic & Symbols**: ✨ 💀 ☠️ 🩸 👁️ 🌀 🕯️ ⭕ 🔮 🌟 💫 ⭐ 🕉️ ☸️ ⚖️

**Music & Misc**: 🎵 🎶 🥁 🎭 🎪 🎯 🃏 🎪 🔔 📯

### 4.3 Lucide icon set (~80 curated)

Imported from the already-installed `lucide-react` package. Categories:

**Characters & Beings**: `User`, `Users`, `Crown`, `Skull`, `Ghost`, `Robot`, `Witch`, `Brain`

**Combat & Weapons**: `Sword`, `Shield`, `Crosshair`, `Target`, `Axe`, `Bow`, `ArrowBigRight`, `Spear`

**Nature & Elements**: `TreePine`, `TreeDeciduous`, `Flower`, `Flower2`, `Cloud`, `CloudRain`, `CloudLightning`, `Droplets`, `Flame`, `FlameKindling`, `Snowflake`, `Sun`, `Moon`, `Star`, `Zap`, `Wind`

**Places**: `Castle`, `House`, `Tent`, `Mountain`, `Globe`, `Map`, `Compass`, `DoorOpen`, `Landmark`

**Magic & Items**: `Sparkles`, `Wand`, `Potion`, `ScrollText`, `KeyRound`, `Gem`, `Coins`, `Heart`, `HeartPulse`, `Eye`, `EyeOff`, `Infinity`

**Music & Misc**: `Music`, `Music2`, `Drum`, `Volume2`, `Bell`, `Megaphone`, `Flag`, `Bookmark`, `Tag`, `CircleDot`

### 4.4 Picker behavior

- **Two tabs**: "Emoji" (default) and "Lucide" — toggle with pill-style segmented control.
- **Grid layout**: 6 columns on mobile, 8 columns on desktop; each cell ~40px tap target.
- **Selection**: tapping an icon sets `icon` field and closes the picker.
- **Clear button**: ✕ icon in top-right resets `icon` to `''` (groups) or default (characters/categories).
- **No tint/color** — icons render in their native color (emoji) or current text color (Lucide).

---

## 5. Where the Picker Opens

### 5.1 Group modal (add/edit)

The existing `showGroupModal` modal (line ~4367) gains an icon picker section below the name input:

```
┌──────────────────────────────────┐
│  Add New Group / Edit Group   [×]│
│──────────────────────────────────│
│  Group Name *                    │
│  [________________________]      │
│                                  │
│  Icon                            │
│  ┌────────────────────────────┐  │
│  │ [selected icon preview]    │  │
│  │ [Choose Icon ▾]            │  │  ← click to expand picker inline
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 🏰 🐉 🌲 ⚔️ 🛡️ 🔥 ...   │  │  ← inline picker (always visible)
│  │ Shield Sword Flame Tree... │  │
│  └────────────────────────────┘  │
│                                  │
│  [Cancel]              [Save]    │
└──────────────────────────────────┘
```

- Picker rendered **inline** inside the modal (no extra popover).
- `groupFormData` gains `icon: ''` field.

### 5.2 Character rows — edit-mode tap

When `editMode` is active, tapping the **icon area** (left of the character name) in drawer/sidebar rows opens a small inline picker popover:

```
  ┌─[Picker popover]──┐
  │ 🧙 🐉 🌲 ⚔️ ...  │
  │ Shield User Flame  │
  │            [clear] │
  └───────────────────┘
  [👤 Human Paladin  ]  ← row (icon on left, name on right)
  [🐉 Dragons        ]
```

- Popover positions above or below the row (depending on available space).
- Clicking outside or selecting an icon closes it.
- Only accessible in **edit mode** — consistent with existing edit flows.
- The row's icon updates immediately on selection.

### 5.3 Category rows — edit-mode tap

Same pattern as character rows — edit-mode tap on the `<Music>` icon opens the picker popover. Default icon `'Music'`, changeable to any picker icon.

### 5.4 Group heading — no direct tap

The group heading shows **icon + name** but does NOT open a picker on tap. Icon is changed via the group modal (edit group) or potentially a future heading-context menu. This keeps the heading read-only and avoids accidental triggers.

---

## 6. Rendering Logic

### 6.1 Icon resolution helper

```js
// New helper function in App.jsx
const renderIcon = (icon, size = 16, className = '') => {
    if (!icon) return null  // caller falls back to default (first letter or default Lucide)

    // Check if it's a Lucide icon name
    const LucideIcons = { User, Music, Shield, Sword, Flame, TreePine, ... }
    if (LucideIcons[icon]) {
        const IconComponent = LucideIcons[icon]
        return <IconComponent size={size} className={className} />
    }

    // Otherwise treat as emoji
    return <span style={{ fontSize: size }} className={className}>{icon}</span>
}
```

### 6.2 Group tabs (mobile rail)

```jsx
// Before: {group.name.charAt(0).toUpperCase() || 'G'}
// After:
{group.icon
    ? renderIcon(group.icon, 20, 'flex items-center justify-center')
    : <span className="text-xs font-semibold">{group.name.charAt(0).toUpperCase() || 'G'}</span>
}
```

### 6.3 Group tabs (drawer + desktop sidebar)

```jsx
// Before: {group.name}
// After:
<div className="flex items-center gap-2">
    {group.icon && renderIcon(group.icon, 14)}
    <span className="truncate">{group.name}</span>
</div>
```

### 6.4 Group heading (sound grid top bar)

```jsx
// Before: <h2>{groupName}</h2>
// After:
<div className="flex items-center gap-2">
    {activeGroup?.icon && renderIcon(activeGroup.icon, 20)}
    <h2>{groupName}</h2>
</div>
```

### 6.5 Character rows (drawer + sidebar)

```jsx
// Before: <User size={16} className="shrink-0" />
// After (edit mode — icon is tappable):
<div onClick={editMode ? () => openIconPicker('groupCharacter', ch.id) : undefined}
     className={editMode ? 'cursor-pointer' : ''}>
    {renderIcon(ch.icon || 'User', 16, 'shrink-0')}
</div>
// Normal mode — same render, no click handler
```

### 6.6 Category rows (drawer + sidebar)

Same pattern as character rows, default icon `'Music'`.

---

## 7. State & Handlers

### 7.1 New state

```js
const [iconPickerOpen, setIconPickerOpen] = useState(false)
const [iconPickerTarget, setIconPickerTarget] = useState(null)
// target: { type: 'group' | 'groupCharacter' | 'groupCategory', id: string }
```

### 7.2 New handlers

```js
const openIconPicker = (type, id) => {
    setIconPickerTarget({ type, id })
    setIconPickerOpen(true)
}

const selectIcon = (iconValue) => {
    if (!iconPickerTarget) return
    const { type, id } = iconPickerTarget

    if (type === 'group') {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, icon: iconValue } : g))
    } else if (type === 'groupCharacter') {
        setGroups(prev => prev.map(g => ({
            ...g,
            characters: g.characters.map(ch => ch.id === id ? { ...ch, icon: iconValue } : ch)
        })))
    } else if (type === 'groupCategory') {
        setGroups(prev => prev.map(g => ({
            ...g,
            categories: g.categories.map(c => c.category === id ? { ...c, icon: iconValue } : c)
        })))
    }

    setIconPickerOpen(false)
    setIconPickerTarget(null)
}
```

### 7.3 Modified handlers

| Handler | Change |
|---|---|
| `addGroup` | Accept `icon` from form, include in created object |
| `addGroupCharacter` | Accept `icon` from form, default `'User'` |
| `addCategory` (group mode) | Accept `icon` from form, default `'Music'` |
| `handleGroupFormSubmit` | Pass `groupFormData.icon` to `addGroup`/`updateGroup` |
| `handleEditGroup` | Populate `groupFormData.icon` from existing group |
| `toggleGroupMode` | Carry `icon` field through conversion (env↔chars) |

---

## 8. Files Modified

| File | Changes |
|---|---|
| `src/App.jsx` | Data model, state, handlers, rendering, inline picker component |
| `src/index.css` | Minimal — icon picker grid styles (if not pure Tailwind) |

No new files needed — the `<IconPicker>` is an inline component within `App.jsx` (consistent with the monolithic pattern).

---

## 9. Edge Cases & Considerations

1. **Empty icon fallback**: Groups with `icon: ''` show first letter (current behavior). Characters/categories with no icon show their default Lucide icon.
2. **Mode toggle icon preservation**: `toggleGroupMode` must copy `icon` when converting categories↔characters. Default fallback if source icon is missing.
3. **Picker popover positioning**: On mobile drawer rows near screen bottom, popover should open upward. On desktop sidebar, opens to the right or above.
4. **Edit mode gating**: Icon picker on rows is ONLY accessible in edit mode — prevents accidental icon changes during normal use.
5. **Group modal inline picker**: Always visible in the modal (not hidden behind a dropdown) — reduces clicks, makes the feature discoverable.
6. **No tint/color**: Icons render natively — emojis in full color, Lucide icons inherit current text color (`text-lime-400`, `text-white`, etc.).
7. **Accessibility**: Icon picker cells need `aria-label` with the icon name for screen readers.
8. **Performance**: Lucide imports — only import the ~80 curated icons, not the full library. Tree-shaking handles the rest.

---

## 10. Implementation Order

1. **Data model**: Add `icon` field to group/character/category objects and `addGroup`/`addGroupCharacter`/`addCategory` handlers
2. **Migration**: Verify `normalizeStoredData` handles missing `icon` gracefully (should already work via spread)
3. **Mode toggle**: Update `toggleGroupMode` to carry `icon` through conversion
4. **IconPicker component**: Build the emoji + Lucide grid as an inline component in `App.jsx`
5. **Group modal**: Add icon field + inline picker to the add/edit group modal
6. **Group tabs (rail)**: Replace first-letter with icon
7. **Group tabs (drawer + sidebar)**: Add icon before name
8. **Group heading**: Add icon before name
9. **Character/category rows**: Replace hardcoded icons with dynamic, add edit-mode tap-to-change
10. **Picker popover for rows**: Build the small popover that opens on edit-mode tap
11. **Verify**: Lint, build, emulator test

---

## 11. Verification Checklist

- [ ] `npx eslint src/App.jsx` — 0 errors
- [ ] `npx vite build` — success
- [ ] New group created with emoji icon → shows in rail, drawer, sidebar, heading
- [ ] New group created with Lucide icon → same
- [ ] New group with no icon → shows first letter fallback
- [ ] Edit group → change icon → persists and updates everywhere
- [ ] Group character created → default `User` icon shows
- [ ] Group category created → default `Music` icon shows
- [ ] Edit mode → tap character icon → picker opens → select → updates
- [ ] Edit mode → tap category icon → picker opens → select → updates
- [ ] Mode toggle (env→chars) → icons carry through
- [ ] Mode toggle (chars→env) → icons carry through
- [ ] Mobile drawer: picker popover positions correctly
- [ ] Desktop sidebar: picker works on character/category rows
- [ ] No lint errors, no console errors on emulator
