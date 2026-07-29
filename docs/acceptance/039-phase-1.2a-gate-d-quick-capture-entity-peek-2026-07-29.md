# Phase 1.2A Gate D quick capture and entity peek acceptance

Date: 2026-07-29

## Outcome

Gate D is accepted. An author can capture an idea from the manuscript without
editing the draft or leaving the chapter, defer its structure to the existing
task dock, convert it into an existing Story resource type, and inspect an
exactly linked Story resource inline.

The implementation adds no AI action, Story resource type, router, editor
model, or parallel Story repository. Contextual AI, chapter organization, and
Writer Navigator remain outside this gate.

## Reused implementation

- Monaco selection, cursor, paragraph text, focus, and existing editor route.
- `createTextAnchor` / `resolveAnchor` for portable manuscript locations.
- `MentionLink` for exact manuscript-to-resource links and backlinks.
- Story Repository create-only commits, snapshots, and existing resource
  routes.
- Existing task dock, status bar, global create menu, selection toolbar,
  desktop bridge, project lock, atomic filesystem writer, and backup archive.

## Added modules

- A strict, versioned `QuickCapture` model and project-side store.
- A capture dialog with five lightweight types and four entry points.
- A **待整理** task-dock view and formal-resource conversion service.
- Exact MentionLink lookup, on-demand Entity Peek service, overlap chooser,
  inline Peek card, and search-result Peek entry.

## Data and recovery

Quick Captures are author-owned project data in
`.writing-buddy/inbox/quick-captures.json`. Missing state opens as an empty
versioned collection. The native boundary enforces the project write lock,
2 MB limit, structural validation, unique IDs, expected-hash concurrency, and
atomic replacement.

The file participates in normal author-data snapshots and project backups.
Formal conversion creates the canonical pre-destructive snapshot, uses a
deterministic capture-derived resource ID with create-only semantics, retains
`convertedResourceId`, and creates an exact source MentionLink when its anchor
still resolves. A retry cannot silently duplicate either resource or backlink.
No data migration is required; existing projects lazily gain the file on the
first capture.

## Behavior acceptance

Quick Capture is reachable from:

- `Ctrl/Cmd+Shift+Space`;
- the status-bar **快速记录** action;
- the global **新建** menu;
- the selection toolbar **记录想法** action.

The selection entry seeds the exact selected text. Other entries associate the
trimmed paragraph around the cursor when available. `Ctrl/Cmd+Enter` saves,
`Escape` closes, and both paths restore Monaco focus without changing the
chapter or manuscript. Writing remains uninterrupted and no AI request is
made.

The **待整理** tab groups captures by chapter and exposes 44 px controls for
formal conversion, source jump, later, and ignore. Conversion can target the
existing character, location, item, foreshadowing, or world-rule resources.

`Ctrl/Cmd+click` opens Peek only for an active exact MentionLink. Hover is
available only for resource kinds the author has explicitly highlighted.
Overlapping exact links show a chooser. Peek loads one selected Story resource
and backlinks on demand; ordinary click, close, and `Escape` do not change the
chapter route or scroll. `Enter` and **打开完整资料** are the explicit route-
changing actions.

## Automated tests

The initial red tests proved the model/store/conversion and Peek services did
not exist. The completed coverage includes:

- strict parsing, serialization, paragraph/selection anchoring, and malformed
  state rejection;
- missing-file reads, expected-hash conflicts, browser/native parity, project
  locking, size/shape validation, snapshot and backup inclusion;
- deterministic create-only conversion, exact source backlink, and retry
  idempotency;
- dialog save/Escape behavior, focus restoration, all four entry points,
  project count, dock operations, and source jump;
- exact-link-only Peek, overlap selection, on-demand loading, route
  preservation, Enter/Escape, and search-result Peek.

| Gate | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Targeted Gate D checks | 7 files / 17 tests passed |
| Complete Vitest suite | 118 files / 418 tests passed |
| Production frontend build | Passed |
| Cargo format | Passed |
| Rust tests | 53 passed / 2 explicit external gates ignored |
| Tauri Release executable | Built |
| NSIS installer | Built |
| Native executable smoke | Responsive `Writing Buddy`; normal close; exit 0 |

The change-aware reports are written to the ignored
`artifacts/self-test/latest.json`; the final full and release console logs are
under `artifacts/self-test/gate-d-final/` and
`artifacts/self-test/gate-d-release/`.

## Real interaction and responsive acceptance

The live browser fixture verified:

- selected-text capture, global shortcut capture, persisted count, inbox
  grouping, formal conversion, and immediate exact source Peek;
- editor focus restoration after save and close;
- inline Ctrl-click Peek while the chapter title and route remain unchanged;
- Story search Peek while the search surface remains open;
- no page-level horizontal or vertical overflow at 1536×992, 1280×800, or
  1024×720;
- a 560×426 capture dialog fully inside the 1024×720 viewport;
- 44 px inbox conversion, jump, later, and ignore targets;
- zero browser console/page errors after a clean reload and shortcut exercise.

Peek and capture felt immediate in the local fixture. Gate D adds no startup
load of the full Story database: a Peek fetches one selected resource only.
No synthetic performance number is reported as a measured production latency.

Screenshots:

- `docs/acceptance/screenshots/phase-1.2a/07-gate-d-search-peek-1280x800.png`
- `docs/acceptance/screenshots/phase-1.2a/08-gate-d-quick-capture-1024x720.png`
- `docs/acceptance/screenshots/phase-1.2a/09-gate-d-inbox-1536x992.png`
- `docs/acceptance/screenshots/phase-1.2a/10-gate-d-inline-peek-1280x800.png`

## Build artifacts

- Portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,628,288 bytes
  - SHA-256
    `D4FFB48A6CFCF2EC072E36F6A1BDDBFE866C97CF81EFCFE77DAA9746302A4255`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,435,978 bytes
  - SHA-256
    `6EB60E08ECA5D09C2869761160FF3FC9300AE5D7C6671E01BF75E92A0CC4CA25`

Both report product/file version 0.1.0 and are unsigned internal builds.

The portable executable was launched as isolated PID 19584 with a fresh
WebView data directory. It reached input idle, exposed a responsive window
titled `Writing Buddy`, accepted `CloseMainWindow`, and exited within the
timeout with code 0.

## Known issues

- The build host exposes Node 25.2.1 while the repository declares Node 24.x.
  pnpm reports the engine mismatch, but all required frontend, Rust, and
  packaging gates pass.
- The existing production bundle still emits its known Monaco chunk-size
  advisory. Gate D does not increase startup data loading or add a resident
  process.

## Git and stop line

Gate D uses the exact feature commit:

`feat: add quick capture and inline story reference`

Stop after this commit. Do not enter Gate E without a new user direction.
