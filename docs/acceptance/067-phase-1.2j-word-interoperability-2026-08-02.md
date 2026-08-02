# Phase 1.2J Word interoperability acceptance

Date: 2026-08-02

## Accepted outcome

Writing Buddy now supports a bounded Word-first entry and delivery workflow.

- The native import chooser accepts `.docx` alongside UTF-8 Markdown/text.
  DOCX is treated as an untrusted ZIP: the archive is capped at 5 MiB, entries
  at 256, `word/document.xml` at 10 MiB and extracted text at 5 MiB.
- Encrypted, malformed, empty, oversized, missing-main-document and invalid XML
  packages fail before project creation. External source paths are not returned
  to the UI or persisted.
- Word import extracts visible body paragraphs, tabs and line breaks. The
  review truthfully states that images, comments, footnotes, tracked-change
  history and exact layout are not imported.
- Manuscript text enters the first chapter without AI rewriting. Outline text
  uses the existing explicit-heading analyzer and atomic staging/reopen/rename
  transaction; Word outlines preserve an extracted text copy in the project.
- History exposes `导出 Word 文档` as its single primary delivery action.
  Markdown/plain text remain secondary. Word export preserves work, volume and
  chapter hierarchy with Title/Heading 1/Heading 2 styles, removes internal
  scene anchors and duplicate opening chapter headings, and XML-escapes author
  content.
- Cancellation and failed dirty saves create no export receipt. A receipt is
  persisted only after the `.docx` file is written successfully.

## Interaction and visual acceptance

The bundled in-app browser connection was attempted twice first but could not
initialize in the current Windows session. The repository's isolated Edge/CDP
driver then exercised the same browser bridge and passed.

| Viewport | Page overflow X | Clipped controls | History controls below 44 px | Runtime errors |
| ---: | ---: | ---: | ---: | ---: |
| 1440×900 | 0 | 0 | 0 | 0 |
| 1280×800 | 0 | 0 | 0 | 0 |
| 1024×720 | 0 | 0 | 0 | 0 |
| 820×720 | 0 | 0 | 0 | 0 |

The visible journey found exactly one History primary action, exported three
chapters as `browser-downloads/我的小说.docx`, displayed a `Word 文档` whole-work
receipt and retained the validated project-backup workflow.

Evidence:

- [Visual metrics](./phase-1.2j-word-interoperability-visual-metrics.json)
- [History, 1440×900](./screenshots/phase-1.2j-word-interoperability/01-history-work-export-backup-1440x900.png)
- [History, 1280×800](./screenshots/phase-1.2j-word-interoperability/02-history-work-export-backup-1280x800.png)
- [History, 1024×720](./screenshots/phase-1.2j-word-interoperability/03-history-work-export-backup-1024x720.png)
- [History, 820×720](./screenshots/phase-1.2j-word-interoperability/04-history-work-export-backup-820x720.png)

## Automated verification

| Gate | Result |
| --- | --- |
| Focused Word/import/export/UI regressions | 4 files / 35 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 162 files / 651 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 74 passed / 2 explicit external gates ignored |
| Change-aware full self-test | Passed; `artifacts/self-test/latest.json` |
| Tauri Release and NSIS | Passed |

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 45564 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2j-word-interoperability-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,723,266 | `0BA6EF27445F7BC13A239B471EF8EC3BF42B3D94D57EE5B6E20E27E99436762C` |
| `Writing-Buddy-portable.exe` | 8,572,928 | `97B503BB0DF1C8457FF65A0AAC6463100427F91D9C4ADEB5C027D5808AF4D955` |

The same values are machine-readable in `SHA256.json` beside the binaries.
