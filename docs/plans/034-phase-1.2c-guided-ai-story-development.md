# Phase 1.2C — Guided AI Story Development

Status: complete
Updated: 2026-07-30
Branch: `codex/phase-1.2c-guided-development`

## Product outcome

Phase 1.2C turns the Phase 1.2B creation journey into an author-controlled
development loop:

1. the author may explicitly ask AI for one useful story question;
2. AI returns exactly three bounded answers and the author may write a custom
   answer;
3. the author may lock decisions that AI must preserve;
4. changing an upstream decision keeps every downstream draft intact and
   creates a visible impact review;
5. the author may keep or regenerate one affected item at a time;
6. the journey becomes current only after every affected item is resolved.

AI remains a proposal system. It never asks a paid question on page entry,
chooses an answer, unlocks a decision, rewrites a whole stage, changes an
existing manuscript, or resolves an impact without an author action.

## Phase boundary

This slice implements:

- one-question-at-a-time AI guidance;
- exactly three answer options plus one author-written answer path;
- persistent author decisions as bounded AI context;
- author locks for story-core fields, directions, outline nodes, and chapter
  proposals;
- precise downstream impact records and counts;
- keep-current and regenerate-one-item resolution;
- version-1 to version-2 journey migration;
- native validation and materialization compatibility for version 2.

It does not implement:

- automatic interviews or background AI requests;
- deep character, world, timeline, or relationship modules;
- whole-stage or whole-project regeneration;
- automatic synchronization into materialized chapter manuscripts;
- real-account model-quality validation;
- Phase 1.2D writer studies.

## Version-2 journey document

The project continues to own
`.writing-buddy/creation/journey.json`. Version 2 preserves every version-1
field and adds three strict sections.

### Guidance

`guidance` contains:

- at most one current question;
- a question ID, active journey stage, concise question, why it matters, and
  exactly three option objects;
- zero or more confirmed answers in chronological order;
- for each answer, its source (`option` or `custom`), exact author-approved
  text, stage, and confirmation time.

Only the newest bounded answers needed by an operation enter an AI request.
Changing stages does not discard answers. Generating another question replaces
only an unanswered current question and does not change story content.

### Locks

`locks` contains unique, known keys for:

- individual story-core fields;
- direction IDs;
- outline-node IDs;
- chapter-proposal IDs.

The existing per-element lock remains canonical for idea elements. Manual and
AI reducers reject writes to locked targets. Removing or replacing a
collection also removes only orphan lock references. AI receives locked
content as preserve-only constraints and cannot return a replacement for a
locked target.

### Impacts

`impacts` is an append-only decision audit. Each record contains:

- a stable impact ID;
- source kind and optional source target;
- one exact downstream target kind and ID;
- a concise deterministic reason;
- `pending`, `kept`, or `updated` status;
- creation and optional resolution times.

There may be only one pending impact for a target. A later upstream edit
refreshes that pending record instead of creating duplicate work. Resolved
records remain for traceability.

The existing `stale` flags remain for native and UI compatibility, but version
2 validates them against pending impacts:

- a pending direction target makes `stale.directions` true;
- a pending outline target makes `stale.outline` true;
- a pending chapter target makes `stale.chapters` true.

Version-1 migration creates pending impact records for every existing target
covered by a true stale flag. It preserves revision, author text, IDs,
materialized resource IDs, timestamps, and current stage. The first subsequent
save writes version 2 using the existing expected-hash guard.

## Impact propagation

The reducer uses this fixed dependency graph:

`element/core → direction → outline → chapter`

- editing an unlocked element or core field affects every existing direction,
  outline node, and chapter proposal;
- changing the direction selection or an unlocked direction affects every
  existing outline node and chapter proposal;
- editing or moving an unlocked outline node affects every existing chapter
  proposal;
- editing an unlocked chapter proposal has no downstream target.

Affected content remains visible and editable. Materialization is blocked
while any chapter impact is pending. Advancing through a stage is blocked
while that stage has pending impacts.

`保留当前内容` resolves exactly one impact as `kept`.
`AI 重新生成此项` starts one paid request and resolves exactly one impact as
`updated` only after a strict response is applied. Regenerating a direction
or outline node may create or refresh downstream pending impacts.

Materialized chapters are never regenerated. Their impact can only be kept
with copy explaining that manuscript changes require the author to edit the
chapter. No Phase 1.2C action calls a manuscript write port.

## AI boundary

The existing `creation-journey` purpose gains two operations.

### `generate-guidance-question`

Input includes:

- active journey stage;
- bounded, author-visible journey context;
- recent confirmed guidance answers;
- locked decisions as preserve-only constraints.

Output contains one question with exactly three distinct options. The response
cannot contain an answer, content replacement, project ID, path, credential,
or unknown field.

### `regenerate-part`

Input contains exactly one target:

- one direction;
- one outline node; or
- one non-materialized chapter proposal.

It also contains only the bounded upstream context needed for that target,
recent confirmed guidance answers, known outline IDs when required, and locked
constraints. Output echoes the exact target kind and ID and returns one
replacement without changing the stable ID. A mismatched target, unknown
source-node ID, locked target, prose-wrapped JSON, or extra item fails before
state mutation.

The four Phase 1.2B operations accept the same bounded guidance and lock
context where relevant. All six operations remain explicit, cancellable,
retryable, and strict in both TypeScript and Rust.

## Interaction contract

The journey surface adds:

- a quiet `让 AI 问一个关键问题` action;
- one question card with three option buttons, a custom-answer field, and
  explicit confirmation;
- lock/unlock controls with text labels or accessible names beside the exact
  field or card;
- an impact summary showing separate direction, outline, and chapter counts;
- `查看影响` and `暂不更新` without hiding or deleting stale drafts;
- an impact panel with one target per row and `保留当前内容` or
  `AI 重新生成此项`.

Busy state belongs to the exact question or target. Other read/navigation
actions remain available. Success, cancellation, strict-response failure,
save conflict, and materialized-chapter limits use localized actionable copy.

All new controls meet 44 px effective targets, visible keyboard focus, and
pointer/keyboard parity. The panel traps focus, restores the opener, closes
with Escape, and becomes a full-height sheet at compact widths. Paper and
Midnight themes, 1024/1280/1536 layouts, 150–300 ms transitions, and reduced
motion remain acceptance requirements.

## Test-first matrix

### Migration and domain

- version 1 migrates deterministically to version 2 without losing content;
- corrupt version 2, orphan locks, duplicate pending targets, or stale/impact
  disagreement is rejected;
- locked manual and AI target updates are rejected;
- upstream edits preserve downstream drafts and create exact pending targets;
- repeated edits deduplicate pending target work;
- keep and update resolve only the chosen impact;
- downstream regeneration propagates only to its actual dependents;
- materialized chapters reject regeneration;
- serialization round-trips guidance, locks, impacts, author text, and IDs.

### AI

- question input is bounded and output requires exactly three options;
- option and custom answers are author-confirmed before becoming context;
- regeneration requires exactly one matching, unlocked target;
- known outline IDs constrain chapter sources;
- invalid counts, unknown fields, path/credential text, target mismatch, and
  prose-wrapped JSON fail without state changes;
- TypeScript prompts, browser fixtures, and Rust purpose/operation validation
  remain compatible.

### Persistence and native

- loading a version-1 file returns version 2 and saves with the original hash;
- stale concurrent migration writes fail safely;
- Rust accepts strict version 2 and rejects unknown fields or invalid impact
  state;
- materialization still writes exactly three new chapters atomically;
- no impact action writes an existing chapter manuscript.

### UI and real interaction

- opening the journey starts zero AI jobs;
- asking a question starts one job and renders exactly three choices;
- selecting or writing an answer changes no story field by itself;
- locked targets visibly refuse manual and AI replacement;
- an upstream edit exposes exact impact counts and preserves downstream text;
- keep-current resolves one row without an AI job;
- local regeneration changes only one row and keeps its stable ID;
- pending materialized chapters expose no regenerate action;
- reload preserves question, answers, locks, and pending/resolved impacts;
- the panel passes focus restoration, Escape, 44 px, no-clipping,
  Paper/Midnight, reduced-motion, and responsive checks.

## Delivery gates

1. Contract and migration: version-2 schema, deterministic migration, impact
   reducer, and red/green domain tests.
2. AI and native parity: two strict operations, bounded context, deterministic
   browser fixtures, and Rust version-2 validation.
3. Guided UI: question, custom answer, locks, impact summary/panel, exact busy
   state, and localized recovery.
4. Persistence and real interaction: reload/concurrency/native compatibility
   plus real Edge acceptance at 1536, 1280, and 1024.
5. Release: lint, TypeScript, complete Vitest, Rust format/tests, complete and
   release self-tests, Tauri Release/NSIS, native startup/normal close,
   source-matching hashes, durable evidence, and commit.

Phase 1.2C is complete only after all five gates pass. Stop before Phase 1.2D.

## Completion

All five delivery gates passed on 2026-07-30. Durable results, screenshots,
release hashes, known limits, and the exact automated counts are recorded in
`docs/acceptance/045-phase-1.2c-guided-ai-story-development-2026-07-30.md`.
Phase 1.2D remains outside this contract and requires explicit user direction.
