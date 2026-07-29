# Phase 1.2A Gate G interaction feedback and accessibility

Updated: 2026-07-29

## Goal

Finish the existing writer interactions with understandable drag previews,
saved-result feedback, complete documented shortcuts, reliable focus, responsive
layout, restrained motion, and reduced-motion support.

Gate G does not add a Story resource type, AI action, provider, route, project
format, or background process. Gate H real-user/profile validation remains a
separate explicitly authorized gate.

## Existing foundations to preserve

- Project structure, Story association, timeline, and plot drag operations
  remain the canonical mutation paths.
- Shared `DragOverlayCard`, `DropIndicator`, `AssociationMenu`, and `UndoToast`
  remain the common interaction vocabulary.
- `ResourceTabManager`, project creation, Quick Capture, Writer Navigator,
  existing AI drawer, and the writer-session model remain canonical.
- Editor-native text undo keeps priority while a text control or Monaco has
  focus. Structural undo is only used outside editing surfaces.
- Workspace resizing, layout presets, save trust, and focus mode keep their
  established behavior.

## Drag feedback contract

### Hover and keyboard

- A tree drag handle is visually quiet until its row is hovered, focus enters
  the row, or the row is the active drag source.
- The handle remains in the accessibility tree and is keyboard reachable.
- DnD Kit keyboard sensors remain enabled for reorder and association flows.

### Preview

Every active target exposes readable text, not color alone:

- project structure: `移动到“第一卷”第 3 位` or
  `移动到“第二卷”末尾`;
- scene association: `关联为当前场景出场人物`;
- foreshadowing association: `标记为伏笔回收`;
- invalid target: a specific reason such as `人物不能移动到卷结构中`.

The visible preview and polite live-region announcement must use the same
domain intent. Invalid targets never mutate.

### Result

Successful mutations use a result toast with a real Undo action:

- chapter reorder title: `章节已移动并保存`;
- cross-container structure copy states whether order and parent changed;
- association copy states that a relationship or state event was created and
  that chapter order/parent were not changed;
- timeline/plot copy states the affected order or lifecycle state.

Undo remains guarded by the existing mutation receipt or inverse command and
the toast remains dismissible.

## Shortcut contract

The global resolver supports:

| Action | Shortcut |
| --- | --- |
| Writer Navigator | Ctrl/Cmd+K |
| Full search | Ctrl/Cmd+Shift+F |
| New chapter | Ctrl/Cmd+N |
| Quick create | Ctrl/Cmd+Shift+N |
| Quick Capture | Ctrl/Cmd+Shift+Space |
| AI quick actions | Alt/Option+A |
| Focus mode | F11 |
| Save | Ctrl/Cmd+S |
| Close tab | Ctrl/Cmd+W |
| Restore tab | Ctrl/Cmd+Shift+T |
| Switch tab | Ctrl/Cmd+Tab |
| Undo | Ctrl/Cmd+Z |

- Shortcut matching is centralized and unit tested for modifier conflicts.
- Chapter creation is available only with an open writable project.
- Quick create opens the existing create menu without performing a mutation.
- AI quick actions open the existing drawer without starting a paid request.
- Close, restore, and switch operate on existing resource tabs.
- Text inputs, contenteditable surfaces, and Monaco retain normal text
  shortcuts unless the command is deliberately global.
- Settings exposes the complete table.

## Focus and accessible control contract

- Dialogs and menus focus their first useful control after opening and restore
  the prior connected element on close.
- All icon-only controls have accessible names and visible focus.
- Effective pointer targets are at least 44 by 44 CSS pixels where space
  allows, including toast actions and drag handles.
- Status changes use polite live regions; errors use alert semantics.
- Interaction state never relies on color alone.

## Visual, responsive, and motion contract

- Hover/focus transitions: 100–140 ms.
- Panel transitions: 160–220 ms.
- List reorder transitions: 140–180 ms.
- Toast entrance: 160 ms using opacity/transform.
- No hover layout shift and no decorative neon or perpetual AI glow.
- At 1536×992, 1280×800, and 1024×720 there is no document-level horizontal
  overflow, clipped primary control, or inaccessible toast/menu.
- `prefers-reduced-motion: reduce` removes non-essential animation and smooth
  scrolling while keeping state changes understandable.

## Test-first slices

1. Pure shortcut resolution and conflict tests.
2. Tab close/restore/switch state tests.
3. Project structure and Story drag preview/result-copy tests.
4. Menu/dialog focus restoration tests.
5. CSS contract and real responsive interaction checks.
6. Complete frontend, Rust, Release/NSIS, and native smoke gates.

## Stop line

After the exact commit
`feat: polish writer interaction feedback`, stop before Gate H. Do not create
five acceptance profiles or claim real-user validation in Gate G.

## Completion

Completed: 2026-07-29

- Centralized and documented all twelve shortcuts, added real native-backed
  chapter creation, tab lifecycle shortcuts, and arrow-key tab navigation.
- Unified semantic previews, mutation-effect result copy, live announcements,
  saved Toast titles, and Undo across existing drag surfaces.
- Completed modal focus restoration, 44 px chapter controls, responsive
  layout, bounded timing, and reduced-motion behavior.
- Passed `pnpm acceptance:gate-g` at 1536×992, 1280×800, and 1024×720.
- Passed 127 Vitest files / 468 tests, change-aware self-test, 55 Rust tests,
  Release/NSIS packaging, and isolated native startup/normal close.
- Acceptance:
  `docs/acceptance/042-phase-1.2a-gate-g-interaction-feedback-accessibility-2026-07-29.md`.
