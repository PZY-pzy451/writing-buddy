# Phase 1.2O chapter lifecycle

Date: 2026-08-02

## Why this cycle

The remaining candidates were re-scored for one delivery cycle:

| Candidate | Reach | Impact | Confidence | Effort | RICE | Lens |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Chapter lifecycle control | 55 | 2 | 70% | 3 | 25.67 | Blocker |
| Publish confirmation record | 35 | 1 | 60% | 2 | 10.50 | Enabler |
| Cross-project series bible | 25 | 2 | 40% | 6 | 3.33 | Enabler |

Phase 1.2N exposes a concrete dead end: publication readiness can identify a
chapter that is not marked complete and route the author to it, but no current
surface can change `draft`, `revision` or `completed`. Chapter lifecycle control
therefore wins even before applying the Blocker lens. The other candidates stay
outside this cycle.

## Outcome

Give authors one visible, reversible chapter-status control in the writing
header:

- display `初稿`, `修订中` or `已完成` beside the active chapter;
- explain that the status is author-controlled metadata and never an automatic
  judgment of prose quality;
- let the author choose any status explicitly, including moving a completed
  chapter back to revision or draft;
- save dirty manuscript text before changing status and abort when that save
  does not finish safely;
- update only the current project's manifest through an atomic,
  project-revision-guarded native command;
- update the in-memory snapshot after native verification so publication
  readiness recomputes immediately.

## Safety and compatibility

- Unknown chapter IDs, unsupported status values, read-only projects and stale
  manifest revisions must fail without changing the manifest or manuscript.
- The native command serializes, writes atomically, reopens and verifies the
  manifest. Verification failure restores the exact previous manifest bytes.
- Existing projects without a status remain compatible and appear as `初稿`.
- Status changes do not invoke AI, create snapshots, edit Story Kernel records,
  change manuscript text or infer completion from word count.
- The control is unavailable for non-chapter resources and disabled while a
  status update is in flight.

## Verification gates

1. Rust tests cover success, stale revision, invalid status and missing chapter,
   including no-write assertions on failures.
2. Store and visible experience tests cover dirty-save ordering, save failure,
   read-only behavior, reversible transitions and immediate publication-gate
   recomputation.
3. The chapter control has labelled states, keyboard operation, visible focus,
   disabled/loading feedback and at least 44 px targets.
4. ESLint, TypeScript, complete Vitest, production build, Cargo format/tests,
   full/release self-tests, Tauri build and native portable smoke pass.
5. Real-browser acceptance covers desktop and narrow layouts without page
   overflow, clipping, occlusion, sub-44 px controls or runtime errors.

## Non-goals

- Automatic chapter completion, completion percentages or AI quality scoring.
- Bulk status changes.
- A publication submission workflow or cross-project series data.
- Changes to the Story Kernel schema.
