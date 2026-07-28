# Current progress

Updated: 2026-07-28

## Active milestone

Project visual polish Y6 is active on `codex/project-visual-polish-y6`.
The implementation contract in `docs/plans/019-project-visual-polish-y6.md`
normalizes shared control sizes, icon tiers, empty states, hover stability,
disabled readability, card geometry, and responsive behavior without changing
business or persistence logic.

## Completed

- First-class scene rows below chapters with same-chapter reorder and
  cross-chapter movement.
- Exact UTF-16 manuscript-slice planning with preservation of unlinked text,
  stable scene IDs, dense narrative order, and strict anchor validation.
- One native transaction for Markdown, Story resources, and Mentions with
  revision/hash prechecks, staging, rollback, and reread verification.
- Exact-restore scene Undo based on verified post-move revisions and hashes.
- Scene movement acceptance: 95 frontend files / 321 tests, 51 Rust tests,
  1440/1024/800 responsive checks, fresh Tauri package, and isolated native
  close with exit code 0.
- Project scene movement evidence in
  `docs/acceptance/026-project-scene-movement-2026-07-28.md`.
- Fixed Story Kernel requests being rejected as **AI 配置不完整。** before
  provider dispatch when the model and credential were valid.
- TypeScript/Rust prompt parity now covers all 14 duplicated AI system prompts.
- Prompt-parity acceptance: 92 files / 309 frontend tests, 49 Rust tests,
  fresh Tauri package, and normal native close with exit code 0.
- Structured native AI failures now preserve public code, localized message,
  retryability, and HTTP status across Story Kernel, grounded JSON, and
  selection-rewrite boundaries.
- Story Kernel shows recovery guidance plus an explicit retry or AI-settings
  action without silently repeating a paid request.
- Both source handoffs have an evidence-backed implemented/partial/external
  matrix instead of a blanket completion claim.
- Reliability acceptance: 91 files / 295 frontend tests, 49 Rust tests,
  responsive Paper/Midnight visual checks, fresh Tauri build, and normal native
  close with exit code 0.
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
- Strict TypeScript/Rust `character-analysis` and `relationship-analysis`
  contracts with exact candidate shapes and extraction evidence
- Character Center AI generation, backstory, arc, voice, and grounded chapter
  extraction with explicit same-name merge and selected-only acceptance
- Confirmed dynamic character state persistence for inventory and knowledge
- Directed relationship generation/evolution analysis with independent
  opposite edges, dashed pending previews, conflicts, and one-edge acceptance
- Snapshot-backed, revision-safe Character and Relationship commits
- Responsive 1536/1280/1024 Gate D evidence with zero page overflow, clipped
  controls, or effective targets below 44px
- Full Node acceptance: 66 files / 199 tests; Rust: 39 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate D Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate D evidence in
  `docs/acceptance/016-ai-quick-actions-gate-d-2026-07-27.md`
- Strict TypeScript/Rust `world-analysis` and `item-analysis` contracts with
  typed targets, bounded chapter context, known identities, and exact
  extraction evidence
- Worldbuilding generation and extraction for locations, factions, cultures,
  religions, technology, magic, law, and scoped general rules
- Explicit same-name merge, per-field acceptance, rule conflict detection,
  stale-source/revision checks, and snapshot-backed world commits
- Item card, history, and extraction candidates with independently selectable
  state events and deterministic unique-item holder checks
- Responsive 1536/1280/1024 Gate E evidence with zero page overflow, clipped
  controls, or effective targets below 44px
- Full Node acceptance: 69 files / 210 tests; Rust: 41 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate E Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate E evidence in
  `docs/acceptance/017-ai-quick-actions-gate-e-2026-07-27.md`
- Strict TypeScript/Rust `timeline-analysis` and `plot-analysis` contracts with
  bounded multi-chapter context, known identities, and exact extraction
  evidence
- Timeline extraction, goal-based generation, exactly three directions, and
  typed dashed causal-edge review with atomic bidirectional link persistence
- Plot-thread generation/progress extraction plus foreshadowing generation,
  payoff, and extraction with explicit lifecycle checks
- Author secrets excluded by default behind an explanatory opt-in control
- Snapshot-backed, stale-source/revision-safe selected-batch commits
- Responsive 1536/1280/1024 Gate F evidence with zero page overflow, clipped
  controls, or effective targets below 44px
- Full Node acceptance: 71 files / 222 tests; Rust: 43 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate F Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate F evidence in
  `docs/acceptance/018-ai-quick-actions-gate-f-2026-07-27.md`
- Global no-project create entry, welcome page, compact recent-project shelf,
  and four-step creation wizard
- Six typed project templates with adjustable initial resources and no
  automatic AI/prose generation
- Native creation preflight, same-parent staging, reopen verification, atomic
  directory save, collision refusal, and failure cleanup
- Project-scoped theme/accent persistence and restore
- Semantic selected/hover/focus/drag/AI/conflict/status tokens across Paper,
  Midnight, Fog, and Focus themes
- Responsive 1440/1024 visual evidence and explicit compact icon labels
- Full Node acceptance: 79 files / 252 tests; Rust: 47 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed
- Project Creation Y0–Y2 evidence in
  `docs/acceptance/020-project-creation-y0-y2-2026-07-28.md`
- Typed volume/chapter drag payloads, targets, rule registry, and commands
- Pointer and keyboard project-tree dragging with source, target, insertion,
  overlay, invalid, live-announcement, search-disabled, and read-only states
- Write-locked manifest revision checks, atomic persistence, canonical reopen
  verification, exact inverse commands, toast Undo, and Ctrl+Z parity
- Responsive 1440/1024/800 evidence with zero horizontal overflow and fixed
  structure/reference scrolling
- Full Node acceptance: 83 files / 271 tests; Rust: 49 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed with exit code 0
- Project structure drag Y3 evidence in
  `docs/acceptance/021-project-structure-drag-y3-2026-07-28.md`
- Guarded character, item, and foreshadowing association with explicit
  scene/position/meaning confirmation and no AI invocation
- Narrative timeline reordering with story-time lockout and pre-write
  causality conflict confirmation
- Plot-thread lifecycle dragging with no-op protection, revision-safe save,
  reload consistency, and Undo
- Responsive 1440/1024/800 evidence with zero document/page overflow, 44px
  controls, bottom-sheet confirmation, visible focus, and reduced motion
- Full Node acceptance: 86 files / 279 tests; Rust: 49 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed with exit code 0
- Project association drag Y4 evidence in
  `docs/acceptance/022-project-association-drag-y4-2026-07-28.md`
- Shared TreeRow, DropIndicator, DragOverlayCard, AssociationMenu, UndoToast,
  and AI candidate state primitives adopted by project-tree and association
  surfaces
- Project-scoped, opt-in character/location/item/foreshadowing manuscript
  highlights with distinct four-theme semantic tokens
- Field-specific Story Kernel diagnostics with safe actual-value previews,
  blocked invalid writes, and raw JSON collapsed behind diagnostic disclosure
- Responsive 1440/1024 evidence for real entity decorations and the supplied
  `readerVisibility: "hidden"` regression across Paper, Midnight, Fog, and
  Focus
- Full Node acceptance: 89 files / 287 tests; Rust: 49 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed with exit code 0
- Project highlight and shared interaction Y5 evidence in
  `docs/acceptance/023-project-highlight-components-y5-2026-07-28.md`

## Open

- Validate `/models`, balance, streaming, cancellation, restart, and deletion
  with a user-provided real DeepSeek key.
- Validate AI automatic chapter review with that key.
- Validate AI Story Kernel generation quality against the user's real
  DeepSeek account and a non-sanitized author-selected chapter.
- Human cutover gates are intentionally not automated.
- Legacy retirement is forbidden until M9 is complete.

## Next

Complete and accept the Y6 application visual-polish pass, then handle
remaining person/world grouping drag and Y7 hardening as separate gates.

## Project Creation Y0–Y2 complete

- Source map and canonical project ordering contract are recorded in
  `docs/plans/010-project-creation-drag-source-map.md` and
  `docs/plans/011-project-data-ordering-contract.md`.
- Implementation contract and stop line are recorded in
  `docs/plans/012-project-creation-y0-y2.md`.
- `ui-ux-pro-max` guided the semantic token, focus, responsive, readable
  disabled-state, and reduced-motion treatment.
- Browser visual acceptance exposed and fixed the welcome import style,
  compact sidebar button layout, and responsive icon-only accessible labels.
- The official browser-skill client was incompatible with the protected Node
  runtime; local Playwright and installed Edge provided the equivalent
  acceptance path.
- Drag Y3–Y4 remains deliberately deferred per the handoff.

## AI Quick Actions Gate G start

- User direction “继续完成” continues the accepted Gate F branch into the final
  Tasks 22–25.
- Created `codex/ai-quick-actions-gate-g` from accepted Gate F.
- Gate G reuses the existing strict Story Kernel generation/conflict pipeline,
  ReviewIssue/Continuity Engine, AI streaming lifecycle, snapshots, backup, and
  restore ports instead of introducing parallel write paths.
- The `ui-ux-pro-max` rules file was read completely. Its required
  `scripts/search.py` is absent from the installed package, so the documented
  accessibility, interaction, responsive, contrast, and reduced-motion rules
  are applied directly.
- Contract:
  `docs/plans/009-ai-quick-actions-gate-g-extraction-review-hardening.md`.

## AI Quick Actions Gate G complete

- Added **AI 正文整理** with current chapter/current volume/selected/all/
  unfinished scope, deterministic preflight Tokens, sequential paid jobs,
  explicit stop/resume and restart normalization without automatic billing.
- Completed chapters and candidate batches survive failure/cancellation;
  stale sources require explicit refresh and concurrent ledger writes fail
  safely.
- All extracted resources use the existing Story Kernel generation schema,
  collision/reference/evidence rules, pending candidate store, snapshot and
  atomic transaction path.
- Added grounded **AI 对照审查** for 2–12 selected chapters, exact evidence
  A/B, optional safe Story Fact, AI severity capped at warning and no
  replacement/write path.
- Privacy tests and scans cover author secrets, paths, credentials, ledger
  prose, Prompt output and hidden foreshadowing meanings.
- Responsive 1536/1280/1024 evidence has zero page overflow, clipped controls
  or effective controls below 44px.
- Full Node acceptance: 75 files / 241 tests; Rust: 44 passed / 2 explicit
  manual gates ignored.
- Fresh portable EXE and NSIS installer built; native startup and normal close
  passed.
- Acceptance:
  `docs/acceptance/019-ai-quick-actions-gate-g-2026-07-28.md`.

## AI Quick Actions Gate F start

- The user explicitly asked to continue after accepted Gate E.
- Created `codex/ai-quick-actions-gate-f` from the accepted Gate E branch.
- Gate F implements original Tasks 18–21 with dedicated `timeline-analysis`
  and `plot-analysis` boundaries, bounded multi-chapter scope, exact extraction
  evidence, atomic batch acceptance, dashed pending causality, and author
  secrets excluded by default.
- The installed UI/UX skill still lacks its referenced search helper. Its
  accessible warm-paper, Lucide, 44px, focus, contrast, responsive, and
  reduced-motion rules are applied directly.
- Contract:
  `docs/plans/008-ai-quick-actions-gate-f-story-progress-plots.md`.

## AI Quick Actions Gate E start

- The user explicitly asked to continue after accepted Gate D.
- Created `codex/ai-quick-actions-gate-e` from the accepted Gate D branch.
- Gate E implements original Tasks 15–17: structured worldbuilding generation
  and extraction plus item card/history/extraction/transfer candidates.
- The UI/UX skill package did not include its referenced search helper, so its
  documented warm-paper, Lucide, 44px, focus, responsive, contrast, and
  reduced-motion rules are applied directly.
- Contract:
  `docs/plans/007-ai-quick-actions-gate-e-worldbuilding-items.md`.

## AI Quick Actions Gate D start

- The user explicitly asked to continue after Gate C2, satisfying the previous
  stop for product direction.
- Created `codex/ai-quick-actions-gate-d` from the accepted Gate C2 branch.
- Gate D implements original Tasks 12–14: character generation, grounded
  character extraction and directed relationship generation/extraction.
- The `ui-ux-pro-max` skill guides the warm-paper review surfaces: 44px targets,
  explicit states, visible focus and responsive layout.
- Contract:
  `docs/plans/006-ai-quick-actions-gate-d-characters-relationships.md`.
