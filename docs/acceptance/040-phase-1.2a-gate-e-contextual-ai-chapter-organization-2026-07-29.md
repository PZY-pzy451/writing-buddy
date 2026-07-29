# Phase 1.2A Gate E contextual AI and chapter organization acceptance

Date: 2026-07-29

## Outcome

Gate E is accepted. AI assistance now follows the author's immediate writing
context without adding a new AI capability, and a finished chapter can be
explicitly organized through the existing grounded extraction and Story
Kernel confirmation path.

The implementation adds no AI action ID, provider, Prompt, response schema,
Story resource type, candidate store, router, editor model, or background
process. Writer Navigator and save-state redesign remain outside this gate.

## Contextual AI behavior

- Selection Rewrite and Manuscript Continuation remain the only execution
  paths.
- A pure local resolver distinguishes no selection, ordinary prose, and
  conservatively detected dialogue. Ambiguous text falls back to prose; no
  hidden classification request is made.
- The selection toolbar and writing assistant share the same deterministic
  groups. At most four primary actions are visible; secondary actions remain
  under **更多 AI 操作**.
- The contextual menu is portaled outside editor overflow boundaries, closes
  with Escape, and returns focus to Monaco.
- Opening or closing a contextual menu never invokes AI.

## Chapter organization behavior

**更多 → 整理本章** saves a dirty chapter, preserves the current chapter, and
opens the existing extraction center in current-chapter scope. Creating the
plan is local, shows the token estimate, and does not start or resume a paid
job.

Candidates:

- are grouped by Story type with pending, resolved, conflict, and low-
  confidence counts;
- begin unselected, including low-confidence candidates;
- expose exact manuscript Evidence;
- can be rejected or deferred into the existing Quick Capture inbox;
- become visibly stale and non-confirmable if the source manuscript hash has
  changed.

Confirmation still creates one canonical `beforeDestructiveOperation`
snapshot per source batch and uses the existing Story transaction. The latest
confirmation returns an in-memory undo receipt. Undo preflights every resource
revision before mutation, moves newly created resources to recoverable Trash,
restores updated resources, updates the affected candidate states, and refuses
concurrent changes.

## Automated tests

The test-first Gate E coverage proves:

- prose, dialogue, no-selection, and non-writing contextual resolution;
- deterministic action ordering, the four-action cap, existing intent
  dispatch, and editor focus restoration;
- current-chapter entry through the real writer More menu without automatic
  AI;
- grouped and initially unselected candidates, Evidence, reject, defer,
  low-confidence state, and stale-source blocking;
- snapshot-backed create/update confirmation, recoverable create undo, exact
  update restoration, and concurrent-revision refusal.

| Gate | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Targeted Gate E checks | 6 files / 26 tests passed |
| Complete Vitest suite | 120 files / 427 tests passed |
| Production frontend build | Passed |
| Cargo format | Passed |
| Rust tests | 53 passed / 2 explicit external gates ignored |
| Tauri Release executable | Built |
| NSIS installer | Built |
| Native executable smoke | Responsive `Writing Buddy`; normal close; exit 0 |

The change-aware release report is written to the ignored
`artifacts/self-test/latest.json`.

## Real interaction and responsive acceptance

The repository-owned Edge/CDP acceptance script exercised the real dashboard,
chapter, Writer More menu, extraction route, local plan, paid-run fixture, and
selection menu. The installed browser-skill runtime could not initialize in
this environment, so the documented fallback used the repository's existing
real-browser acceptance path rather than weakening the interaction checks.

The Windows target sizes and corresponding browser content viewports were:

| Target | Content viewport | Page overflow X/Y | Clipped controls | Undersized Story controls |
| --- | --- | ---: | ---: | ---: |
| 1536×992 contextual menu | 1536×960 | 0 / 0 | 0 | 0 |
| 1536×992 chapter plan | 1536×960 | 0 / 0 | 0 | 0 |
| 1280×800 grouped candidates | 1280×768 | 0 / 0 | 0 | 0 |
| 1024×720 chapter plan | 1024×688 | 0 / 0 | 0 | 0 |

The 1024 capture exposed a real top-bar clipping risk at the old 1023 px
boundary. Moving the compact contract to 1099 px produced a 78 / 240 / 706 px
rail-sidebar-content grid with no clipped interactive control. The complete
suite also caught and removed five one-off 15 px icons in favor of the shared
16 px icon tier.

Evidence:

- `docs/acceptance/gate-writer-e-visual-metrics.json`
- `docs/acceptance/screenshots/gate-writer-e/01-contextual-selection-actions-1536x992.png`
- `docs/acceptance/screenshots/gate-writer-e/02-current-chapter-plan-1536x992.png`
- `docs/acceptance/screenshots/gate-writer-e/03-grouped-candidates-1280x800.png`
- `docs/acceptance/screenshots/gate-writer-e/04-chapter-organization-1024x720.png`

## Build artifacts

- Portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,632,384 bytes
  - SHA-256
    `1580AC5C4C24C545EF6F557122EDAA68FDBB299F376C1302AA524E08DEA1A99E`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,438,661 bytes
  - SHA-256
    `7A612E59ECADD5826E99279A8E8BA653EF581E7AE1927B16D4CF8B4543D86F09`

Both are internal unsigned 0.1.0 builds.

The portable executable was launched as isolated PID 47448. It exposed a
responsive main window titled `Writing Buddy`, accepted `CloseMainWindow`,
and exited normally with code 0.

## Known advisories

- The build host exposes Node 25.2.1 while the repository declares Node 24.x.
  pnpm reports the engine mismatch, but all required frontend, Rust, packaging,
  browser, and native gates pass.
- The existing production bundle still emits its known Monaco chunk-size
  advisory. Gate E adds no resident process or eager Story database load.

## Git and stop line

Gate E uses the exact feature commit:

`feat: make ai assistance contextual and non disruptive`

Stop after this commit. Do not enter Gate F without a new user direction.
