# VS Code-style workspace resizing acceptance

Date: 2026-07-29

## Outcome

The project sidebar, writing assistant, and task/review dock now resize from
their visible separators at normal desktop and responsive workspace widths.
Rendered geometry, separator accessibility values, Zustand state, and
persistence use the same bounded values.

The original failure had two CSS causes:

1. responsive rules below 1600px replaced user-controlled sidebar and
   assistant sizes, and rules below 1280px hid every separator;
2. effective custom properties were resolved on `:root` while user sizes were
   written on `.app-shell`, so state changed without changing the grid.

The repair scopes the effective variables to `.app-shell`, keeps responsive
separators available, and gives the shared handle pointer capture, clamping,
keyboard controls, cancellation cleanup, document-level resize cursors, and
double-click reset.

## Bounds

| Pane | Minimum | Default | Maximum |
| --- | ---: | ---: | ---: |
| Project sidebar | 220px | 320px | 440px |
| Writing assistant | 280px | 360px | 480px |
| Task/review dock | 144px | 240px | 420px |

## Automated gates

| Gate | Result |
| --- | --- |
| Focused resize tests | 3 files / 8 tests passed |
| `pnpm acceptance` | 99 files / 344 tests passed; production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 51 passed / 2 explicitly ignored / 0 failed |
| `pnpm tauri:build` | Release EXE and NSIS installer built |
| Isolated native startup/normal close | PID 8212; responsive; exit code 0 |

## Browser interaction evidence

Local Playwright with installed Microsoft Edge exercised the real local
application. The in-app browser bootstrap was attempted first but could not
initialize in its protected runtime (`Cannot redefine property: process`).

| Viewport / theme | Interaction and measured result |
| --- | --- |
| 1536x992 / Paper | Pointer-dragged 320/360/240 to 400/440/326; reload preserved the exact geometry; overflow 0px |
| 1280x900 / Paper | Keyboard `End` reached 440/480/420; center remained 282px wide; overflow 0px |
| 1024x768 / Paper | All three separators remained visible; keyboard resize produced 332/372/252; overflow 0px |
| 1536x992 / Midnight | Restored 332/372/252 geometry with no console errors and overflow 0px |

Separator tests also cover primary-pointer capture, inverse and vertical drag,
clamping, `Home`, `End`, `Enter`, normal and Shift arrow steps, pointer cancel,
double-click reset, and ARIA minimum/maximum/current values.

Screenshots:

- `screenshots/workspace-resizing/01-before-resize-paper-1536x992.png`
- `screenshots/workspace-resizing/02-after-resize-paper-1536x992.png`
- `screenshots/workspace-resizing/03-responsive-resize-paper-1024x768.png`
- `screenshots/workspace-resizing/04-midnight-resize-1536x992.png`

Structured measurements:
`workspace-resizing-visual-metrics.json`.

## Windows artifacts

- Portable EXE:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,403,008 bytes
  - SHA-256:
    `E93129116E2B549D0078F10E4757376D31466144788DC86AB165FE787FA18335`
- NSIS installer:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,209,942 bytes
  - SHA-256:
    `0603F4A4014D6A1D93A35933C643B3D29C870C356E9289843D45867FD1E4FB83`
