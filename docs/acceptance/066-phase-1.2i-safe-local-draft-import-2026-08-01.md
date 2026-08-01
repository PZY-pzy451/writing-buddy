# Phase 1.2I safe local outline and manuscript import acceptance

Date: 2026-08-01

## Accepted outcome

The welcome actions `导入已有大纲` and `导入已有正文` now perform real local
file imports instead of routing authors to an empty project.

- The native chooser accepts only explicitly selected UTF-8 `.md`,
  `.markdown` and `.txt` regular files up to 5 MiB. Empty, binary, invalid
  UTF-8, unsupported and over-limit files fail beside the import control.
- The external source path is not returned to the UI or persisted. Only the
  file name, format, byte count and selected text enter the creation request.
- Manuscript text is written unchanged as the first chapter and opened after
  creation. No AI request or rewrite occurs.
- Outline headings are detected only from explicit `第一章`, `Chapter 1` or
  numbered heading forms. The preview lists the exact planned chapter titles;
  missing headings and plans over 200 chapters are rejected rather than
  guessed or truncated.
- Outline import creates canonical chapter files, stores bounded section notes
  with those chapters and preserves the complete original source under
  `.writing-buddy/imports/original-outline.*`.
- Source content, manifest, workspace metadata and every chapter are written in
  the existing sibling staging directory, reopened for integrity validation
  and atomically renamed only after the complete import succeeds.

## Interaction and visual acceptance

The bundled in-app browser connection was attempted twice first, but the
current Windows session could not initialize it. The repository's isolated
Edge/CDP driver then exercised the same browser bridge.

The first screenshot review found the import card below all seven creation
starts. It was moved directly under the current-step description. A second
review found that narrow screens retained the previous step's scroll position;
the wizard now returns to the top whenever a step changes.

| Surface | Viewport | Page overflow X | Dialog overflow X | Import controls below 44 px |
| --- | ---: | ---: | ---: | ---: |
| Outline import preview | 1440×900 | 0 | 0 | 0 |
| Outline import preview | 820×720 | 0 | 0 | 0 |

The visible journey selected `零点回声大纲.md`, previewed two exact chapter
titles, confirmed `2 个章节 + 原始大纲` and `5 个文件`, created the project,
closed the dialog and exposed both imported chapters on the writing dashboard.

Evidence:

- [Visual metrics](./phase-1.2i-draft-import-visual-metrics.json)
- [Outline preview, 1440×900](./screenshots/phase-1.2i-draft-import/01-outline-preview-1440x900.png)
- [Outline preview, 820×720](./screenshots/phase-1.2i-draft-import/02-outline-preview-820x720.png)
- [Atomic import confirmation, 820×720](./screenshots/phase-1.2i-draft-import/03-outline-confirm-820x720.png)
- [Imported project dashboard, 820×720](./screenshots/phase-1.2i-draft-import/04-outline-dashboard-820x720.png)

## Automated verification

| Gate | Result |
| --- | --- |
| Focused import model/service/wizard | 3 files / 14 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 162 files / 648 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 71 passed / 2 explicit external gates ignored |
| Change-aware full self-test | Passed; `artifacts/self-test/latest.json` |
| Tauri Release and NSIS | Passed |

## Native Windows smoke

The fresh portable Release was launched with an isolated WebView profile.

| Check | Result |
| --- | --- |
| Process | PID 47852 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2i-safe-draft-import-2026-08-01/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,643,657 | `48922835FFC3B839995106BAA511B1B6B6CDA3412E562001C22E9CF3DDA6EFFE` |
| `Writing-Buddy-portable.exe` | 8,395,776 | `0DFD961AE07FCAE0AD783817F7F6C7FD62249093CB5B2F7CF42A05F74FDC0ED1` |

The same values are machine-readable in `SHA256.json` beside the binaries.
