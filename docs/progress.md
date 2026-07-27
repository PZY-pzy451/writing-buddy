# Current progress

Updated: 2026-07-27

## Active milestone

AI Quick Actions Gate C2 is complete on
`codex/ai-quick-actions-gate-c2`. The remaining original Gate C tasks now have
author-controlled continuation plus grounded scene goal, outline, reverse
extraction, and emotion-beat candidates. Acceptance evidence is in
`docs/acceptance/015-ai-quick-actions-gate-c2-2026-07-27.md`.

## Completed

- Independent client architecture and Legacy schema compatibility reader
- Safe Rust filesystem, process lock, Credential Manager, snapshots and backup
- Monaco desktop render fix (`freezePrototype: false`)
- Immutable session/store refresh after edits, saves and reloads
- Real copied-project desktop acceptance
- Node 24 / pnpm 10 / TypeScript / Vitest / Vite / Cargo / Tauri build gates
- Durable evidence in `docs/acceptance/002-desktop-acceptance-2026-07-26.md`
- StoryForge Source Map and baseline freeze in
  `docs/plans/storyforge-source-map.md` and
  `docs/acceptance/storyforge-baseline.md`
- Diagnosable project open, read-only fallback, stale-lock repair and stable
  no-project startup
- Real Tauri project open and second-launch recovery evidence in
  `docs/acceptance/005-storyforge-gate-a-project-open-2026-07-27.md`
- Windows close regression evidence and rebuilt release hashes in
  `docs/acceptance/006-window-close-regression-2026-07-27.md`
- Story Kernel IDs, positions, evidence, strict schemas and safe paths
- Atomic Story Repository transactions, revision conflicts and Trash recovery
- First-class Story resource routes/tabs with persistence and missing recovery
- Full-height Story dashboard with three responsive viewport checks
- Scene metadata/navigation and manuscript-safe unlink behavior
- Mention persistence, rebase/stale handling, Monaco decorations and backlinks
- Gate B real Tauri evidence in
  `docs/acceptance/007-storyforge-gate-b-story-kernel-2026-07-27.md`
- Character Center with dynamic state history, confirmation and conflicts
- Directed relationship graph/matrix with time slices, evidence and Worker layout
- Story-time and narrative-order timeline with virtual tracks and list fallback
- Deterministic overlap, predecessor and travel-time review rules
- Full-height 1536/1280/1024 Story workspace regression fix
- Gate C evidence in
  `docs/acceptance/008-storyforge-gate-c-character-relationships-timeline-2026-07-27.md`
- Location hierarchy, structured factions/world rules and static map
- Story-asset holder/location/quantity/condition history and consistency rules
- Plot-thread board and foreshadowing plant/reminder/payoff lifecycle
- Story truth, reader reveal and character-knowledge time slices
- Author-secret default AI exclusion and premature-reveal checks
- Gate D evidence in
  `docs/acceptance/009-storyforge-gate-d-world-assets-plots-information-2026-07-27.md`
- Deterministic P0–P6 Context Pack construction with author-visible toggles,
  token budgets and author-secret exclusion
- Position-aware dynamic character state in grounded AI context
- Selection rewrite streaming, Diff, partial/full accept, note, reject and Undo
- AI-extracted pending facts with atomic persistence and mandatory author
  confirmation, Evidence and StoryPosition
- Unified text-rule, Story Kernel and AI continuity review with deduplication,
  stale evidence, two-source navigation and persisted resolution
- Gate E evidence in
  `docs/acceptance/010-storyforge-gate-e-grounded-ai-continuity-2026-07-27.md`
- Initial Git branch and exact JavaScript/Rust lockfiles
- Scoped DeepSeek provider contracts, model selection, job lifecycle, retry
  policy, cancellation, usage aggregation, and error taxonomy
- Windows Credential Manager key storage and fixed-host Rust transport
- Incremental SSE parser with private reasoning redaction
- AI & Models settings and isolated StoryForge streaming test page
- Durable Phase 1.0A evidence in
  `docs/acceptance/003-phase-1.0a-ai-foundation-2026-07-27.md`
- Full-width, full-height system-page shell for Search, Review, Versions,
  AI Test, and Settings
- Local manual and DeepSeek automatic chapter review with author-confirmed
  application
- Strict Rust job-purpose validation and validated AI issue anchoring
- Durable Phase 1.0B evidence in
  `docs/acceptance/004-system-layout-and-ai-review-2026-07-27.md`
- Isolated `story-kernel-generation` AI purpose with matching TypeScript and
  Rust request boundaries
- Strict complete-resource response parser for eleven Story Kernel types
- Persisted generation batches with exact evidence anchoring, schema checks,
  collision/reference/dependency conflicts and author-secret protection
- Create-safe, revision-safe atomic batch confirmation with a mandatory
  pre-commit safety snapshot
- Assistant **Kernel** tab with target selection, streaming/cancel state,
  candidate JSON/evidence review, rejection and batch confirmation
- Snapshot and `.wbbackup` inclusion for pending generation decisions
- Full Node acceptance: 52 files / 153 tests; Rust: 35 passed / 2 explicit
  release gates ignored in the normal suite
- Release performance and sanitized recovery gates passed; fresh Windows
  production executable and NSIS installer built and close/restart verified
- Reusable AI Action, versioned Prompt, strict output, privacy-aware Context,
  and guarded Preview Transaction contracts
- Unified AI generation drawer with the existing chapter-review runtime as its
  first real streaming adapter
- Responsive AI drawer evidence at 1536, 1280, and 1024 with zero clipped or
  undersized controls
- Full Node acceptance: 60 files / 176 tests; Rust: 35 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Windows EXE and NSIS installer built; isolated desktop smoke accepted
  normal close
- Selected-text **AI 润色** routed to grounded Context Pack, Diff candidate,
  stale protection, cancellation, explicit acceptance and Undo
- Selected-text character, location, item, information, and foreshadowing
  actions routed to one-type Story Kernel presets without automatic requests
- Warm-paper toolbar and assistant UI refined with visible active states,
  44px targets, and 1536/1280/1024 responsive evidence
- Full Node acceptance: 62 files / 181 tests; Rust: 35 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate C Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate C evidence in
  `docs/acceptance/014-ai-quick-actions-gate-c-2026-07-27.md`
- Header **AI 续写** modes for continuing a paragraph, completing a scene, and
  comparing exactly three directions
- Cursor/revision/anchor-protected candidate insertion with explicit author
  choice, cancellation, rejection, stale blocking, and Undo
- Assistant **细纲** tab for generating or extracting scene goal, conflict,
  turn, outcome, and emotion beats
- Per-field StoryScene acceptance with fresh repository recheck, expected
  revision, pre-write safety snapshot, and optional `emotionBeats`
- Matching TypeScript/Rust `manuscript-continuation` and
  `scene-plan-generation` request boundaries
- Responsive warm-paper evidence at 1536/1280/1024 with zero page overflow,
  clipped controls, or effective targets below 44px
- Full Node acceptance: 64 files / 188 tests; Rust: 37 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate C2 Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate C2 evidence in
  `docs/acceptance/015-ai-quick-actions-gate-c2-2026-07-27.md`

## Open

- Validate `/models`, balance, streaming, cancellation, restart, and deletion
  with a user-provided real DeepSeek key.
- Validate AI automatic chapter review with that key.
- Validate AI Story Kernel generation quality against the user's real
  DeepSeek account and a non-sanitized author-selected chapter.
- Human cutover gates are intentionally not automated.
- Legacy retirement is forbidden until M9 is complete.

## Next

Stop for explicit product direction before starting the handoff's character
and relationship AI work. Do not broaden the accepted Gate C2 scope
automatically.
