# Phase 1.2A Gate C quiet writer workspaces acceptance

Date: 2026-07-29

## Outcome

Gate C is accepted. Writing Buddy now organizes the existing product around
the author's five primary tasks:

- **写作** — project dashboard, chapter tree, manuscript, and quiet writing;
- **规划** — plots and foreshadowing;
- **资料** — the existing Story Kernel reference center;
- **检查** — the existing review center;
- **历史** — the existing version center.

Existing command IDs and routes remain available. In particular, the legacy
search surface is still reachable with `Ctrl/Cmd+Shift+F`; no Story resource,
AI action, persistence engine, or router was replaced.

## Workspace contract

Writer sessions now use schema version 2 and keep one independent layout for
each workspace: writing, planning, reference, review, and history. Version 1
sessions migrate by applying their former panel state to the active workspace.

Each preset remembers sidebar, assistant, inspector, and dock visibility plus
their geometry. Switching workspaces keeps the current resource open, applies
the selected preset, and saves subsequent manual changes only to that preset.
A reset action restores the active workspace's defaults.

Writing defaults to:

- chapter sidebar visible at 272 px;
- assistant and bottom dock closed;
- editor using the remaining width;
- 180 ms column/row layout transitions;
- reduced-motion users receiving the existing 0.01 ms override.

## Quiet writing and focus mode

When a resource is open, the writing top bar keeps project/chapter context,
search, explicit save state, focus, and a compact More menu. New-project and
high-weight AI actions no longer remain permanently visible while writing.
Chapter navigation and the existing continuation actions live under the
chapter More menu. The status bar shows only chapter word count, pending count,
and explicit save state.

Focus mode is a temporary overlay:

- global navigation, chapter sidebar, assistant, dock, tabs, and status bar
  are hidden;
- chapter identity, manuscript, save state, and an explicit exit control stay
  visible;
- `F11` enters/exits and `Escape` exits;
- the normal workspace geometry is unchanged;
- focus state is never persisted.

## Test-first evidence

The initial red tests proved that no workspace-preset module existed, the old
navigation labels were still primary, and `F11` had no writer-focus behavior.
The completed suite covers:

- strict workspace-layout parsing, immutable updates, defaults, and rail
  mapping;
- version 1 to version 2 session migration;
- independent writing/planning geometry and reset;
- manual layout persistence through Zustand rehydration and project reopen;
- resource preservation while switching workspaces;
- quiet top/status bars and deferred AI actions;
- `F11`, `Escape`, focus non-persistence, and normal-layout restoration;
- 1024/1280 responsive rules, keyboard accessibility, focus restoration, and
  reduced motion.

| Gate | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Targeted final Gate C checks | 3 files / 13 tests passed |
| Complete Vitest suite | 110 files / 400 tests passed |
| Production frontend build | Passed |
| Cargo format | Passed |
| Rust tests | 52 passed / 2 explicit external gates ignored |
| Tauri Release executable | Built |
| NSIS installer | Built |
| Native executable smoke | Responsive `Writing Buddy`; normal close; exit 0 |

## Real interaction acceptance

The browser fixture restored **第二章 迷路的旅人** and both open tabs. Real
interaction then verified:

- the five primary workspace labels;
- the quiet writing top bar and closed assistant/dock;
- planning opens the existing plot surface without losing the chapter;
- returning to writing restores the same chapter and writing layout;
- manually hiding the chapter sidebar survives a full page reload and
  Continue;
- focus hides the shell while retaining the chapter and save state;
- the explicit focus exit restores the normal layout.

Automated keyboard tests independently verify `F11` and `Escape`.

Responsive screenshots were rendered from the live application at exact
viewport sizes. The 1024 run exposed top-bar/sidebar launcher clipping; Gate C
fixed it before the evidence was recaptured.

- `docs/acceptance/screenshots/phase-1.2a/02-gate-c-quiet-writing-1280x720.png`
- `docs/acceptance/screenshots/phase-1.2a/03-gate-c-focus-writing-1280x720.png`
- `docs/acceptance/screenshots/phase-1.2a/04-gate-c-responsive-1536x992.png`
- `docs/acceptance/screenshots/phase-1.2a/05-gate-c-responsive-1280x800.png`
- `docs/acceptance/screenshots/phase-1.2a/06-gate-c-responsive-1024x720.png`

## Build artifacts

- Portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,620,608 bytes
  - SHA-256
    `28205BB51B169CB7F9A3DACA4DE9F365C1A1F85150FA7FBFCAA36BEA4F0825AD`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,427,514 bytes
  - SHA-256
    `91A51433F8DFAD995F462E221A3AE9935BD6F58F7AEA82AB81BDF870309684D0`

Both are unsigned internal builds.

## Stop line

Phase 1.2A stops here after Gates A–C. Gate C adds no Quick Capture, Entity
Peek, contextual AI menu, Writer Navigator, chapter organization, new AI
action, or new Story resource type. Gate D remains unstarted pending user
review.
