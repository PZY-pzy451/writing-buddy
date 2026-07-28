# AI Quick Actions Gate F — Story progress, plots, and foreshadowing

Date: 2026-07-27

Status: accepted

## Goal

Complete original Tasks 18–21 with author-controlled workflows for:

- extracting timeline events from current chapter, current volume, selected
  chapters, or chapters without existing timeline events;
- generating events from a chapter goal, exactly three alternative next
  directions, and explicit causality suggestions;
- generating or extracting plot threads and foreshadowing;
- generating obstacles, turns, reminders, and payoff candidates;
- keeping deterministic continuity checks visually separate from AI semantic
  suggestions.

The dependency direction remains:

`React page -> application review service -> Story Repository -> Rust AI boundary`.

## Fixed AI purposes

- `timeline-analysis`
- `plot-analysis`

Both purposes use a P0 author instruction and one to twelve explicitly
selected, bounded P1 chapter sources. Aggregate manuscript content is capped;
each source contains only resource ID, revision, narrative order, and content.

Project roots, absolute paths, credentials, API keys, diagnostic logs, hidden
history, and unselected chapters are forbidden at TypeScript and Rust
boundaries.

## Timeline contract

Actions:

- `extract-events`
- `generate-events`
- `generate-directions`
- `suggest-causality`

Each event candidate contains:

- a stable client candidate ID and source chapter ID;
- title, summary, event type, story-time shape, and narrative order;
- known character, location, item, plot-thread, and foreshadowing IDs;
- existing predecessor/consequence IDs;
- direct results and later impacts;
- confidence, rationale, and optional exact evidence.

`extract-events` requires exact JavaScript UTF-16 evidence from the referenced
source for every event. `generate-directions` returns exactly three materially
different candidates.

Causality candidates use typed existing-event or client-candidate endpoints.
Unknown endpoints, self-links, and reversed duplicate links are rejected.
Candidate edges render dashed until accepted.

The backward-compatible `TimelineEvent` model gains optional/defaulted
`directResults`, `impacts`, and `foreshadowingIds`.

## Timeline staging and apply

- Normalize title and alias matches and group duplicates.
- Match existing events explicitly and never silently overwrite them.
- Validate all entity and causal references against supplied identities.
- Run deterministic timeline rules against the hypothetical selected batch.
- Label deterministic errors separately from AI rationale.
- Default blocking local conflicts and same-name field conflicts to unselected.
- Re-read every selected source and matched event revision before apply.
- Create one safety snapshot and atomically commit selected events and selected
  bidirectional predecessor/consequence links.

## Plot and foreshadowing contract

Actions:

- `generate-plot-thread`
- `generate-plot-consequences`
- `extract-plot-progress`
- `generate-foreshadowing`
- `generate-foreshadowing-payoff`
- `extract-foreshadowing`

Responses are a strict discriminated union:

- plot thread: title, aliases, summary, lifecycle, premise, stakes, dramatic
  question, start/target/actual resolution positions, known participants and
  scenes;
- foreshadowing: title, aliases, summary, lifecycle, planted/reminder/payoff
  positions, surface meaning, optional true meaning, reader visibility, and
  known plot-thread links.

Extraction actions require exact evidence. Generation returns bounded
reviewable candidates and never claims a write.

Existing foreshadowing identities exclude `trueMeaning` by default. The panel
offers an explicit **允许发送作者秘密** switch, off by default. Rust rejects a
secret-bearing request unless the switch is true.

## Plot staging and apply

- Deduplicate normalized titles/aliases and require explicit same-name merge.
- Validate chapter, participant, scene, and plot-thread references.
- Show existing-field conflicts and deterministic lifecycle issues.
- Extend local rules with an early-payoff warning when actual payoff precedes
  the author-planned payoff.
- Re-read all selected sources and matched revisions before apply.
- Create one snapshot and atomically commit only selected plot/foreshadowing
  candidates.

## Page UX

Timeline:

- header actions are **手动添加** and **AI 从正文提取**;
- existing time, track, zoom, and list controls stay available;
- the inspector shows predecessors, results, impacts, foreshadowing, evidence,
  and deterministic checks;
- the AI drawer includes scope selection, duplicate/conflict groups, batch
  selection, and a dashed causality preview.

Plot board:

- add **AI 剧情线与伏笔** in the header and empty states;
- candidate cards visibly separate AI rationale from local lifecycle checks;
- the author-secret switch includes an explanatory privacy label;
- lifecycle statuses use Chinese labels and do not rely on color alone.

Both drawers reuse warm-paper styling, Lucide icons, minimum 44px targets,
visible focus, loading/cancel/error/success states, independent scrolling,
reduced-motion handling, and responsive evidence at 1536, 1280, and 1024px.

## Acceptance order

1. TypeScript response/request schemas and Rust mirrored validation tests.
2. Timeline service tests for exact evidence, deduplication, causality,
   deterministic conflicts, stale sources/revisions, atomic selected-only
   writes, and snapshots.
3. Plot service tests for secret exclusion, strict references, merge/conflict
   handling, lifecycle rules, stale resources, and selected-only writes.
4. Timeline and plot page tests for all entry points, scopes, batch selection,
   causality preview, secret switch, evidence navigation, and inspector detail.
5. Typecheck, smallest Vitest targets, full `pnpm acceptance`, Rust formatting
   and tests.
6. Sanitized browser captures and metrics at 1536, 1280, and 1024px.
7. One-job Cargo release build, desktop smoke, durable acceptance evidence,
   commits, and remote push.
