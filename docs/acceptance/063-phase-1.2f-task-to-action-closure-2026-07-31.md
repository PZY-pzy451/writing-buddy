# Phase 1.2F task-to-action closure acceptance

Date: 2026-07-31

Result: accepted

## Outcome

Phase 1.2E made the author journey visible. Phase 1.2F removes two remaining
dead ends: Check can now select and open a concrete chapter without first
returning to Writing, and the global New menu routes author intent into the
existing planning or Story Library assistant instead of showing disabled
future placeholders.

## Delivered contract

| Area | Accepted behavior |
| --- | --- |
| Check inbox | Shows project-level open issue, affected chapter and AI counts before a chapter is active |
| Next review task | Prioritizes the first chapter with an open issue; otherwise offers the first chapter as a bounded inspection target |
| Review action hierarchy | Exactly one enabled primary action before a chapter opens; running local or AI review remains a separate explicit action |
| Global New | Keeps New project, Open project, New chapter and Quick Capture |
| Contextual creation | Routes structure, plot/foreshadowing, character, world, item and timeline intent to existing workspaces |
| AI boundary | Opens the relevant assistant but never starts AI or writes a Story resource automatically |
| Read-only safety | Contextual creation stays disabled for read-only projects |
| Compatibility | No project, review or Story Kernel schema migration; contextual intent is ephemeral |

## Automated acceptance

`pnpm self-test:full` passed from the isolated worktree.

| Gate | Result |
| --- | --- |
| Diff and conflict-marker checks | Passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Vitest | 160 files, 633 tests passed |
| Production Vite build | Passed; 2,990 modules transformed |
| Cargo format | Passed |
| Rust tests | 68 passed, 0 failed, 2 explicit external gates ignored |
| Tauri Release | Passed |
| NSIS bundle | Passed |

The two ignored Rust tests remain the established externally invoked sanitized
real-project recovery and release performance gates.

## Browser and responsive acceptance

`pnpm acceptance:phase-1.2f` passed and wrote
`phase-1.2f-task-closure-visual-metrics.json`.

The driver verified:

- all six contextual actions are enabled in an editable project and the old
  `下一阶段启用` placeholders are absent;
- New → Create character changes to Story Library / People and opens the
  existing assistant with no generated candidate;
- Check exposes exactly one enabled primary action without an active chapter;
- opening that task loads the chapter and promotes the explicit review run;
- 1440×900, 1280×800, 1024×720 and 820×720 have no page overflow or clipped
  interactive controls;
- no browser exception or error-level console/log event occurred.

Accepted screenshots:

- [Contextual New menu, 1440×900](./screenshots/phase-1.2f-task-closure/01-contextual-create-menu-1440x900.png)
- [Character assistant, 1280×800](./screenshots/phase-1.2f-task-closure/02-character-assistant-1280x800.png)
- [Review inbox, 1024×720](./screenshots/phase-1.2f-task-closure/03-review-inbox-1024x720.png)
- [Opened review task, 1024×720](./screenshots/phase-1.2f-task-closure/04-review-task-opened-1024x720.png)
- [Compact review, 820×720](./screenshots/phase-1.2f-task-closure/05-review-compact-820x720.png)

The bundled browser-client bootstrap again could not attach in this Windows
session (`Cannot redefine property: process`), so the repository's equivalent
isolated Edge/CDP acceptance driver produced the DOM metrics and screenshots.

## Native Windows smoke

The fresh portable Release was launched with an isolated WebView profile.

| Check | Result |
| --- | --- |
| Process | PID 49916 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes |

## Windows delivery

Directory:
`artifacts/release/phase-1.2f-task-to-action-closure-2026-07-31/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,631,059 | `D81EBF4B59D61678F53DD8B84AEF5A15183260A64FC0EF16B127D377BF0A86D8` |
| `Writing-Buddy-portable.exe` | 8,363,008 | `64EA8E4C297144125D8232167CA9C8485032C68E58DC2F16A142E6DCF5C5185E` |

The same values are machine-readable in the delivery directory's
`SHA256.json`.
