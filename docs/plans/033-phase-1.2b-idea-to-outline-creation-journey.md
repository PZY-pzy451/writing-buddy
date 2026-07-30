# Phase 1.2B — Idea-to-Outline Creation Journey

Status: implementation contract
Updated: 2026-07-30
Branch: `codex/phase-1.2b-idea-outline`

## Product outcome

Writing Buddy must support the order in which a novelist actually starts:

1. capture a few incomplete ideas;
2. shape them into an editable story core;
3. compare three bounded story directions;
4. choose one direction or merge two;
5. edit and reorder a story-level outline;
6. confirm exactly three opening chapters;
7. enter chapter one and write.

AI proposes one decision at a time. It never silently confirms author intent,
rewrites downstream decisions, creates chapters, or enters the manuscript.

## Phase boundary

This slice implements only:

- creation starting point;
- 3–8 story elements;
- editable story core;
- exactly three story directions;
- story-level outline;
- exactly three opening chapters;
- explicit entry into the first chapter.

It does not implement deep character records, complete worldbuilding,
long-form continuity, or human validation. Those remain Phase 1.2C and 1.2D.

The creation wizard keeps six honest starting points:

- I only have a few ideas — the complete Phase 1.2B journey;
- I have a synopsis;
- I have characters or a world;
- I have a complete outline;
- I have a partial manuscript;
- blank project.

Non-idea routes reuse the existing project/dashboard/manuscript behavior in
this phase. They must not pretend that an unimplemented guided journey exists.

## Author-owned state contract

The project owns `.writing-buddy/creation/journey.json`.

The strict version-1 document contains:

- `projectId` and selected starting route;
- current stage;
- 3–8 editable, ordered story elements;
- an editable story core and explicit confirmation time;
- exactly three editable directions;
- one or two selected direction IDs;
- 5–8 editable, ordered outline nodes;
- exactly three editable chapter proposals;
- native chapter resource IDs only after materialization;
- updated time and monotonically increasing document revision.

AI output is always a draft. Advancing from the core requires an explicit
author confirmation. Changing confirmed upstream content marks downstream
content stale and blocks materialization until the author regenerates or
reconfirms it; no downstream content is deleted or rewritten automatically.

## AI boundary

One new strict AI purpose, `creation-journey`, has four operations:

- `organize-core`;
- `generate-directions`;
- `generate-outline`;
- `split-chapters`.

Inputs contain only bounded author content required for the active operation.
They exclude file paths, project IDs, API keys, hidden Story facts, and
manuscript text. Responses use an operation-discriminated JSON schema.

The output contract requires:

- one story core;
- exactly three genuinely different directions;
- 5–8 outline nodes;
- exactly three chapter proposals.

Every request is author-triggered, cancellable, retryable, and visible. A paid
request never starts on route entry, typing, project open, or stage movement.

## Safe write boundary

Draft journey saves use a fixed project-relative path, schema validation,
expected-content-hash conflict detection, and atomic replacement.

Final chapter creation is one native transaction:

1. acquire the project write lock;
2. recheck project revision and journey hash;
3. require exactly three valid, non-materialized chapter proposals;
4. create three chapter files with native stable IDs;
5. update the project manifest once;
6. add the three resource IDs to the journey document;
7. atomically replace the journey document;
8. reopen and verify both manifest and journey;
9. roll back all files and both documents on any failure.

The UI opens chapter one only after this transaction succeeds.

## Interaction contract

The center journey surface shows:

`灵感 → 故事核心 → 故事方向 → 故事总纲 → 章节 → 正文`

Authors may return to earlier completed stages. Impossible forward movement is
blocked with a specific correction, not a disabled mystery.

Required interaction rules:

- all primary targets are at least 44 px;
- every pointer action has a keyboard equivalent;
- stage changes move focus to the new stage heading;
- outline nodes support drag reorder and keyboard move controls;
- loading, empty, conflict, stale, and retry states are explicit;
- Paper and Midnight themes remain readable;
- 1024, 1280, and 1536 widths have no document-level horizontal overflow;
- transitions are 150–300 ms and removed under reduced motion.

## Test-first acceptance

### Domain

- strict parse rejects fewer than 3 or more than 8 elements;
- strict parse requires exactly 3 directions and exactly 3 chapter proposals;
- core edits make downstream drafts stale without deleting them;
- selecting more than 2 directions is rejected;
- advancing requires author confirmation;
- serialized state round-trips without dropping author text.

### AI

- TypeScript and Rust job names and prompts remain byte-for-byte compatible;
- each operation accepts only its bounded input and strict output;
- browser fixtures are deterministic and never start without an author event;
- invalid count, missing field, prose-wrapped JSON, and oversized input fail
  without persisting a draft.

### Persistence

- missing journey is a clean first-run state;
- corrupt, foreign-project, stale-hash, and oversized journey writes fail
  safely;
- three-chapter materialization is all-or-nothing;
- retries after failure cannot duplicate chapters;
- successful materialization reopens with exactly three chapters and the
  first resource ID.

### UI

- a new idea-start project lands in the journey with no AI request;
- 3–8 elements can be added, edited, removed, and reordered;
- core, direction, outline, and chapter stages require explicit decisions;
- one direction and a two-direction merge both work;
- outline reordering works by pointer and keyboard;
- final confirmation creates exactly three chapters and opens chapter one;
- reload resumes the project-owned journey;
- non-idea project starts keep their existing honest routes.

## Delivery gates

1. Contract/domain: source map, strict model, reducer, and red/green tests.
2. AI/storage: strict cross-language contract, project-owned persistence, and
   deterministic browser adapter.
3. Journey UI: wizard route, stage UI, focus, responsive behavior, and themes.
4. Materialization: atomic three-chapter commit and first-chapter handoff.
5. Release: lint, TypeScript, complete Vitest, Rust format/tests, change-aware
   self-test, real responsive interaction, Tauri Release/NSIS, and native
   startup/normal-close evidence.

The phase is complete only when all five gates have durable evidence and a
source-matching Windows executable.
