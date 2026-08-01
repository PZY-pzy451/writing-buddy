# Phase 1.2H whole-work export and backup trust acceptance

Date: 2026-08-01

## Accepted outcome

History now closes the completion loop for an entire novel instead of only the
active chapter.

- `导出作品` is the one primary History action. It writes every volume and
  chapter in canonical project order as Markdown through the native save
  dialog.
- `作品纯文本`, `当前章 Markdown` and `当前章纯文本` remain explicit
  secondary delivery choices.
- Whole-work Markdown adds stable work/volume/chapter headings, removes
  editor-only scene anchors and avoids duplicating a matching source chapter
  heading. Plain text removes Markdown syntax without changing source files.
- A dirty active manuscript must save first. An unsafe save, export failure or
  cancelled save dialog creates no file receipt.
- Export receipts now distinguish `整部作品` from `当前章节` and include title,
  format, chapter count, prose word count, time and exact destination. Phase
  1.2G receipts without a scope are migrated locally as chapter receipts.
- History exposes the existing create/select/inspect/restore `.wbbackup`
  workflow. Restore stays disabled until inspection passes and still requires
  confirmation; the same component is reused by the task dock.

## Interaction and visual acceptance

The bundled in-app browser connection was attempted twice first, but the
current Windows session could not initialize it. The repository's isolated
Edge/CDP driver then exercised the same local browser bridge and generated the
evidence below.

The first visual review found that the new backup card existed in the DOM but
its History grid row was compressed to a 2 px border. History now uses
content-sized implicit rows, and the acceptance runner explicitly fails if the
backup card collapses below 120 px.

| Surface | Viewport | Horizontal overflow | Page overflow | Clipped controls | Controls below 44 px | Backup card height |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| History trust center | 1440×900 | 0 | 0 | 0 | 0 | 181 px |
| History trust center | 1280×800 | 0 | 0 | 0 | 0 | 181 px |
| History trust center | 1024×720 | 0 | 0 | 0 | 0 | 239 px |
| History trust center | 820×720 | 0 | 0 | 0 | 0 | 239 px |

The automated journey exported `我的小说` as one three-chapter Markdown file,
verified the work-scoped receipt, created a browser-fixture backup, inspected
it, and confirmed that restore became enabled only after validation. Runtime
errors were zero.

Evidence:

- [Visual metrics](./phase-1.2h-work-export-backup-visual-metrics.json)
- [History trust center, 1440×900](./screenshots/phase-1.2h-work-export-backup/01-history-work-export-backup-1440x900.png)
- [History trust center, 1280×800](./screenshots/phase-1.2h-work-export-backup/02-history-work-export-backup-1280x800.png)
- [History trust center, 1024×720](./screenshots/phase-1.2h-work-export-backup/03-history-work-export-backup-1024x720.png)
- [History trust center, 820×720](./screenshots/phase-1.2h-work-export-backup/04-history-work-export-backup-820x720.png)

## Automated verification

| Gate | Result |
| --- | --- |
| Focused export and writer-workspace regressions | 2 files / 20 tests passed |
| Visual icon-tier contract | 1 file / 4 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 161 files / 643 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 68 passed / 2 explicit external gates ignored |
| Change-aware full self-test | Passed; `artifacts/self-test/latest.json` |
| Tauri Release and NSIS | Passed |

The first full-suite run rejected three 17 px backup icons under the durable
visual contract. They were moved to the standard 18 px tier; the focused test
and the complete suite then passed.

## Native Windows smoke

The fresh portable Release was launched with an isolated WebView profile.

| Check | Result |
| --- | --- |
| Process | PID 41308 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2h-whole-work-export-backup-2026-08-01/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,633,970 | `8B918F613CF9F3311420DAB59893F860F683742FBA1C09A582FDA35F822AC8CF` |
| `Writing-Buddy-portable.exe` | 8,367,616 | `DEF13CEC171819C21606FDC23F8BE0B621E1D8DBA657E37EBE11FA47FC9B5E4A` |

The same values are machine-readable in `SHA256.json` beside the binaries.
