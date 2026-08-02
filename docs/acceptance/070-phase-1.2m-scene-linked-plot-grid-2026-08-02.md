# Phase 1.2M scene-linked plot grid acceptance

Date: 2026-08-02

## Accepted outcome

Writing Buddy now exposes the relationship between planning and real manuscript
scenes without creating a second story model.

- `剧情线与伏笔` has a third `场景网格` view beside the lifecycle board and
  foreshadowing table.
- Rows are existing Story Kernel scenes in manuscript order. Columns are existing
  plot threads, so authors can scan which real scene advances which thread.
- The fixed scene column keeps chapter, title, goal and conflict visible while
  the plot columns scroll inside the workspace.
- Search and task filters expose unlinked scenes, incomplete scene beats and
  associations that need synchronization.
- Reciprocal links are explicitly distinguished from scene-only, thread-only,
  unknown-thread and missing-scene references. The grid never claims a one-sided
  record is healthy and never silently drops it.
- Selecting a scene opens its goal, conflict, turn, outcome and plot links. The
  existing evidence-navigation contract opens the exact manuscript range.
- The grid is read-only and performs no project write or AI request.

## Responsive interaction repair

The documented UI/UX rules were applied directly because the optional skill
search helper was not present in the installed package.

- The first browser pass caught a 42 px search input inside a 44 px wrapper. The
  actual input is now 44 px.
- The second pass caught the narrow-window scene inspector covering still-focusable
  grid controls. Below 1280 px, scene detail now replaces the grid inside the
  workspace and provides a 44 px close action; closing returns to the full grid.
- The repository visual contract caught one-off 13/15/17 px icon sizes. All new
  control icons now use the shared 16/18 px tiers.

## Real browser journey

The bundled in-app browser connection hit the same initialization conflict twice,
so the repository's isolated Edge/CDP driver exercised the same browser bridge and
visible workflow:

1. Opened the fixture project and entered `规划` → `剧情线与伏笔`.
2. Selected `场景网格` and verified one real scene, two real plot-thread columns
   and one reciprocal scene/thread advance.
3. Verified the inspector begins closed so the grid receives the full workspace.
4. Exercised the `节拍待补` filter, search-empty state and clear action.
5. Opened `雨夜旧车站`, verified all four scene beats and then opened its real
   manuscript range in the chapter editor.

| Viewport / surface | Overflow X/Y | Clipped controls | Controls below 44 px | Occluders | Runtime errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1440×900 scene grid | 0 / 0 | 0 | 0 | 0 | 0 |
| 1024×720 scene grid | 0 / 0 | 0 | 0 | 0 | 0 |
| 820×720 scene grid | 0 / 0 | 0 | 0 | 0 | 0 |
| 820×720 filtered empty state | 0 / 0 | 0 | 0 | 0 | 0 |
| 820×720 scene inspector | 0 / 0 | 0 | 0 | 0 | 0 |

The 820 px grid uses an internal horizontal scrollbar; the application page itself
does not overflow.

Evidence:

- [Visual metrics](./phase-1.2m-scene-plot-grid-visual-metrics.json)
- [Scene grid, 1440×900](./screenshots/phase-1.2m-scene-plot-grid/01-scene-plot-grid-1440x900.png)
- [Scene grid, 1024×720](./screenshots/phase-1.2m-scene-plot-grid/02-scene-plot-grid-1024x720.png)
- [Scene grid, 820×720](./screenshots/phase-1.2m-scene-plot-grid/03-scene-plot-grid-820x720.png)
- [Filtered empty state, 820×720](./screenshots/phase-1.2m-scene-plot-grid/04-filtered-empty-820x720.png)
- [Scene inspector, 820×720](./screenshots/phase-1.2m-scene-plot-grid/05-scene-inspector-820x720.png)

## Automated verification

| Gate | Result |
| --- | --- |
| Focused model/page regressions | 2 files / 5 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 166 files / 670 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 74 passed / 2 explicit external gates ignored |
| Full self-test | Passed |
| Release self-test | Passed |
| Tauri Release and NSIS | Passed |

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 45036 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2m-scene-plot-grid-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,729,572 | `8C6EB900CA022C0A9182DB6C812D2F74AB5BE0607EDA1C44006EDEA40550C146` |
| `Writing-Buddy-portable.exe` | 8,577,024 | `0E61C66F20C2AE52A4C27A435DCAB2B7B0867EAE24FDCF18897618C7C01FCE6F` |

The same values are machine-readable in `SHA256.json` beside the binaries.
