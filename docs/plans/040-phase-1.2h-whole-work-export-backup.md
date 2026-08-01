# Phase 1.2H — Whole-work export and backup trust center

Updated: 2026-08-01

## Outcome

Close the completion loop for an entire novel: export every volume and chapter
in project order, verify exactly what was written, and manage portable project
backups from the same History surface.

## Current evidence

- Phase 1.2G safely exports the active chapter as Markdown or plain text and
  records a durable receipt only after the native write succeeds.
- The native bridge already creates, inspects and restores `.wbbackup` files,
  but those controls are hidden in the task dock instead of History.
- Project metadata already provides deterministic volume/chapter ordering and
  every chapter can be read through the desktop bridge.
- The market-oriented experience brief names `导出作品` as the primary History
  task; the current page still leads with `导出当前章节`.

## Gate A — deterministic whole-work export

- Build one pure export model that assembles the project title, volume titles
  and every chapter in project order.
- Support Markdown and plain text without changing the source manuscript.
- Strip editor-only scene anchors from exported text and calculate the receipt
  word count from chapter prose, not generated headings.
- Save a dirty active chapter first; do not open the export dialog if that save
  remains unsafe.
- Treat dialog cancellation as cancellation and create no receipt.

## Gate B — compatible export history

- Evolve export receipts into chapter/work records while parsing Phase 1.2G
  receipts that have no explicit scope as chapter receipts.
- Record scope, title, format, chapter count, word count, time and exact native
  destination only after the file write succeeds.
- Keep the persisted workspace key compatible so existing users retain history.

## Gate C — History as trust center

- Make `导出作品` the single primary History action. Keep current-chapter and
  plain-text variants secondary.
- Show project chapter/word totals and distinguish whole-work receipts from
  chapter receipts at a glance.
- Expose create, select, inspect and confirmed restore for `.wbbackup` on
  History. Reuse one backup workflow component in History and the task dock.
- Keep every control keyboard reachable, at least 44 px high and responsive
  without horizontal page overflow.

## Gate D — regression and release

- Cover Markdown/plain-text assembly, safe names, old/new receipt parsing,
  whole-work success, cancellation, dirty-save failure and visible History
  backup actions.
- Exercise History at desktop and narrow widths, including backup creation and
  export receipts.
- Run lint, TypeScript, all Vitest suites, production build, Rust tests, Tauri
  build and native portable smoke before refreshing the Windows release folder.

## Non-goals

- No PDF, DOCX or EPUB renderer in this gate.
- No cloud publishing or background export.
- No file import; the project creation choices remain guided starts for now.
- No automatic restore and no restore from an unvalidated backup.
