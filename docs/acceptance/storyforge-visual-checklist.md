# StoryForge visual and accessibility acceptance

Date: 2026-07-27

Branch: `codex/phase-1.0a-deepseek-ai-foundation`

Task: Gate F / Task 22

## Outcome

The professional StoryForge surfaces now use the entire remaining workspace
instead of leaving an invisible assistant column or a short fixed scroll strip.
The 1280px dashboard regression was reproduced during this acceptance pass:
an empty 320px assistant grid column reduced the workspace to 602px. The
assistant-closed breakpoint now begins at 1280px, restoring a 922px workspace.

At 1024px, the Story Kernel navigation is a full-height internal scroll region,
so the final Continuity Review entry and footer are reachable. This fixes the
same clipped-navigation class of issue without adding page-level scrolling.

## Responsive contract

The Windows title bar is 32px; browser metrics below use the remaining content
viewport.

| Native window | Content viewport | Project pane | Main workspace | Page overflow | Clipped controls | Controls below 44px |
| --- | --- | --- | --- | --- | --- | --- |
| 1536×992 | 1536×960 | 304px | 1154px | 0×0 | 0 | 0 |
| 1280×800 | 1280×768 | 280px | 922px | 0×0 | 0 | 0 |
| 1024×720 | 1024×688 | 240px | 706px | 0×0 | 0 | 0 |

Scrollable descendants may extend beyond the viewport by design. The capture
runner distinguishes those descendants from interactive controls clipped
without a scrollable ancestor. The latter count is zero in every capture.
Machine-readable evidence is in
[`gate-f-visual-metrics.json`](./gate-f-visual-metrics.json).

## Accessibility checklist

- [x] Story reference navigation supports Arrow Up/Down, Home and End.
- [x] Directed relationship cells support four-arrow traversal.
- [x] Timeline graph and virtualized list fallback support arrow navigation.
- [x] Assistant drawer toggle retains keyboard focus.
- [x] Modal dialogs focus their first action, trap Tab, close with Escape and
      restore focus to the invoking control.
- [x] Buttons, fields, tabs and visible StoryForge controls provide at least a
      44px vertical target.
- [x] Buttons, inputs, selects and textareas share a visible 2px focus ring.
- [x] Reduced-motion mode removes smooth scrolling and collapses animation and
      transition duration to 0.01ms.
- [x] Muted text meets WCAG AA 4.5:1 against its primary surface in Paper, Fog,
      Focus and Midnight themes.
- [x] No viewport has horizontal page scrolling or an inaccessible clipped
      interactive control.

The automated interaction and contract checks live in
`apps/desktop/tests/e2e/storyforge-layout.spec.ts`.

## Approved prototype mapping

1. [Workspace overview](./screenshots/gate-f/01-workspace-overview-1536x992.png)
2. [Character center](./screenshots/gate-f/02-character-center-1536x992.png)
3. [Directed relationship graph](./screenshots/gate-f/03-relationship-graph-1536x992.png)
4. [Multi-track timeline](./screenshots/gate-f/04-timeline-1536x992.png)
5. [Story assets](./screenshots/gate-f/05-story-assets-1536x992.png)
6. [Grounded AI context](./screenshots/gate-f/06-ai-grounded-context-1536x992.png)

Additional responsive evidence:

- [Workspace overview at 1280×800](./screenshots/gate-f/07-workspace-overview-1280x800.png)
- [Timeline at 1024×720](./screenshots/gate-f/08-timeline-1024x720.png)

## Intentional differences from the reference images

- The JSON reference proposed a 36px minimum target. The implementation uses
  44px for professional desktop accessibility and touch/pen tolerance.
- The AI Context Pack stays inside the live editor's right assistant instead
  of replacing the manuscript with a dedicated full-page flow. This preserves
  the selected source, Diff/Undo transaction and author confirmation in one
  workspace.
- Relationship evidence uses an Inspector that appears after a node or edge is
  selected. The empty state explains directionality instead of preselecting an
  arbitrary author fact.
- Timeline tracks do not stretch sparse data to fill the canvas. The complete
  remaining height is scrollable and reserved for additional tracks; the event
  Inspector independently scrolls at compact widths.
- The deterministic browser fixture contains only original synthetic prose.
  Reference screenshots are visual targets, not copied application assets.

## Verification

- Node: 24.14.0
- Layout interaction spec: 5/5 passed
- Focus/dialog/component regression subset: 10/10 passed
- Browser captures: 8/8 complete
- Page overflow: zero at all three tiers
- Inaccessible clipped controls: zero
- Visible StoryForge controls below 44px: zero
