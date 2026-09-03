# Desktop UI Overhaul — Planning Spec

> **Status**: Planning — do not implement until approved.
> **Created**: 2026-09-03

---

## 1. Goal

Overhaul the desktop (non-mobile) sidebar layout, sound grid stretching, and edit/delete button sizing so the desktop experience matches the clarity and polish of the mobile version while making better use of available screen space.

Three changes:
1. **Sidebar**: Replace horizontal scrollable group tabs with a two-column vertical layout (group tabs left + categories right)
2. **Container stretching**: Sound grid container stretches to fill available vertical space (like mobile)
3. **Button sizing**: Desktop edit/delete buttons scale up to 32px targets (currently 10-12px icons)

---

## 2. Current State (Problems)

### 2.1 Sidebar — horizontal group tabs (lines 3698-3734)
```
┌─────────────────────────────┐
│ Categories          [Edit]  │
│ [Characters][Env][Group1].. │  ← horizontal flex, overflow-x-auto
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │     scrolls if many groups, not obvious
│ ▸ Human Paladin             │
│ ▸ Dragons                   │
│ ▸ Environmental Effects     │
│                             │
│                             │  ← leftover vertical space, not filled
└─────────────────────────────┘
```
- Group tabs overflow horizontally — not clear they're scrollable
- Only one list visible at a time (groups OR categories, not both)
- On wide screens, wasted horizontal space in the 256px sidebar

### 2.2 Sound grid container (line 3896)
- Uses `flex-1 min-w-0` — fills horizontal space but does NOT stretch vertically
- Content sits at the top with empty space below on tall screens
- Mobile uses `flex-1 min-h-full` which stretches properly

### 2.3 Edit/delete buttons (lines 2784-2801, 3778-3888)
- Sound card buttons: icon `size={10}`, padding `p-0.5` — tiny on desktop
- Sidebar item buttons: icon `size={12}`, padding `p-1.5` — still small
- All sizes are fixed, no responsive scaling
- Mobile deliberately made them small (26px targets) to save space — desktop has no such constraint

---

## 3. Changes

### 3.1 Sidebar — Two-Column Vertical Layout

**New layout:**
```
┌──────────────────────────────────────┐
│ Categories                    [Edit] │
│ ┌──────────┬────────────────────────┐│
│ │ 🧑 People│ ▸ Human Paladin    ✏🗑││
│ │ 🌲 Env   │ ▸ Dragons           ✏🗑││
│ │ 🏰 Forest│ ▸ Environmental Eff. ✏🗑││
│ │ ⚔️ War   │                      ││
│ │          │                      ││
│ │ [+Group] │                      ││
│ └──────────┴────────────────────────┘│
└──────────────────────────────────────┘
       ↑ group tabs        ↑ categories
      (left column)      (right column)
```

**Column 1 — Group/Tab Column** (left):
- Vertical list of tab buttons: Characters, Environment, then each group
- Each tab shows **icon (if set) + name** (ties into ICON_FEATURE_SPEC)
- Active tab highlighted with `bg-lime-600`
- Group tabs get delete badges in edit mode (same as current)
- "Add Group" button at bottom (edit mode only)
- Width: ~90-100px (enough for short names, overflow truncated)

**Column 2 — Category/Item Column** (right):
- Vertical scrollable list of characters, categories, or group items
- Depends on which tab is selected (same logic as current)
- Edit/delete buttons on each item (32px targets — see section 3.3)
- Group mode toggle (Characters/Environment segmented control) shown here when a group tab is active in edit mode
- Takes remaining width after group column

**Divider**: thin `border-dark-700` vertical border between columns.

**Total sidebar width**: `w-72` (288px) — up from `w-64` (256px).

### 3.2 Sound Grid Container — Vertical Stretch

**Change the main content wrapper** (line 3257) for desktop:
```
Current:  flex-1 overflow-y-auto w-full px-6 py-6
New:      flex-1 overflow-y-auto w-full px-6 py-6 min-h-full
```

**Change the standard view layout** (line 3328) for desktop:
```
Current:  flex flex-col lg:flex-row gap-6
New:      flex flex-col lg:flex-row gap-6 min-h-full
```

**Change the sound grid container** (line 3896):
```
Current:  flex-1 min-w-0 bg-dark-800 rounded-xl p-6
New:      flex-1 min-w-0 bg-dark-800 rounded-xl p-6 flex flex-col
```

Inner sound card grid (line 3920) also gets `flex-1` so it fills available height:
```
Current:  flex flex-wrap gap-4
New:      flex flex-wrap gap-4 flex-1 content-start
```

**Split view** (line 2827): same treatment — add `min-h-full` to the flex row.

This makes the sidebar + sound grid stretch to the full viewport height, matching mobile behavior.

### 3.3 Edit/Delete Button Sizing — Desktop 32px Targets

All edit/delete buttons gain responsive sizing. Mobile keeps current small sizes; desktop scales up.

**Sound card buttons** (lines 2786-2798):
```
Current:  Trash2 size={10}, p-0.5, min-h-[26px] (mobile only)
New:      Trash2 size={isMobile ? 10 : 14}, p-0.5 md:p-1.5, min-h-[26px] md:min-h-[32px]
```

**Sidebar item buttons** (lines 3780-3793, 3811-3824, 3843-3855, 3871-3884):
```
Current:  Trash2/Edit size={12}, p-1.5
New:      Trash2/Edit size={14}, p-1.5 md:p-2
```

**Split view sidebar item buttons** (lines 2905-2918, 2935-2948):
```
Current:  Trash2/Edit size={12}, p-1.5
New:      Trash2/Edit size={14}, p-1.5 md:p-2
```

**Group tab delete badges** (lines 3723-3730):
```
Current:  Trash2 size={10}, min-h-[24px] min-w-[24px]
New:      Trash2 size={10} md:size={12}, min-h-[24px] md:min-h-[32px] min-w-[24px] md:min-w-[32px]
```

**Summary table:**

| Button | Mobile (current) | Desktop (new) |
|---|---|---|
| Sound card icon | 10px | 14px |
| Sound card min size | 26px | 32px |
| Sidebar item icon | 12px | 14px |
| Sidebar item padding | p-1.5 | p-2 |
| Group tab badge icon | 10px | 12px |
| Group tab badge min | 24px | 32px |
| Grid header group btn | 16px (unchanged) | 16px (unchanged) |

Mobile values remain identical — no regression on touch targets.

---

## 4. Detailed Code Changes

### 4.1 Desktop sidebar restructure (lines 3683-3892)

Replace the entire `{!isMobile && (...)}` block with:

```jsx
{!isMobile && (
<div className="w-full lg:w-72 shrink-0 bg-dark-800 rounded-xl p-4 flex flex-col">
    {/* Header */}
    <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Categories</h2>
        <button onClick={() => setEditMode(!editMode)}
            className={`px-3 py-2 rounded-lg transition-colors ${editMode ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'}`}>
            <Edit size={16} />
        </button>
    </div>

    {/* Two-column body */}
    <div className="flex flex-1 min-h-0 gap-0 border border-dark-700 rounded-lg overflow-hidden">

        {/* LEFT COLUMN: Group/Tab list */}
        <div className="w-[100px] shrink-0 bg-dark-900 flex flex-col border-r border-dark-700">
            <div className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto no-scrollbar">
                <button onClick={() => switchTab('characters')}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${tabType === 'characters' ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'}`}>
                    <User size={14} className="inline mr-1.5 shrink-0" />
                    <span className="truncate">Characters</span>
                </button>
                <button onClick={() => switchTab('environment')}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${tabType === 'environment' ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'}`}>
                    <Music size={14} className="inline mr-1.5 shrink-0" />
                    <span className="truncate">Environment</span>
                </button>

                {groups.map(group => (
                    <div key={group.id} className="relative group">
                        <button onClick={() => selectGroup(group.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${tabType === 'groups' && activeTab === group.id ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'}`}>
                            {/* icon fallback to first letter */}
                            <span className="truncate">{group.name}</span>
                        </button>
                        {editMode && (
                            <button onClick={() => handleDeleteGroup(group.id)}
                                className="absolute -top-1.5 -right-1.5 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 z-10 min-h-[32px] min-w-[32px] flex items-center justify-center">
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {editMode && (
                    <button onClick={openAddGroupModal}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium bg-dark-700 text-lime-400 hover:bg-dark-600">
                        <Plus size={14} className="inline mr-1.5" />
                        <span className="truncate">New Group</span>
                    </button>
                )}
            </div>
        </div>

        {/* RIGHT COLUMN: Categories/Items */}
        <div className="flex-1 flex flex-col min-w-0">
            {/* Group mode toggle (when group tab active + edit mode) */}
            {editMode && tabType === 'groups' && activeGroup && (
                <div className="flex m-2 mb-0 rounded-lg overflow-hidden border border-dark-600">
                    <button onClick={() => toggleGroupMode(activeGroup.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeGroup.mode === 'characters' ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300'}`}>
                        <User size={12} /><span>Characters</span>
                    </button>
                    <button onClick={() => toggleGroupMode(activeGroup.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeGroup.mode !== 'characters' ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300'}`}>
                        <Music size={12} /><span>Environment</span>
                    </button>
                </div>
            )}

            {/* Item list (scrollable) */}
            <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar p-2">
                {/* Empty states */}
                {tabType === 'characters' && characters.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-4">No characters yet.</p>
                )}
                {tabType === 'environment' && environmentSounds.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-4">No categories yet.</p>
                )}
                {tabType === 'groups' && activeGroup?.mode === 'characters' && (activeGroup?.characters || []).length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-4">No characters yet.</p>
                )}
                {tabType === 'groups' && activeGroup?.mode !== 'characters' && (activeGroup?.categories || []).length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-4">No categories yet.</p>
                )}

                {/* Characters */}
                {tabType === 'characters' && characters.map(char => (
                    <div key={char.id} className="relative group">
                        <button onClick={() => selectItem('characters', char.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center space-x-2 transition-colors ${activeTab === char.id ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'} ${editMode ? 'pt-8' : ''}`}>
                            <User className="shrink-0" size={14} />
                            <span className="truncate">{char.name}</span>
                        </button>
                        {editMode && (
                            <>
                                <button onClick={() => handleDeleteCharacter(char.id)}
                                    className="absolute top-1 left-1 p-1.5 md:p-2 rounded-full bg-red-600 text-white hover:bg-red-700 opacity-0 group-hover:opacity-100">
                                    <Trash2 size={14} />
                                </button>
                                <button onClick={() => handleEditCharacter(char.id)}
                                    className="absolute top-1 right-1 p-1.5 md:p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 opacity-0 group-hover:opacity-100">
                                    <Edit size={14} />
                                </button>
                            </>
                        )}
                    </div>
                ))}

                {/* Environment categories — same pattern */}
                {/* Group categories — same pattern */}
                {/* Group characters — same pattern */}
            </div>
        </div>
    </div>
</div>
)}
```

### 4.2 Split view sidebar (lines 2829-2954)

Apply the same two-column structure inside `renderPanelSection`. The mini sidebar (`w-full md:w-64`) becomes `w-full md:w-72` and uses the same two-column internal layout. Since split view only shows characters OR environment (no groups), the left column just shows the section type and the right column shows the items.

### 4.3 Container stretching

| Line | Current | New |
|---|---|---|
| 3257 | `flex-1 overflow-y-auto w-full px-6 py-6` | Add `min-h-full` |
| 3328 | `flex flex-col lg:flex-row gap-6` | Add `min-h-full` |
| 2827 | `flex flex-col md:flex-row gap-4 h-full` | Keep `h-full`, add `min-h-full` |
| 3896 | `flex-1 min-w-0 bg-dark-800 rounded-xl p-6` | Add `flex flex-col` |
| 3920 | `flex flex-wrap gap-4` | Add `flex-1 content-start` |

### 4.4 Button sizing — all locations

Every edit/delete button gets `md:p-2` and `md:size={14}` (or `md:size={12}` for badges) added to its classes. Mobile classes remain untouched.

Key locations to update:
- `renderSoundCard` — lines 2786-2798
- `renderPanelSection` sidebar items — lines 2905-2918, 2935-2948
- Desktop sidebar items — lines 3780-3793, 3811-3824, 3843-3855, 3871-3884
- Desktop sidebar group tab badges — lines 3723-3730

---

## 5. Edge Cases

1. **Narrow desktop windows** — below `lg:` (1024px) the sidebar becomes full-width (existing `lg:w-72` behavior). The two-column layout still works at 288px.
2. **Many groups** — left column scrolls independently (its own `overflow-y-auto`), so 20+ groups won't break the layout.
3. **Long group/category names** — truncated with `truncate` in both columns; right column has more space (~180px after left column).
4. **Split view** — `renderPanelSection` gets the same two-column treatment but simpler (no group tabs in left column — just the section title).
5. **Mobile unaffected** — all changes gated behind `!isMobile` or `md:` responsive classes. Mobile code paths remain identical.

---

## 6. Files Modified

| File | Changes |
|---|---|
| `src/App.jsx` | Sidebar restructure, container stretch classes, button sizing classes |

No CSS file changes needed — all achievable with Tailwind utility classes.

---

## 7. Implementation Order

1. **Button sizing first** — lowest risk, purely additive `md:` classes
2. **Container stretching** — add `min-h-full` / `flex flex-col` classes
3. **Sidebar restructure** — replace horizontal tabs with two-column vertical layout
4. **Split view sidebar** — apply same two-column pattern to `renderPanelSection`
5. **Verify**: lint + build + manual check on desktop browser

---

## 8. Verification Checklist

- [ ] `npx eslint src/App.jsx` — 0 errors
- [ ] `npx vite build` — success
- [ ] Desktop: sidebar shows two columns — group tabs on left, categories on right
- [ ] Desktop: selecting a group tab shows its categories in the right column
- [ ] Desktop: Characters/Environment tabs work the same way
- [ ] Desktop: sidebar total width is 288px (w-72)
- [ ] Desktop: sound grid container stretches to fill full viewport height
- [ ] Desktop: edit/delete buttons on sound cards are 32px targets (comfortable mouse click)
- [ ] Desktop: edit/delete buttons on sidebar items are 32px targets
- [ ] Desktop: group tab delete badges are 32px in edit mode
- [ ] Mobile: all buttons remain 26px (no change)
- [ ] Mobile: sidebar/drawer/rail unchanged
- [ ] Split view: sidebar also uses two-column layout (if applicable)
- [ ] No console errors on desktop browser
