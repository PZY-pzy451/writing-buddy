# Phase 1.2G — Chapter completion and export trust

Updated: 2026-07-31

## Outcome

Close the remaining author journey after drafting: organize the active chapter,
review it, and export a verifiable copy without leaving Writing Buddy or losing
track of where the copy was written.

## Current evidence

- `整理本章` already saves dirty prose and opens the chapter-scoped extraction
  center without invoking AI. The extraction center can compare plan versus
  manuscript and requires explicit confirmation before Story Kernel writes.
- The native bridge already writes an atomic Markdown copy through the system
  save dialog, but that capability is only exposed during save recovery.
- History currently contains snapshots and restore only. It does not expose
  chapter export or retain an export receipt.

## Gate A — one safe export action

- Add an explicit `导出章节` action to the chapter menu.
- Save dirty manuscript content before export and block export when the save did
  not complete.
- Support Markdown and plain-text output through the native save dialog.
- Treat dialog cancellation as cancellation, not an error or successful export.

## Gate B — trustworthy History

- Rename the surface to `历史与导出` and lead with the active chapter task.
- Keep one primary action: export the current chapter as Markdown. Plain-text,
  snapshot and restore remain secondary actions.
- Record successful exports with chapter, format, word count, time and exact
  destination. Keep records per project in durable local workspace state.
- Never create an export receipt before the native write succeeds.

## Gate C — regression and release

- Add store and visible UI coverage for success, cancellation, dirty-save
  protection, format selection and durable receipt parsing.
- Verify keyboard focus, 44 px actions, responsive collapse and no horizontal
  page overflow at desktop and narrow widths.
- Run lint, TypeScript, all Vitest suites, production build, Rust tests, Tauri
  build and native portable smoke before refreshing the Windows release folder.

## Non-goals

- No PDF or EPUB renderer in this gate.
- No automatic cloud publishing.
- No background export and no export without an author-selected destination.
- No change to Story Kernel schemas or chapter project metadata.
