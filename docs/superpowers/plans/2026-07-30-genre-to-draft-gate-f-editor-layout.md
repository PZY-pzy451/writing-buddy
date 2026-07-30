# Phase 1.2B Gate F — Outline-guided editor layout

## Scope

Gate F optimizes the existing manuscript workspace without adding a second
editor, project tree, scene store, or AI action:

1. keep a stable 52 px right-side tool rail while its panel is closed;
2. expose exactly one on-demand tool panel for outline, characters,
   references, AI, or checks;
3. remember the selected tool, pin state, visibility, width, scene-bar state,
   and manuscript density in the existing writer workspace session;
4. turn the existing scene navigator into a collapsible current-scene bar with
   goal, conflict, and outcome plus chapter-scene navigation;
5. update the persisted active scene when the cursor crosses scene ranges;
6. preserve an editor selection when scene navigation only needs to reveal a
   different anchor;
7. preserve and restore all normal layout choices across focus mode.

Gate G contextual AI generation remains out of scope. Existing AI and Story
Kernel surfaces stay reachable, but this gate does not add or automatically run
any generation action.

## Canonical boundaries

- Monaco `ChapterEditor` remains the only manuscript editor.
- `WritingProject.volumes[].chapters[]` remains the only chapter hierarchy.
- Story Kernel `StoryScene` remains the only scene record.
- `WriterSessionState.workspaceLayouts` remains the layout persistence source.
- Existing `ResizeHandle`, assistant actions, project-tree scene anchors, and
  focus overlay are reused.

## Interaction contract

- The rail remains visible in the normal writing workspace even when no tool
  panel is open.
- Activating another rail item switches the one open panel; activating the
  current item again closes it.
- A panel may be pinned. An unpinned panel can be dismissed with Escape.
- Closing the panel does not discard its selected tool, pin choice, or width.
- Focus mode hides the rail and panel without mutating the stored normal
  layout; leaving focus restores them.
- Current-scene navigation uses 44 px targets, visible focus, polite status
  semantics, and reduced-motion-compatible transitions.
- Manuscript density is author-selected: compact, comfortable, or spacious.
  The reading column remains within the specified 680–820 px range.

## TDD sequence

1. Add writer-layout tests for legacy repair and the new persisted fields.
2. Add scene-bar tests for metadata, collapse, callbacks, active-scene change,
   and selection-preserving navigation.
3. Add workspace experience tests for the stable five-item rail, one-panel
   switching, pin/close persistence, and focus compatibility.
4. Add static CSS contracts for 52 px rail geometry, 160–220 ms panel motion,
   density widths, responsive overlays, and reduced motion.
5. Implement the state, rail, scene bar, editor integration, and styling.
6. Run focused tests, complete frontend and Rust gates, responsive browser and
   native acceptance, then Release/NSIS packaging.

## Stop line

Stop after the Gate F report and commit
`feat: optimize editor for outline guided drafting`. Do not implement Gate G
continuation candidates, AI diff/insert/reject flows, or new prompt contracts.
