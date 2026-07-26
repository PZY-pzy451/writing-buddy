# 001 — Independent client architecture

## Dependency direction

`UI -> Application -> Domain -> Ports <- Tauri adapters`

Domain packages must not import React, Monaco, Tauri or VS Code. React calls a
small `DesktopBridge`; only the Rust implementation can touch arbitrary
operating-system APIs.

## Product surfaces

- Product top bar
- Global navigation rail
- Project and resource sidebar
- Resource tabs
- Chapter header and Monaco writing canvas
- Writing assistant
- Review/task dock
- Writing status bar

There is no terminal, output, debug console or extension host.

## Design system

The interface should feel calm, focused and literary. Paper is the default
theme, Midnight is the low-light alternative, Fog reduces contrast and Focus
removes secondary chrome.

- Body text: minimum 16 px, 1.7 line height.
- Manuscript measure: 65–75 Chinese/Latin characters.
- Interactive targets: at least 44 x 44 logical pixels.
- Keyboard focus: visible two-layer focus ring.
- Motion: 150–220 ms and disabled by `prefers-reduced-motion`.
- Icons: one Lucide SVG family; no emoji controls.
- Responsive tiers: complete three-column at 1600+, assistant drawer below
  1366, both side surfaces as drawers below 1100, rail + canvas below 850.

Theme tokens are CSS custom properties, but components consume semantic names
such as `surface-canvas`, `text-muted`, `border-subtle` and `accent`.
