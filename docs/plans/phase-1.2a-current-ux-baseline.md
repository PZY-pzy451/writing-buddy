# Phase 1.2A current UX baseline

Date: 2026-07-29

Source commit: `91d2c553`

Environment: Windows x64, Node `24.14.0`, pnpm `10.32.1`, Rust/Tauri from the
checked-in toolchain and lockfiles

## Baseline user journey

The current application restores the most recent project directly into an
editor. It does not show an explicit Continue Writing card or a restoration
status. At 1536×992, the default editor is simultaneously surrounded by:

- a 64 px global rail;
- a 320 px project sidebar;
- a full top bar;
- a chapter header with repeated save and word-count controls;
- a 360 px writing assistant;
- a 240 px task dock;
- a status bar.

The result is functional but manuscript-light: the right assistant and bottom
dock reopen even when the author did not ask for them in the previous process,
and AI continuation is a permanent high-weight header action.

Current screenshot:
[00-current-baseline-1536x992.png](../acceptance/screenshots/phase-1.2a/00-current-baseline-1536x992.png)

## Startup and restoration observations

### Real release desktop smoke

The freshly built release EXE was launched from:

`apps/desktop/src-tauri/target/release/writing-buddy-next.exe`

The native window reached a non-zero window handle and reported responsive in
`604 ms`. The real desktop restored its existing recent project and chapter
without an error dialog, and accepted a normal `CloseMainWindow` request.
This is a shell-visible measurement, not a claim that Monaco was already ready
for input at 604 ms.

### Repeatable browser fixture measurements

The local Vite fixture was reloaded three times after dependency warm-up. Each
run waited for the visible application banner and then the Monaco
`Editor content` textbox.

| Run | reload returned | shell visible | restored editor ready |
| ---: | ---: | ---: | ---: |
| 1 | 72 ms | 940 ms | 982 ms |
| 2 | 67 ms | 619 ms | 654 ms |
| 3 | 73 ms | 609 ms | 640 ms |
| Median | 72 ms | 619 ms | 654 ms |

Chapter switches, measured from clicking an already listed chapter until its
heading was visible, took `364 ms`, `333 ms`, and `309 ms` (median `333 ms`).

Interpretation:

- shell visible is comfortably below the suggested 2 s budget;
- restored editor ready is below the suggested 10 s budget in this fixture;
- recent project interactive is below 5 s in the fixture and visibly restored
  in the release desktop;
- cached chapter opening narrowly misses the suggested `< 300 ms` target in
  all three recorded switches.

These are local measurements on a small fixture. They are retained as a
relative baseline, not generalized hardware guarantees.

## Automated baseline

Only commands that exist in the repository were run.

| Command | Result | Measured elapsed |
| --- | --- | ---: |
| `pnpm install --frozen-lockfile` | PASS; 16 workspace projects, 267 packages reused from the local store | 11.2 s |
| `pnpm lint` | PASS; ESLint with `--max-warnings 0` | 18,901 ms |
| `pnpm typecheck` | PASS; root TypeScript project, no emit | 6,292 ms |
| `pnpm test` | PARTIAL; 105 test files passed, 1 failed; 380/382 tests passed | 31,724 ms |
| `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check` | PASS | 535 ms |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS; 52 passed, 2 explicit external/performance gates ignored | 59,402 ms including cold compilation |
| `pnpm tauri:build` | PASS; Vite production build, release EXE, and NSIS installer produced | 174,476 ms |

Tauri artifacts:

- portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`;
- installer:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`.

The production Vite step transformed 2,953 modules in 622 ms. It emitted a
known chunk-size warning: the Monaco chunk is approximately 3.29 MB
uncompressed / 842 KB gzip.

## Existing frontend test blocker

The two failing tests are both in
`apps/desktop/src/theme/workspaceLayout.test.ts`:

1. “lets dashboard and system pages override the closed dock editor rows”;
2. “removes closed sidebars from inline and compact story layouts”.

Both assertions search CSS source strings containing hard-coded LF line
breaks. The Windows worktree contains CRLF, so `indexOf()` returns `-1` or
`toContain()` fails even though the expected CSS rules are present. This is a
test portability defect, not a detected layout behavior regression.

Gate C necessarily modifies the same layout contract. Its first test change
must normalize source line endings so the baseline suite is meaningful on
Windows; the product CSS must not be changed merely to satisfy an LF-only
assertion.

## Current capability matrix

| Experience | Present now | Missing / unreliable now |
| --- | --- | --- |
| Recent-project launch | Opens last root automatically | No Continue Writing presentation; moved root has no identity recovery |
| Active chapter/tab | Stable ID and valid-tab filtering | Global rather than per-project tab/session record |
| Cursor/scroll | Per-project/resource cursor and scroll, 180 ms debounce | No text-anchor/paragraph fallback or explicit flush |
| Scene | Derived from cursor and scene ranges | No persisted active scene or deleted-scene fallback message |
| Pane sizes | Sidebar/assistant/dock dimensions persist | Assistant/dock visibility does not; focus is persisted incorrectly |
| Tree | Current project tree works | Expanded nodes are not persisted |
| Save | Atomic hash-checked manual save, dirty text, conflict dialog | No autosave; no saving/offline/failed state union |
| Close | Dirty manuscript asks before exit | No session flush or saving/failed close policy |
| Focus | Hides rail, sidebars, assistant, dock, tabs, and status | Full top bar remains; no Esc/F11 exit; normal layout state is not isolated |
| Story data | Strict resources, Evidence/Mentions, backlinks, extraction | Inline Peek and Quick Capture intentionally absent |
| AI | Registry, Context Pack, structured output, diff, stale, snapshot, undo, jobs | Contextual action reduction intentionally absent |
| Search | Visible current-project input | Displayed Ctrl+K is not wired; no Writer Navigator |

## Known blockers and risks for Gate B/C

- Persisted workspace data has no version/validation/migration boundary.
- Session data is one global record, so switching among projects can restore
  tabs and layout from the wrong project.
- `assistantOpen` and `dockOpen` default to true and are not persisted.
- `focusMode` is persisted and can relaunch as a permanent layout.
- no explicit session flush occurs at native close.
- a deleted active chapter is safe but produces an empty state instead of a
  nearby-chapter Continue Writing fallback.
- cursor restoration is line/column-based only; manuscript edits can make the
  exact location stale.
- save state is only clean/dirty; Gate B/C can improve clear wording for these
  states but the complete offline/failure model remains later Phase 1.2A work.
- the top and writer headers repeat save state and permanently elevate AI.
- current first-level navigation names system modules rather than writer
  tasks.

## Gate A decision

Gate A is ready to pass once these two baseline documents and the screenshot
are committed. Gate B should extend the existing persisted state and dashboard
rather than introduce a new project-side session file. Gate C should build on
the existing resize/grid system and preserve route IDs.
