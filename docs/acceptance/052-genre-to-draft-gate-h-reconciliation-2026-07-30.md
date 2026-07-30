# Genre-to-Draft Gate H reconciliation acceptance

Date: 2026-07-30

## Gate

Gate H reconciles the current manuscript with its materialized chapter plan in
the existing chapter-organization flow. It does not implement Gate I.

Baseline commit: `93307ab8 feat: connect contextual ai to scene drafting`

Branch: `codex/genre-to-draft-gates-a-c`

## Status

**PASS**

Gate H passed focused and full frontend regression, complete Rust regression,
real browser interaction, Tauri Release/NSIS packaging, and isolated native
Windows startup/normal-close verification.

## Source map and reuse

The implementation extends existing ownership boundaries:

- `ManuscriptExtractionCenterPage` remains the only chapter-organization UI.
- `story-kernel-generation` remains the AI job and provider path.
- `StoryKernelGenerationService` remains the persisted candidate batch,
  Evidence, conflict, confirmation receipt, and rollback path.
- Creation Journey v2 remains the chapter-plan projection, while the project
  manifest remains canonical for materialized chapters.
- `desktopBridge.createSnapshot` remains the only pre-write snapshot command.
- Existing Story Kernel transactions remain the only resource write path.

No second editor, outline store, candidate database, AI runtime, Chapter
model, or Story Kernel resource type was introduced.

## Delivered experience

- “整理本章” now sends the bounded current chapter plan with the same
  StoryForge extraction request.
- The response contains actual summary, goal, conflict, outcome, and hook plus
  at most one exact-Evidence difference per field.
- The UI presents calm `needs_review` status, plan versus actual values, exact
  manuscript Evidence, and explicit author decisions:
  `更新大纲`, `修改正文`, `保留差异`, and `稍后处理`.
- Outline fields and StoryForge resources start with zero selection. Nothing
  writes until the author explicitly checks entries and invokes the single
  `创建快照并批量确认` action.
- Confirmation revalidates the manuscript hash, chapter-plan revision, plan
  lock, journey hash, Story Kernel conflicts, and selected fields before the
  first write.
- Each selected source batch receives one canonical snapshot before resource
  or outline mutation. The browser run selected one outline field and one
  resource, producing one snapshot.
- Only selected outline fields change. Unselected plan fields are preserved
  and adopted values are marked `extracted_from_draft`.
- If the final journey write fails after resource confirmation, the existing
  Story Kernel receipts roll those resource writes back.
- Changing the manuscript or a still-pending plan revision makes the batch
  stale. A resolved reconciliation does not become falsely stale merely
  because its accepted outline update advanced the plan revision.
- Running organization again after the plan matches the manuscript succeeds
  with no differences instead of returning an invalid planned-equals-actual
  item.
- The synchronous busy guard disables repeated generation immediately, so
  repeated clicks do not create duplicate AI jobs.

## AI and structured contracts

TypeScript and Rust now accept one optional, strictly bounded `chapterPlan`
object on `story-kernel-generation`. The request excludes project paths,
credentials, author secrets, unrelated resources, and full-project content.

When a plan is supplied, the strict response must supply `reconciliation`;
when no plan is supplied, the existing candidate-only response remains valid.
Every reported difference:

- uses one of `summary`, `goal`, `conflict`, `outcome`, or `hook`;
- is unique by field;
- has different planned and actual values;
- matches both the submitted plan and returned actual record;
- points to an exact UTF-16 Evidence range in the authoritative manuscript.

Malformed, unbounded, unsafe, mismatched, duplicate, or ungrounded data is
rejected before persistence or write.

## Persistence and migration

Reconciliation state is stored inside the existing source-revision-bound
Story Kernel generation batch. Status is explicit:

- `pending`
- `outline-updated`
- `difference-kept`
- `manuscript-editing`

Existing candidate files and candidate-only responses remain readable. There
is no project migration and no automatic author-content rewrite.

## Automated validation

- Focused Vitest: 5 files / 51 tests passed
- ESLint: PASS
- TypeScript: PASS
- Full Vitest: 150 files / 576 tests passed
- Production build: PASS
- Full self-test: PASS
- Release self-test: PASS
- `cargo fmt --check`: PASS
- Rust: 66 passed / 0 failed / 2 ignored external gates
- Tauri Release: PASS
- NSIS installer: PASS

The tests cover strict request/response parsing, exact Evidence, mismatched
plan/actual rejection, persistence and reopen, resolution, stale manuscript
and plan revisions, locked plans, selected-field-only patches, resolved-state
stability, one snapshot, resource plus outline confirmation, and repeated
organization after alignment.

Self-test report: `artifacts/self-test/latest.json`

## Browser acceptance

A fresh browser project named `Gate H 雨夜旧站` completed the real product
journey through 3 volumes, 9 chapters, 27 scenes, atomic materialization,
chapter editor, and chapter organization.

At 1280×720 the visible run verified:

- immediate duplicate-generation protection;
- plan/actual comparison and one exact Evidence-linked difference;
- zero default outline and resource selections;
- explicit selection of one outline field and one person resource;
- one snapshot followed by one batch confirmation;
- `已更新大纲` and `已写入` terminal states;
- resource-only Undo copy that does not imply outline rollback;
- a repeated generation with no false difference after plan alignment;
- zero console warnings or errors.

The browser pass found and fixed three defects before acceptance:

1. The 1280×720 extraction page clipped vertically instead of scrolling.
2. A resolved outline update was incorrectly marked stale after its own plan
   revision advanced.
3. The deterministic AI fixture emitted an invalid planned-equals-actual
   difference when the user organized an already aligned chapter.

Metrics:
`docs/acceptance/genre-to-draft-gate-h-metrics.json`

Screenshots:

- `docs/acceptance/screenshots/genre-to-draft-gate-h/gate-h-plan-vs-actual-1280x720.jpg`
- `docs/acceptance/screenshots/genre-to-draft-gate-h/gate-h-batch-confirmed-1280x720.jpg`

## Native Windows acceptance

The final portable executable:

- reached input idle;
- exposed one responsive main window titled `Writing Buddy`;
- exposed a non-zero main-window handle;
- accepted a normal close request;
- exited within the bounded wait with code 0.

The smoke used an isolated WebView profile and did not interact with another
Writing Buddy process.

## Deliverables

Directory: `artifacts/release/genre-to-draft-gate-h/`

- `Writing-Buddy-0.1.0-genre-to-draft-gate-h-portable.exe`
  - 8,316,416 bytes
  - SHA-256:
    `ABADD950BE5DF70D8D268592B81C022D324B5666F7BB11C1616C1CBED3EF1E46`
- `Writing-Buddy-0.1.0-genre-to-draft-gate-h-setup.exe`
  - 3,616,583 bytes
  - SHA-256:
    `C2C14DE42C57A6A852CCD0EA06222EAA575DDCDA46362C7D656F889ACE1A807F`

Checksums:
`artifacts/release/genre-to-draft-gate-h/SHA256SUMS.txt`

The release build used Node 24.14.0.

## Known issues

- The Windows artifacts are unsigned and may show a SmartScreen warning.
- Vite retains the existing large Monaco chunk warning. It does not affect
  Gate H behavior, tests, packaging, or startup.
- Real DeepSeek quality still requires the user's own configured account; the
  acceptance AI response was deterministic, while persistence, snapshots,
  outline updates, resource writes, reopen, and native packaging were real.
- Gate I has not started.

## Git

Commit target: `feat: reconcile draft changes with story plans`

## Recommendation

Accept Gate H and stop for review. Enter Gate I only after explicit user
direction.
