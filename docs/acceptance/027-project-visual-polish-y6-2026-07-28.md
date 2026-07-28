# Project visual polish Y6 acceptance — 2026-07-28

## Outcome

The application-wide Y6 visual-polish pass is accepted at implementation
commit `6a00b285` (`feat: polish shared application visuals`).

The change keeps the existing deep-blue shell, warm-paper workspace, four
themes, Lucide icons, and product behavior while applying one shared visual
contract across the desktop client:

- shared controls use the 32/40/44-pixel height tiers;
- button icons use 16/18/20 pixels, with 24/32 pixels reserved for
  presentation marks and empty-state artwork;
- `AppEmptyState` supplies full, panel, and compact semantic empty states;
- main content cards use the shared radius, border, and restrained shadow
  tokens;
- hover feedback no longer translates controls or cards;
- disabled controls remain at full opacity with readable semantic colors;
- keyboard focus and reduced-motion behavior are shared across workspaces;
- the existing application icon is declared as the browser favicon, removing
  the development-only `/favicon.ico` 404.

No project command, persistence schema, AI request, filesystem path, or
business workflow changed.

## Automated verification

All frontend commands ran with Node `24.14.0` and the repository pnpm
`10.32.1`.

| Gate | Result |
| --- | --- |
| Focused empty-state, character, and visual-contract suites | 3 files / 10 tests passed |
| `pnpm acceptance` | ESLint, TypeScript, 97 files / 327 tests, and Vite production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 51 passed / 0 failed / 2 explicit external gates ignored |
| Fresh one-job `pnpm tauri:build` | Portable EXE and NSIS installer built |
| Isolated native startup/normal close | Passed with exit code 0 |

The complete frontend gate was rerun after adding the favicon declaration. The
final production bundle includes the existing SVG application icon and a fresh
browser context reports no console errors or failed responses.

## Responsive, theme, and accessibility evidence

Browser checks used only the sanitized in-memory `browser-fixture`.

| Viewport and theme | Result |
| --- | --- |
| `1536 × 992`, Paper | Dashboard hierarchy accepted; document overflow 0 |
| `1280 × 800`, Midnight | Settings controls and disabled states accepted; document overflow 0 |
| `1280 × 800`, Paper | Character filter/full empty states accepted; primary action `130 × 44` |
| `1024 × 720`, Midnight | Versions empty state accepted; document overflow 0 |
| `1024 × 720`, Paper | Search empty state and keyboard focus accepted; document overflow 0 |

Across the measured dashboard, settings, and versions states:

- no visible control measured below the 32-pixel compact floor;
- primary icon-only targets retain the 44-pixel tier;
- visible button icons were 16, 18, or 20 pixels; 24 pixels appeared only in
  presentation marks;
- no disabled button used reduced opacity;
- the Paper disabled-state text contrast measured `5.84:1`;
- reduced-motion mode reduced nonessential transitions to an effectively zero
  duration;
- focus remained visible and no primary workspace gained horizontal overflow.

Evidence:

- [Paper dashboard at 1536 × 992](./screenshots/project-visual-polish-y6/01-dashboard-paper-1536x992.png)
- [Midnight settings at 1280 × 800](./screenshots/project-visual-polish-y6/02-settings-midnight-1280x800.png)
- [Character empty states at 1280 × 800](./screenshots/project-visual-polish-y6/03-characters-filter-empty-paper-1280x800.png)
- [Midnight versions empty state at 1024 × 720](./screenshots/project-visual-polish-y6/04-versions-empty-midnight-1024x720.png)
- [Paper search empty state at 1024 × 720](./screenshots/project-visual-polish-y6/05-search-empty-paper-1024x720.png)
- [Paper keyboard focus at 1024 × 720](./screenshots/project-visual-polish-y6/06-keyboard-focus-paper-1024x720.png)
- [Measured visual metrics](./project-visual-polish-y6-visual-metrics.json)

The installed in-app browser connector still cannot initialize in its
protected runtime. Local Playwright with installed Microsoft Edge supplied the
equivalent DOM, keyboard, screenshot, overflow, console, and response checks.

## Windows artifacts

The final portable build launched with an isolated
`WEBVIEW2_USER_DATA_FOLDER`. PID `2984` reached input idle, remained
responsive with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally within ten seconds with code `0`; no forced termination was required.

- Portable EXE:
  `tmp/project-visual-polish-y6-target/release/writing-buddy-next.exe`
  - 7,398,912 bytes
  - SHA-256:
    `BE5BAB7A930D64DFDFC7D5F7EC724FC1EAA89AE43E444E848C73771C111A7FE0`
- NSIS installer:
  `tmp/project-visual-polish-y6-target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,208,966 bytes
  - SHA-256:
    `640B6A6FEF7E6DD34D92A78498C5C7EDE86E2E72E1A1E208DE1247A1C6139BBC`

## Safety boundary and deferred work

- Browser and native checks used sanitized fixtures or isolated temporary
  profiles.
- No real author manuscript, provider credential, or paid AI request was used.
- The legacy repository remained read-only.
- Person/world grouping drag remains a separate product gate.
- Y7 performance, memory, second-start, real-provider, and human cutover gates
  remain separate hardening work.
