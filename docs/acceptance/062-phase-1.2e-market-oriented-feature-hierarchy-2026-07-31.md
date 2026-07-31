# Phase 1.2E market-oriented feature hierarchy acceptance

Date: 2026-07-31

Result: accepted

## Outcome

Writing Buddy now presents one author journey instead of a flat module list:

`开始故事 → 规划故事 → 写正文 → 管理长期信息 → 检查并完成`

The change is limited to hierarchy, entry points and visual priority. Existing
project files, Story Kernel schemas, AI confirmation, snapshots, recovery and
system routes remain compatible.

## Delivered contract

| Area | Accepted behavior |
| --- | --- |
| Primary navigation | Exactly `写作`, `规划`, `故事库`, `检查`, `历史` |
| New-project home | One primary `根据题材生成大纲`; secondary outline import, manuscript import and blank project starts |
| Existing-project home | Resume, current chapter, next task, pending review and recent activity; no module-count headline |
| Planning | Story hierarchy, plot/foreshadowing and structure checks |
| Story Library | Current-related and pending material first, then people, relationships, world, items, timeline and knowledge |
| Writing sidebar | Volume, chapter and scene structure only |
| Writer tools | Exactly `细纲`, `资料`, `AI`, `检查`; one panel at a time |
| Global actions | Search and New stay global; Quick Capture, Settings and AI diagnostics remain behind More |
| Progressive disclosure | No-project destinations are unavailable; early long-form tools are quiet; draft and long-form projects expose normal priority |
| Safety | Navigation performs no AI call, snapshot, manuscript mutation or Story resource write |

## Automated acceptance

`pnpm self-test:full` passed from the isolated worktree.

| Gate | Result |
| --- | --- |
| `git diff --check` and staged diff check | Passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Vitest | 160 files, 629 tests passed |
| Production Vite build | Passed; 2,990 modules transformed |
| Cargo format | Passed |
| Rust tests | 68 passed, 0 failed, 2 explicit external gates ignored |
| Tauri Release | Passed |
| NSIS bundle | Passed |

The two ignored Rust tests remain the established externally invoked sanitized
real-project recovery and release performance gates; this hierarchy change did
not alter their code paths.

## Browser and visual acceptance

The repository acceptance driver
`scripts/acceptance/validate-phase-1.2e-market-hierarchy.mjs` passed against the
local application and recorded
`phase-1.2e-market-hierarchy-visual-metrics.json`.

Checks include:

- exactly one welcome-page primary action and three secondary starts;
- exactly five primary navigation destinations;
- five task-oriented cards on the existing project home;
- no primary top-bar AI generation action;
- Planning and Story Library content separation;
- current relevance shown before the complete Story Library;
- no page-level horizontal overflow or clipped interactive controls.

Accepted screenshots:

- [Welcome, 1440×900](./screenshots/phase-1.2e-market-hierarchy/01-welcome-1440x900.png)
- [Writing home, 1440×900](./screenshots/phase-1.2e-market-hierarchy/02-writing-home-1440x900.png)
- [Planning, 1024×720](./screenshots/phase-1.2e-market-hierarchy/03-planning-1024x720.png)
- [Story Library, 1024×720](./screenshots/phase-1.2e-market-hierarchy/04-story-library-1024x720.png)

The bundled browser-client bootstrap could not attach in this Windows session
and returned `Cannot redefine property: process`. The repository's equivalent
isolated Microsoft Edge/CDP driver was used for DOM metrics and screenshots;
the production Tauri executable was then verified separately below.

## Native Windows smoke

The newly built production portable executable was launched without a
diagnostic fixture or user project.

| Check | Result |
| --- | --- |
| Process | PID 15704 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Window responding | Yes |
| WebView2 children created after launch | 6 |
| Port 9223 listening | No |
| Port 9751 listening | No |
| Normal close requested | Yes |
| Exited after normal close | Yes |

## Windows delivery

Directory:
`artifacts/release/phase-1.2e-market-oriented-hierarchy-2026-07-31/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,630,341 | `274EDFD35F7819F9CBD151C57794843C0C3E447B89EDEB478B2C8CB846A51AA8` |
| `Writing-Buddy-portable.exe` | 8,363,008 | `24150B5852B80940D4A1D590EF11EBB20F4AA21DE605241B9D35321AD5F387BE` |

The same values are machine-readable in the delivery directory's
`SHA256.json`.
