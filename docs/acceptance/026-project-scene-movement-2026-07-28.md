# Project scene movement acceptance — 2026-07-28

## Outcome

Project scenes are now first-class rows beneath their owning chapters and can
be reordered inside a chapter or moved across chapters with pointer or
keyboard dragging. The accepted implementation is commit `405b8742`
(`feat: add transactional scene movement`).

This is a manuscript transaction rather than a manifest-only reorder. The
implementation moves the exact UTF-16 scene slice and, under one native
transaction:

- rewrites every affected chapter manuscript;
- preserves stable scene IDs and densifies visible narrative order;
- migrates affected scene anchors and every Mention anchor;
- migrates only Story Positions that explicitly reference the moved scene;
- rejects stale text hashes, resource revisions, Mention revisions, invalid
  scene quotes, overlapping anchors, and partial Mention boundary crossings;
- stages, commits, verifies, and rolls back Markdown, Story JSON, and Mention
  JSON as one bundle.

Undo uses the verified post-move revisions/hashes plus an exact pre-move
restore receipt. It is deliberately not a reverse drag: reversing only scene
order cannot reconstruct interstitial manuscript text exactly.

## Interaction acceptance

- Scene rows are visibly nested under chapters and open the owning chapter at
  the scene's manuscript offset.
- Scene drag handles are focusable and measure `44 × 44` pixels.
- Pointer pickup retains the six-pixel activation threshold.
- Space/Enter pickup and drop, Arrow navigation, and Escape cancellation use
  the same rule resolver and announcements as pointer dragging.
- Search, read-only, write-in-progress, and unsaved-manuscript states provide
  readable disabled reasons. Unsaved manuscript disables only scene movement;
  the existing volume/chapter reorder controls remain available.
- Successful movement refreshes affected chapter word counts and the active
  editor session, then offers a six-second toast Undo.

The automated keyboard scenario moved `雨夜旧车站` from the first chapter to
the end of the second chapter, verified the new chapter ownership and word
counts, clicked the exact `撤销` action, and verified restoration to the first
chapter.

## Automated verification

| Gate | Result |
| --- | --- |
| Focused scene planner/service/tree/drag suites | Passed |
| `pnpm acceptance` | ESLint, TypeScript, 95 files / 321 tests, Vite production build passed |
| `cargo fmt --all -- --check` | Passed |
| `cargo test` | 51 passed / 0 failed / 2 explicit external gates ignored |
| Fresh `pnpm tauri:build` with one Cargo job | Portable EXE and NSIS installer built |
| Final incremental package after UI regression fix | Passed; artifacts replaced and rehashed |
| Isolated native startup/normal close | Passed with exit code 0 |

The shell currently provides Node `25.2.1` while the repository declares
Node 24 (`>=24 <25`), so pnpm emitted the known engine warning. Lint,
compilation, tests, production bundling, and Tauri packaging all completed
successfully.

## Responsive and accessibility evidence

Browser QA used the sanitized in-memory `browser-fixture`; it did not open an
author project.

| Viewport | Result |
| --- | --- |
| `1440 × 1000` | Nested scene row, visible focus, keyboard destination, completed cross-chapter move, and Undo toast accepted |
| `1024 × 768` | `clientWidth = scrollWidth = 1024`; scene handle `44 × 44` |
| `800 × 720` | `clientWidth = scrollWidth = 800`; search-filtered scene handle `44 × 44`, disabled, and labelled with the visible recovery hint |

Evidence:

- [Scene tree at 1440 × 1000](./screenshots/project-scene-movement/01-scene-tree-1440x1000.png)
- [Keyboard cross-chapter target](./screenshots/project-scene-movement/02-keyboard-cross-chapter-target-1440x1000.png)
- [Cross-chapter result](./screenshots/project-scene-movement/03-cross-chapter-success-undo-1440x1000.png)
- [Undo toast](./screenshots/project-scene-movement/04-scene-move-undo-toast-1440x1000.png)
- [Scene tree at 1024 × 768](./screenshots/project-scene-movement/05-scene-tree-1024x768.png)
- [Search-disabled state at 800 × 720](./screenshots/project-scene-movement/06-search-disabled-800x720.png)

The installed browser connector could not initialize in its protected Node
runtime (`Cannot redefine property: process`). Local Playwright with installed
Microsoft Edge provided the same DOM, keyboard, screenshot, overflow, and
console checks. A transient 404 console message was not reproducible when
response URLs were captured; the repeat run reported no failed responses.

## Windows artifacts

The final portable build launched with an isolated
`WEBVIEW2_USER_DATA_FOLDER`. PID `49044` reached input-idle, remained
responsive with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally with code `0`.

- Portable EXE:
  `tmp/project-scene-movement-delivery/writing-buddy-next.exe`
  - 7,398,912 bytes
  - SHA-256:
    `E734E721F27EEEFA4725D5C46BFF6A5F99602B9AECC5CC977015472FB67CE860`
- NSIS installer:
  `tmp/project-scene-movement-delivery/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,207,232 bytes
  - SHA-256:
    `A4970DF168B0493A4C8FEE58633CC10B22C24A69F06EB47025FA3F09358D73AD`

## Safety boundary

- Planner, application, native, and browser tests use sanitized fixtures or
  temporary directories.
- Native smoke used an isolated WebView profile.
- No real author manuscript or credential was read.
- No AI request or paid provider call was made.
- The legacy repository remained read-only.

