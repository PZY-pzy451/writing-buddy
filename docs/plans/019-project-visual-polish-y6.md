# Project visual polish Y6 implementation contract

Updated: 2026-07-28
Status: Accepted

## Goal

Complete Task 16 / Y6 from
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0` without
changing product behavior:

- unify primary card geometry and spacing;
- constrain control heights to the documented 32/40/44 pixel scale;
- constrain control icons to the documented 16/18/20 pixel scale, with
  explicit larger presentation sizes for empty-state artwork;
- replace inconsistent major empty states with one semantic presentation
  primitive and full/panel/compact density variants;
- remove hover movement that causes layout jump;
- keep disabled controls readable without relying on reduced opacity;
- verify Paper and Midnight plus 1536/1280/1024 responsive layouts.

The existing deep-blue product shell, warm-paper work surface, four themes,
Lucide icon family, semantic interaction tokens, and business workflows remain
the visual and architectural baseline.

## Baseline evidence

The sanitized `browser-fixture` was inspected before implementation.

- Welcome, dashboard, settings, character, and versions pages had zero
  document-level horizontal overflow.
- Visible icon buttons still measured 36×44; the compact project-tree create
  control measured 28×28; the resource-section toggle measured 34 pixels
  high; the status action measured 17 pixels high.
- Control icons used several one-off sizes, including 14, 15, 17, 19, and 21
  pixels instead of the 16/18/20 scale.
- Association cards and AI action controls translated vertically on hover.
- Nine disabled rule groups reduced opacity to 0.48–0.55, weakening readable
  text and icons despite the global disabled token treatment.
- Major empty states used unrelated structures ranging from one line of text
  to complete icon/title/description/action layouts.

The in-app browser connector again failed to initialize in its protected
runtime. Local Playwright with installed Microsoft Edge supplies the equivalent
DOM, focus, responsive, console, metric, and screenshot evidence.

## Shared presentation contract

### Controls

- `--control-height-sm`, `--control-height-md`, and `--control-height-lg` are
  the only shared control heights: 32, 40, and 44 pixels.
- Icon-only actions use a 44-pixel effective target unless they are an
  explicitly compact, secondary control, which may use 40 pixels.
- Status-bar actions use the 32-pixel compact tier while the status bar remains
  40 pixels high.
- Control icons use 16, 18, or 20 pixels. Larger 24/32/64 icons are reserved
  for badges, empty-state illustrations, and hero marks.
- Hover may change color, border, or shadow but not geometry or position.
- Disabled controls retain opacity 1 and use muted text, subtle surface, and
  visible border tokens. A label, tooltip, or adjacent explanation supplies
  the recovery reason where one exists.

### Cards and empty states

- Main cards use `--radius-card`, `--border-subtle`, and `--shadow-card`.
- Popovers, dialogs, drag overlays, and toasts keep their existing higher
  elevations; primary content cards do not acquire heavy shadows.
- `AppEmptyState` owns icon, title, optional description, optional actions,
  tone, and density.
- Full and panel empty states use icon + title + description; actions, when
  available, follow in primary/secondary order.
- Compact empty states may omit the description only when the surrounding
  heading already explains the task.
- Empty-state meaning never relies on color alone.

## Migration surface

Adopt the shared empty-state primitive for the central no-resource canvas,
project search, versions, task dock, generic resource editor, review result,
character center, worldbuilding, item/assets, plot inspector, information
control, relationship inspector, timeline, continuity, association, and AI
candidate/result surfaces where the state is a stable user-facing condition.

Existing specialized loading, validation, drag, AI candidate, and recovery
components remain in place. This gate does not collapse domain-specific status
messages into a generic component.

## Responsive acceptance

- `1536×992`: complete desktop hierarchy, Paper and Midnight.
- `1280×800`: reduced gutters and inspector behavior without clipped actions.
- `1024×720`: compact shell, readable empty states, and zero page overflow.
- `800×720`: regression-only narrow check for no page overflow and no hidden
  recovery action.
- The window/document and each primary workspace must not gain unintended
  horizontal scrolling.
- Focus rings remain visible in both light and dark themes.
- Reduced-motion mode removes nonessential transitions and animation.

## Verification

1. TypeScript compilation before tests.
2. Static visual contract tests for the shared control scale, disabled opacity,
   hover geometry, card tokens, and reduced motion.
3. Component tests for full, panel, compact, action, and accessible empty-state
   variants.
4. Focused page tests for migrated empty states.
5. Complete `pnpm acceptance`.
6. Rust formatting and full Rust tests to prove no native regression.
7. Responsive browser screenshots and measured controls in Paper/Midnight.
8. Fresh one-job Tauri release, NSIS package, hashes, and isolated native
   startup/normal-close smoke.

## Non-goals

- No new project command, persistence format, AI request, or filesystem path.
- No person-group or world-category drag implementation.
- No Command Palette feature work.
- No Y7 performance, memory, second-start, real-provider, or human cutover
  gate.
- No visual rewrite of the established product language.
