# Genre-to-Draft Gate H — chapter reconciliation plan

Date: 2026-07-30

Baseline: `93307ab8 feat: connect contextual ai to scene drafting`

Commit target: `feat: reconcile draft changes with story plans`

## Scope

Implement Gate H only:

- organize the current chapter after writing;
- compare the materialized chapter plan with actual manuscript events;
- present field-level outline update candidates;
- keep StoryForge extraction and exact Evidence in the same review flow;
- block confirmation when either manuscript or plan is stale;
- batch-confirm explicitly selected outline fields and StoryForge resources;
- preserve snapshot and undo safety.

Gate I structure checking, performance hardening, and the complete end-to-end
journey regression remain out of scope.

## Existing paths to reuse

- Entry: `apps/desktop/src/workspace/WriterHeader.tsx`
- Route: `apps/desktop/src/app/routes.tsx`
- Extraction UI:
  `apps/desktop/src/features/story/extraction/ManuscriptExtractionCenterPage.tsx`
- Run ledger:
  `apps/desktop/src/features/story/extraction/ManuscriptExtractionCenterService.ts`
- Candidate grouping/stale model:
  `apps/desktop/src/features/story/extraction/ChapterOrganizationModel.ts`
- AI request and strict response:
  `packages/ai/src/index.ts`
- Native request boundary:
  `apps/desktop/src-tauri/src/ai/mod.rs`
- Candidate persistence, Story Kernel transaction, Evidence, receipt and undo:
  `apps/desktop/src/features/story/ai-context/StoryKernelGenerationService.ts`
- Canonical outline and materialized chapter projection:
  `apps/desktop/src/features/creation-journey/CreationJourneyModel.ts`
- Expected-hash journey write:
  `apps/desktop/src/features/creation-journey/CreationJourneyStore.ts`
- Snapshot: `desktopBridge.createSnapshot`

## Design decisions

1. Keep `WritingProject.volumes[].chapters[]` canonical for chapters and keep
   the Creation Journey node with the same `resourceId` as its outline
   projection.
2. Extend the existing `story-kernel-generation` request with an optional,
   bounded `chapterPlan`. Do not create a second AI job type or provider path.
3. When `chapterPlan` is present, the strict JSON response may include one
   `reconciliation` object beside the existing resource candidates.
4. Persist reconciliation metadata inside the existing source-revision-bound
   generation batch. Do not add a second candidate database.
5. Store the plan node ID and revision in the reconciliation. A batch becomes
   stale when either the authoritative manuscript hash or outline-node revision
   changes.
6. Show plan and actual values for `summary`, `goal`, `conflict`, `outcome`,
   and `hook`. Each difference requires exact manuscript Evidence.
7. Select no outline field by default. The author explicitly checks fields to
   update.
8. `修改正文`, `保留差异`, and `稍后处理` never alter outline prose.
9. A pending semantic difference exposes a calm `needs_review` state, not a
   red error.
10. Batch confirmation preflights source hash, plan revision, locks, candidate
    conflicts, and current journey hash before the first write. It creates a
    canonical snapshot before applying selected StoryForge resources or outline
    fields.
11. Outline updates use `updateStoryOutlineNode`, set source to
    `extracted_from_draft`, and never update a locked node.
12. If the final journey write fails after StoryForge confirmation, use the
    existing receipts to roll the confirmed resources back.

## TDD slices

### Slice 1 — reconciliation contract

- Reject unbounded, unknown, secret, path, or malformed plan fields.
- Require exact evidence for every reported difference.
- Allow existing candidate-only responses when no plan was supplied.
- Return the reconciliation beside isolated candidate diagnostics.
- Mirror the optional plan boundary in Rust.

### Slice 2 — persistent batch and stale model

- Persist and reopen reconciliation metadata in the existing generation file.
- Anchor response evidence to the authoritative chapter hash.
- Mark only manuscript-hash or plan-revision mismatches stale.
- Resolve a pending reconciliation without changing Story Kernel.

### Slice 3 — canonical outline apply

- Resolve materialized chapter nodes by canonical chapter ID.
- Reject missing, locked, stale, duplicate, or unsupported field selections.
- Apply only explicitly selected fields.
- Preserve all unselected plan fields.
- Mark adopted fields `extracted_from_draft`.

### Slice 4 — extraction-center experience

- Load the chapter plan before generation.
- Display plan, actual, differences, Evidence, `needs_review`, and stale state.
- Provide explicit field checkboxes plus `修改正文`, `保留差异`, and `稍后处理`.
- Extend the existing batch-confirm action to include selected outline fields.
- Keep zero default selections and 44 px keyboard-operable actions.
- Preserve existing resource rejection, defer, snapshot, and undo behavior.

## Validation

- Focused Vitest while each slice is red/green.
- Full ESLint, TypeScript, Vitest, production build.
- Full and release self-test modes.
- `cargo fmt --check` and complete Rust tests.
- Real browser workflow at 1024×720, 1280×800, and 1536×960:
  current chapter → organize → plan/actual diff → Evidence → select one outline
  field plus StoryForge resources → snapshot → batch confirm → stale protection.
- Native portable startup, responsive main window, normal close, exit code 0.
- Tauri Release and NSIS output with SHA-256.
- Acceptance report and progress/memory update.
