# Phase 1.2I — Safe local outline and manuscript import

Updated: 2026-08-01

## Outcome

Turn the welcome actions `导入已有大纲` and `导入已有正文` into truthful local
file imports. The author selects a UTF-8 Markdown or text file, reviews what
will be created, and confirms one atomic project-creation transaction.

## Current evidence

- Both welcome actions currently open the project wizard but never select or
  read a file; the author must still paste content manually.
- Native project creation already writes to a sibling staging directory,
  reopens it for integrity verification and only then atomically renames it.
- Phase 1.2H provides safe project export and backup, so importing existing
  work is now the remaining first-run trust gap.

## Gate A — bounded native file selection

- Add one native chooser for `.md`, `.markdown` and `.txt` files.
- Read only an explicitly selected regular file, reject unsupported formats,
  binary/NUL content, invalid UTF-8, empty content and files over 5 MiB.
- Return file name, format, byte count and normalized text without retaining
  or persisting the external source path.
- Treat dialog cancellation as cancellation, with no project or store writes.

## Gate B — deterministic preview

- Show a three-state import card: choose source, review result, replace/remove.
- Manuscript preview reports words and paragraphs and imports the source text
  unchanged as the first chapter.
- Outline preview recognizes explicit Markdown/chapter headings, reports the
  chapter count and shows the first detected titles and source excerpt.
- Require at least one safe chapter heading for an outline. Never ask AI to
  infer structure and never silently discard unrecognized source text.

## Gate C — atomic import transaction

- Include the bounded import source and validated outline plan in the existing
  project preflight request.
- Manuscript import creates the first volume/chapter and writes the exact
  source text into that chapter inside staging.
- Outline import creates the first volume and detected chapters, stores each
  section summary as the chapter scene note, and preserves the exact original
  file under `.writing-buddy/imports/`.
- Reopen and verify the complete staged project before the final atomic rename.
  On any failure, remove staging and leave no target project behind.

## Gate D — truthful handoff and release

- The review step names the selected source and exact chapter/import counts;
  its primary action says `创建并导入`.
- After manuscript import, open the imported first chapter. After outline
  import, open the project dashboard with the chapter structure visible.
- Cover native validation, outline analysis, atomic creation, cancellation,
  invalid source, welcome routing, preview and successful handoff.
- Run lint, TypeScript, all Vitest suites, production build, Rust tests, Tauri
  build and native portable smoke, then publish a fresh Windows release folder.

## Non-goals

- No DOCX, PDF, EPUB or legacy proprietary format parsing.
- No AI rewriting, summarization or title invention during import.
- No automatic splitting of an unstructured full manuscript into chapters.
- No import into an already-open project in this gate.
