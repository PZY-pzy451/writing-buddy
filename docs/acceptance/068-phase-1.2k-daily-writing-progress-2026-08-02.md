# Phase 1.2K daily writing progress acceptance

Date: 2026-08-02

## Accepted outcome

Writing Buddy now gives authors a quiet, project-specific daily writing loop.

- The editor records signed manuscript word deltas against the author's local
  calendar day. Existing prose opened or imported into the application adds
  nothing; undo and failed AI insertion rollback remove their credited words;
  today's value never falls below zero.
- A guarded local ledger retains at most 120 valid days for at most 50 projects.
  Malformed persisted records are discarded and invalid goals fall back to
  1,000 words. Projects cannot read or change one another's progress.
- The daily goal accepts integer values from 100 through 100,000 words. Its
  secondary disclosure gives an adjacent validation message and states that
  the value is a local net-new manuscript count, not a project-file mutation.
- Writing Home, the chapter header and the status bar share the same state. The
  status bar gives today's result priority on narrow windows; no new navigation
  destination or analytics dashboard was added.

## Real browser journey

The isolated Edge/CDP acceptance completed this exact journey against the
browser bridge:

1. Opened the fixture project and observed `0 / 1,000`.
2. Changed the project goal to 1,200 through the visible form.
3. Reloaded the application and observed `0 / 1,200`.
4. Opened the current chapter, appended 13 manuscript words and saved.
5. Reloaded again and observed `13 / 1,200` on Writing Home.

The first narrow capture exposed that the goal disclosure entered a clipped
sidebar region and could be covered by editor tools. The final implementation
uses a two-row writer header, a 260 px narrow disclosure, an explicit stacking
order and an acceptance check for ancestor clipping and external-control
occlusion.

| Viewport | Page overflow X | Clipped controls | Goal controls below 44 px | Goal occluders | Runtime errors |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1440×900 | 0 | 0 | 0 | 0 | 0 |
| 1280×800 | 0 | 0 | 0 | 0 | 0 |
| 1024×720 | 0 | 0 | 0 | 0 | 0 |
| 820×720 | 0 | 0 | 0 | 0 | 0 |

Evidence:

- [Visual metrics](./phase-1.2k-daily-writing-progress-visual-metrics.json)
- [Writing Home goal, 1440×900](./screenshots/phase-1.2k-daily-writing-progress/01-dashboard-goal-1440x900.png)
- [Writer goal, 1280×800](./screenshots/phase-1.2k-daily-writing-progress/02-writer-goal-1280x800.png)
- [Writer goal, 1024×720](./screenshots/phase-1.2k-daily-writing-progress/03-writer-goal-1024x720.png)
- [Writer goal, 820×720](./screenshots/phase-1.2k-daily-writing-progress/04-writer-goal-820x720.png)

## Automated verification

| Gate | Result |
| --- | --- |
| Focused progress/store/dashboard/writer regressions | 4 files / 31 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 164 files / 659 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 74 passed / 2 explicit external gates ignored |
| Full self-test | Passed |
| Release self-test | Passed |
| Tauri Release and NSIS | Passed |

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 42904 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2k-daily-writing-progress-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,725,401 | `29E815AD1082C654CC3182CF2E82D48C293014E586758AD63F11A7CA5E1F3D33` |
| `Writing-Buddy-portable.exe` | 8,572,928 | `879AB216FA50BE9BE0FD8AA383C563FF402FE40B74B3DAEC4E18D374FD274FC5` |

The same values are machine-readable in `SHA256.json` beside the binaries.
