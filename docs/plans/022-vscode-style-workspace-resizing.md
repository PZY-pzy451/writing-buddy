# VS Code-style workspace resizing

Updated: 2026-07-29

## Goal

Make the primary Writing Buddy workspace panes resize predictably like an IDE:

- project sidebar width;
- writing assistant width;
- task/review dock height.

The behavior must work across normal desktop sizes instead of updating hidden
state while responsive CSS ignores it.

## Root cause

- `ResizeHandle` already emits pointer and keyboard changes.
- At widths below 1600px, `workspace.css` replaces `--sidebar-width` and
  `--assistant-width` with viewport-derived constants, so stored user values no
  longer affect layout.
- At widths below 1280px, every `.product-resize-handle` is hidden.
- The effective hit area is only the unclipped half of an 8px handle because
  side panels use `overflow: hidden`.
- Effective grid custom properties are resolved on `:root`, while the current
  user values are written on `.app-shell`, so state and ARIA can change without
  changing rendered geometry even at full desktop width.
- The separator exposes orientation but not current/minimum/maximum values.

## Scope

- Keep one shared `ResizeHandle` implementation for sidebar, assistant, and
  dock.
- Clamp pointer and keyboard changes to explicit per-pane bounds.
- Add complete separator ARIA values, Home/End, Shift acceleration, pointer
  cancellation cleanup, and double-click reset.
- Apply a document-level resizing cursor and selection lock during pointer
  dragging.
- Preserve user sizes through the existing workspace persistence.
- Let responsive inline and overlay layouts consume the user size; compact
  layouts may cap the rendered pane to keep usable workspace visible.
- Keep drag targets visually quiet at rest, visible on hover/focus/active, and
  large enough to acquire reliably.

## Bounds

| Pane | Minimum | Default | Maximum |
| --- | ---: | ---: | ---: |
| Project sidebar | 220px | 320px | 440px |
| Writing assistant | 280px | 360px | 480px |
| Task/review dock | 144px | 240px | 420px |

## Responsive contract

- At 1600/1440/1280 desktop widths, sidebar and assistant use persisted values.
- Below 1280px, the assistant remains an overlay but its width is still
  resizable and capped to leave at least 220px of the application visible.
- Below 1024px, the project sidebar becomes an overlay but remains resizable
  and capped to leave at least 220px visible.
- Below 850px, the existing task dock remains hidden; visible overlay panes
  retain resizing.
- No document-level horizontal overflow is introduced.

## Validation

1. Unit tests cover pointer drag, both directions, clamp, keyboard steps,
   Home/End, double-click reset, pointer cancel, and ARIA values.
2. Store tests cover the defined persisted bounds.
3. Browser checks drag all three separators and verify actual geometry changes,
   persistence after reload, cursor/focus states, and compact overlays.
4. Paper and Midnight checks at 1536×992, 1280×800, and 1024×720.
5. Full `pnpm acceptance`, Rust regression gates, Tauri build, and isolated
   native startup/close.
