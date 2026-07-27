# Current progress

Updated: 2026-07-27

## Active milestone

StoryForge Gate A is active on
`codex/phase-1.0a-deepseek-ai-foundation`. Task 0 froze the baseline at
`7e658a284920b0e61d42da39a0addaa39bd6b11d`, copied the complete professional
editor handoff into the repository, recorded the real source map and reproduced
the generic “无法打开作品” failure. Task 1 is limited to diagnosable project
open, read-only fallback, repair/diagnostic/retry actions and close/restart
recovery against a sanitized project copy. Story Kernel and professional data
pages remain blocked until Gate A receives human approval.

## Completed

- Independent client architecture and Legacy schema compatibility reader
- Safe Rust filesystem, process lock, Credential Manager, snapshots and backup
- Monaco desktop render fix (`freezePrototype: false`)
- Immutable session/store refresh after edits, saves and reloads
- Real copied-project desktop acceptance
- Node 24 / pnpm 10 / TypeScript / Vitest / Vite / Cargo / Tauri build gates
- Durable evidence in `docs/acceptance/002-desktop-acceptance-2026-07-26.md`
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

- Complete StoryForge Gate A Task 1 and its real copied-project restart
  acceptance.
- Validate `/models`, balance, streaming, cancellation, restart, and deletion
  with a user-provided real DeepSeek key.
- Validate AI automatic chapter review with that key.
- Human cutover gates are intentionally not automated.
- Legacy retirement is forbidden until M9 is complete.

## Next

Finish Task 1 with TDD, build the canonical release, open the new sanitized
Gate A project copy, close the app, launch it a second time and record restored
project/resource evidence. Stop at Gate A for human approval; do not start
Story Kernel work automatically.
