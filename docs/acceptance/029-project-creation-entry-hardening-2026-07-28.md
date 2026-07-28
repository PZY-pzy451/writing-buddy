# Project creation entry hardening acceptance — 2026-07-28

## Outcome

Project creation is now exposed as an explicit **新建项目** feature rather than
being discoverable only through “新建作品” wording.

- The no-project welcome, compact project shelf, and global create menu use
  project terminology.
- The previously inert project overflow control is now an accessible project
  action menu with **新建项目** and **打开项目**.
- Both project menus focus the first action, support Up/Down/Home/End, close on
  Escape, and restore trigger focus.
- Creating from an open project with a dirty manuscript warns before any
  filesystem transaction. Cancelling leaves the current project and unsaved
  content intact and does not call the creation bridge.
- The existing four-step wizard, six templates, typed preflight, verified
  staging, atomic rename, automatic reopen, first-chapter opening, appearance
  restore, and recent-project persistence remain the canonical creation path.

## Automated validation

| Gate | Result |
| --- | --- |
| Focused creation UI | 1 file / 5 tests passed |
| `pnpm acceptance` | 97 files / 337 tests passed |
| ESLint | zero warnings |
| TypeScript | passed |
| Vite production build | passed |
| `cargo fmt --check` | passed |
| `cargo test` | 51 passed / 2 explicit external gates ignored |

One existing association-fixture test observed empty data during an earlier
parallel full-suite attempt. Its isolated rerun and the final complete
acceptance run both passed; no unrelated product code was changed.

## Visual and interaction evidence

The final project-menu matrix covers Paper and Midnight at 1536×992,
1280×800, and 1024×720:

- no document-level horizontal overflow;
- menu fully inside both the viewport and project sidebar;
- 50px menu-item height and 44px trigger;
- no wizard control below 44px;
- no browser console or page errors.

The first 1024px inspection found the 252px menu extending 31px beyond the
sidebar and being visibly clipped. The project-specific menu was reduced to a
220px safe width; the final menu spans x=79–299 inside the x=78–318 sidebar.

The browser flow created **新建项目视觉验收**, opened its first chapter,
restored Midnight, and persisted
`D:\WritingBuddy\Projects\新建项目视觉验收` as the newest recent project.

| Evidence | Capture |
| --- | --- |
| Empty workspace project entry | [01 welcome](./screenshots/project-creation-entry-hardening/01-welcome-paper-1536x992.png) |
| Open-project action menu, Paper | [02 Paper menu](./screenshots/project-creation-entry-hardening/02-open-project-menu-paper-1536x992.png) |
| Wizard basics, Paper | [03 basics](./screenshots/project-creation-entry-hardening/03-wizard-basics-paper-1536x992.png) |
| Final review with Midnight selected | [04 review](./screenshots/project-creation-entry-hardening/04-wizard-review-paper-midnight-choice-1280x800.png) |
| Created-project menu, Midnight compact | [05 Midnight menu](./screenshots/project-creation-entry-hardening/05-created-project-menu-midnight-1024x720.png) |
| Compact wizard, Midnight | [06 compact wizard](./screenshots/project-creation-entry-hardening/06-wizard-basics-midnight-1024x720.png) |

Machine-readable results:
[project creation entry metrics](./project-creation-entry-hardening-visual-metrics.json).

The in-app browser client could not initialize in the protected runtime
because it attempted to redefine `process`. Visual acceptance used the
installed Microsoft Edge binary through the existing Playwright QA runtime.

## Native artifacts

Fresh one-job Tauri Release and NSIS packaging completed.

- Portable EXE:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,403,008 bytes
  - SHA-256:
    `904F36A78F7375C929419D8A94AE9D2E0807C18409B9C01AFE5B179C8C68ADA7`
- NSIS installer:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,209,525 bytes
  - SHA-256:
    `7ABD4FE2C35A10A309BB76007B4FD36077CF08B173DFD05D18C8B218E579051F`

The isolated native smoke launched PID `53164`, reached input idle, remained
responsive with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally with code 0.
