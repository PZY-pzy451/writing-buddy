# Workspace layout shortcuts acceptance

Date: 2026-07-29

## Outcome

Writing Buddy now exposes global, VS Code-style shortcuts for the three
resizable workspace panes:

| Action | Shortcut |
| --- | --- |
| Toggle project sidebar | `Ctrl+B` / `Cmd+B` |
| Toggle writing assistant | `Ctrl+Alt+B` / `Cmd+Option+B` |
| Toggle task/review dock | `Ctrl+J` / `Cmd+J` |

The shortcuts work while the manuscript editor retains focus. Button titles,
`aria-keyshortcuts`, and Settings > Appearance make the mappings discoverable.
Project-sidebar visibility persists independently from its retained width.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused shortcut/layout tests | 4 files / 11 tests passed |
| `pnpm acceptance` | 101 files / 351 tests passed; production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 51 passed / 2 explicitly ignored / 0 failed |
| `pnpm tauri:build` | Release EXE and NSIS installer built |
| Isolated native startup/normal close | PID 39440; responsive; exit code 0 |

Unit coverage includes Control and Meta variants, secondary-sidebar dispatch,
default prevention, unrelated modifier rejection, IME composition, repeat
rejection, sidebar state, and geometry preservation.

## Browser interaction evidence

Local Playwright with installed Microsoft Edge exercised the real local app
after the in-app browser could not initialize in its protected runtime.

At 1536x992 with the Monaco manuscript editor focused:

- initial geometry was sidebar 320px, assistant 360px, dock 240px;
- `Ctrl+B` hid the sidebar and expanded the center from 778px to 1098px;
- `Ctrl+Alt+B` hid the assistant and expanded the center to 1458px;
- `Ctrl+J` hid the dock;
- all three reverse shortcuts restored exactly 320/360/240;
- editor focus remained on the textbox and horizontal overflow stayed 0px.

At 1024x768 in Story Studio:

- open sidebar: center x=398px, width=626px;
- closed sidebar: center x=78px, width=946px;
- no empty sidebar track and horizontal overflow stayed 0px.

Closing the sidebar wrote `sidebarOpen: false`; reload restored the closed
state and `Ctrl+B` reopened it. The Settings shortcut reference rendered all
three mappings with no console errors.

Screenshot:
`screenshots/workspace-shortcuts/01-settings-shortcuts-1024x768.png`.

Structured measurements:
`workspace-layout-shortcuts-metrics.json`.

## Windows artifacts

- Portable EXE:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,403,008 bytes
  - SHA-256:
    `D42891D8EE8ACB4433267D371BD91F198D9BD7186016B0B62A64E35B977A64C2`
- NSIS installer:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,210,339 bytes
  - SHA-256:
    `5D3418E0A70554782C06895F44D4FBA7A2FB1A564E01F565A297929B2B320F19`
