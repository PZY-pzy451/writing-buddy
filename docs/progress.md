# Current progress

Updated: 2026-07-27

## Active milestone

Phase 1.0B automated acceptance is complete on
`codex/phase-1.0a-deepseek-ai-foundation`. The independent Tauri + React
client now has a secure DeepSeek BYOK foundation, a StoryForge test flow,
full-height system pages, and manual/AI chapter review. Release EXE and NSIS
artifacts were built in an isolated target because the user had the canonical
release EXE open. Real-key validation and M9 human cutover remain open; Legacy
remains the rollback source.

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

- Validate `/models`, balance, streaming, cancellation, restart, and deletion
  with a user-provided real DeepSeek key.
- Validate AI automatic chapter review with that key.
- Close the currently running canonical release application before replacing
  its EXE and NSIS artifacts with the normal build command.
- Human cutover gates are intentionally not automated.
- Legacy retirement is forbidden until M9 is complete.

## Next

Run the explicit real-key checklist without recording the key, prompt,
response, chapter content, or reasoning. Close the running release window and
run the canonical package build. Continue M9 writing sessions against project
copies and record each recovery/restore result before deciding whether to
retire Legacy.
