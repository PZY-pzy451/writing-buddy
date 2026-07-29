# Phase 1.2A Gate B session restore acceptance

Date: 2026-07-29

## Outcome

Gate B is accepted. Writing Buddy now keeps one validated writer session per
project and opens the recent project on its story dashboard with a
**继续上次位置** action.

The session contract records:

- stable project, chapter, scene, resource, and open-tab IDs;
- chapter cursor line/column and editor scroll position;
- expanded project-tree nodes;
- project sidebar, assistant, and dock visibility and geometry;
- writer workspace and last-edit timestamp.

Focus mode is intentionally normalized to off during restore because it is a
temporary concentration overlay, not durable project state.

## Recovery behavior

Restore runs before the dashboard becomes actionable and reconciles the stored
session against the freshly opened project:

- deleted resources and duplicate tabs are removed;
- deleted chapters fall back to the first available chapter;
- deleted scenes and stale anchors fall back to a valid chapter position;
- invalid tree nodes are discarded;
- corrupt, foreign-project, or unsupported session data is safely rebuilt;
- a readable dashboard notice explains any fallback;
- no recovery path writes to the author's project.

Legacy global tab/cursor state is migrated once when there is no project-scoped
session map. Switching projects thereafter keeps their sessions isolated.

## Test-first evidence

The initial red tests proved that no writer-session module existed and the
dashboard always selected the first chapter. The completed suite covers:

- strict parse and corrupt-data rejection;
- deleted chapter, scene, anchor, resource, and tree-node fallback;
- foreign-project rejection;
- dashboard selection of the persisted chapter and position;
- project-level cursor, scroll, tabs, pane geometry, tree expansion, and scene
  persistence;
- isolation while switching projects;
- synchronous close/page-hide flush.

| Gate | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Targeted Gate B tests | 3 files / 12 tests passed |
| Complete Vitest suite | 108 files / 390 tests passed |
| Production frontend build | Passed |
| Tauri Release executable | Built |
| NSIS installer | Built |
| Native executable smoke | Responsive `Writing Buddy`; normal close; exit 0 |

The two pre-existing Windows EOL failures from Gate A were repaired by
normalizing CRLF before CSS contract assertions.

## Real interaction acceptance

The browser fixture was opened, chapter two was selected, and the second
volume was collapsed. After a real page reload:

- the dashboard showed **第二章 迷路的旅人**;
- the primary action was **继续上次位置**;
- the second volume remained collapsed;
- clicking Continue restored chapter two;
- both previously open chapter tabs were present.

Screenshot:

- `docs/acceptance/screenshots/phase-1.2a/01-gate-b-session-restore-1280x720.png`

## Build artifacts

- Portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`

Both are unsigned internal builds. Final delivery remains gated on Gate C and
the complete Phase 1.2A verification pass.

## Stop line

Gate B adds no Quick Capture, Entity Peek, contextual AI menu, Writer
Navigator, chapter organization, new AI action, or new Story resource type.
Those remain beyond the Gate A–C delivery scope.
