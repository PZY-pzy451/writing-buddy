# Current progress

Updated: 2026-07-27

## Active milestone

StoryForge Gate B is complete and waiting for human approval on
`codex/phase-1.0a-deepseek-ai-foundation`. Tasks 2–8 now provide the Story
Kernel, strict schemaVersion 1 resources, atomic Rust persistence, resource
tabs/routes, the project dashboard, scene metadata/navigation, manuscript
mentions and backlinks. A real copied 6-chapter project loaded 5 resources,
2 scenes and 3 mentions without changing any of its 17 pre-existing files.
The 1536×992-equivalent Tauri WebView now gives the dashboard the full 852px
workspace height; 1280×800 and 1024×720 checks also have no horizontal page
overflow. Gate C remains blocked until this report receives explicit approval.

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

## Open

- Obtain human approval for StoryForge Gate B before starting Task 9.
- Validate `/models`, balance, streaming, cancellation, restart, and deletion
  with a user-provided real DeepSeek key.
- Validate AI automatic chapter review with that key.
- Human cutover gates are intentionally not automated.
- Legacy retirement is forbidden until M9 is complete.

## Next

Review the Gate B acceptance report, three screenshots and commits. Stop for
explicit human approval; do not start Character Center or Gate C automatically.
