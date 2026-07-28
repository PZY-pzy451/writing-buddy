# AI Quick Actions Gate G — Extraction center, review, and hardening

Date: 2026-07-28

Status: completed

## Goal

Complete original Tasks 22–25 with:

- one manuscript organization center for selecting chapters and Story Kernel
  target types;
- sequential per-chapter paid jobs with an author-visible token estimate;
- explicit stop/resume, retained completed batches, and no automatic paid
  continuation after restart;
- all extracted resources staged through the existing Story Kernel conflict
  workflow;
- multi-source AI consistency findings represented as existing
  `ReviewIssue` records and aggregated by the existing Continuity Engine;
- deterministic privacy, failure, performance, snapshot, rollback, and restore
  evidence.

Dependency direction remains:

`React page -> extraction/review application services -> existing AI and Story ports -> Rust adapters`.

## Reused modules

- `story-kernel-generation` TypeScript/Rust request boundary and strict schema.
- `StoryKernelGenerationService` for evidence anchoring, schema validation,
  reference/collision conflicts, pending batches, and atomic confirmation.
- `AiActionRegistry`, Prompt Registry, DeepSeek streaming lifecycle, cancellation
  and public error taxonomy.
- `ReviewIssue`, persisted review state, `ContinuityEngine`, deterministic
  Story Kernel rules, and two-source evidence navigation.
- Existing version snapshots, Story transactions, backup, and restore ports.

## Extraction-run ledger

Path: `.writing-buddy/ai/extraction-center/index.json`

The versioned ledger contains only operational metadata:

- run ID, instruction, selected resource types, status, timestamps;
- one record per selected chapter with chapter resource ID/title, token
  estimate, source revision hash, safe terminal error code, candidate batch ID,
  candidate/conflict counts, and timestamps.

It never persists manuscript text, prompts, model output, API keys, project
paths, diagnostics, or private reasoning.

On load, a persisted `running` run becomes `stopped` and any running chapter
becomes `interrupted`. The application never calls the provider merely because
the project or page reopened. Only an explicit **继续未完成批次** action resumes
queued, interrupted, or retryable failed chapters.

Each chapter is one bounded `story-kernel-generation` job. Completed chapters
are skipped on resume. Stop cancels the active provider job and leaves completed
batches intact. UI progress is sampled and ledger persistence occurs only at
meaningful state transitions rather than every stream delta.

## Scope, type, and token behavior

- Scope options: current chapter, current volume, selected chapters, all
  chapters, and chapters without a completed extraction batch.
- The author may select any of the eleven existing Story Kernel resource types.
- The center loads selected chapter text only when planning/running.
- Token estimates use the existing deterministic estimator and are shown per
  chapter and in aggregate before starting.
- Oversized chapters, empty text, duplicate chapter IDs, invalid revisions, and
  unsafe target selections are blocked before a paid request.
- Existing author-secret information identities remain excluded from AI
  context by `loadStoryKernelGenerationIdentities`.

## Candidate review and apply

Every successful chapter response is staged through
`StoryKernelGenerationService.stageFromResponse`.

- Candidates retain source chapter/revision/evidence.
- Invalid schema, bad evidence, collisions, missing references, dependency
  failures, and duplicate IDs remain explicit conflicts.
- The center links each completed chapter to its persisted candidate batch.
- Candidate review supports filtering by chapter/type/conflict/status.
- Formal resources are not written from the batch runner.
- Confirmation still requires selected candidates, a fresh source/revision
  check, one safety snapshot, and the existing atomic Story transaction.
- If a guarded multi-resource write fails after snapshot creation, the
  acceptance harness restores the snapshot and verifies the pre-apply state.

## AI consistency review

Fixed purpose: `story-consistency-analysis`.

Input contains:

- an author instruction;
- two to twelve bounded, explicitly selected chapter sources;
- sanitized Story Fact summaries that exclude author secrets by default.

Output contains strict findings with:

- rule ID, title, message, semantic severity, and optional Story Fact;
- two to four exact evidence references (`A`, `B`, ...), each tied to a selected
  source ID and JavaScript UTF-16 range.

Unknown fields, missing/duplicate evidence, unknown sources, invalid exact
quotes, unsafe secrets, and oversized payloads are rejected in TypeScript and
Rust. AI `error` severity is capped to `warning` when converted to
`ReviewIssue`. Findings never include a replacement and cannot directly edit
manuscript or Story Kernel data.

`ReviewIssue` gains backward-compatible optional related-evidence and Story Fact
metadata. The Continuity adapter exposes every evidence item plus the fact, so
the existing page visibly shows **证据 A**, **证据 B**, and **Story Fact**.

## UI and accessibility

Add **AI 正文整理** to the Story reference sidebar and route it to a full-height
workspace.

The warm-paper center uses:

- a step-like scope/type setup card;
- per-chapter token and state rows;
- explicit cost boundary text before start/resume;
- start, stop, resume, retry, and review-candidates actions;
- retained completed results and a filterable conflict queue;
- Lucide icons, visible labels/status text, 44px targets, visible focus,
  disabled/loading/error/offline states, independent scrolling, reduced
  motion, and no hover layout shift.

The Continuity page adds a separate **AI 对照审查** action and drawer. It shows
selected sources and privacy scope before any request. The detail pane presents
source layers, evidence A/B, and Story Fact without an apply/edit action.

Acceptance viewports: 1536×960, 1280×768, and 1024×688 with zero page overflow,
unscrollable clipped controls, or effective targets below 44px.

## Failure and privacy gates

Tests cover:

- offline/provider failure, cancellation, timeout, invalid JSON, source stale,
  duplicate response, and explicit retry;
- restart normalization with no provider invocation;
- stopped runs preserving completed chapters;
- large selections with bounded in-memory retained output;
- atomic ledger writes and stale ledger conflicts;
- snapshot creation, failed apply rollback, version restore, and restart;
- scans of logs, diagnostics, review state, extraction ledger, snapshots, and
  backups for manuscript excerpts and secret-shaped values.

Sanitized fixtures are mandatory. Real author projects and real API keys are
manual gates and are never used by automated acceptance.

## Acceptance order

1. Ledger parser/store/orchestrator tests.
2. Strict consistency request/response and Rust mirror tests.
3. ReviewIssue metadata and Continuity adapter tests.
4. Extraction center and AI continuity page tests.
5. Typecheck, targeted tests, full `pnpm acceptance`, Rust formatting/tests.
6. Performance, privacy, snapshot/restore, and desktop smoke evidence.
7. Responsive browser captures, user/privacy/developer documentation, Windows
   release build, commits, tag decision, and remote push.
