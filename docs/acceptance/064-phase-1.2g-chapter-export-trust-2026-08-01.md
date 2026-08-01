# Phase 1.2G chapter completion and export trust acceptance

Date: 2026-08-01

## Accepted outcome

The author journey now closes after drafting: `整理本章` remains the explicit,
chapter-scoped organization path, while `导出章节` writes a deliverable copy
and records a trustworthy receipt in History.

- The chapter menu exports Markdown directly and explains that the destination
  will be recorded in History.
- `历史与导出` leads with one primary action, `导出 Markdown`, and offers
  plain-text export, snapshots and restore as secondary actions.
- Dirty manuscript content must save successfully before export. A failed save
  performs no export and creates no receipt.
- Cancelling the native save dialog is treated as cancellation, not success.
- A receipt is created only after the copy write succeeds. It includes chapter,
  format, word count, timestamp and exact destination, scoped to the project.
- Plain-text export removes editor-only scene anchors and Markdown headings;
  Markdown export preserves the manuscript unchanged.
- Successful receipts survive workspace restart through guarded parsing; malformed
  persisted entries are ignored.

## Interaction and visual acceptance

The repository's isolated Edge/CDP driver exercised the real browser bridge.
The bundled in-app browser bootstrap was attempted twice first, but the current
Windows session rejected its runtime initialization (`Cannot redefine property:
process`), so the equivalent repository driver generated the final evidence.

| Surface | Viewport | Horizontal overflow | Page overflow | Clipped controls |
| --- | ---: | ---: | ---: | ---: |
| Chapter completion menu | 1440×900 | 0 | 0 | 0 |
| History with export receipt | 1280×800 | 0 | 0 | 0 |
| History medium | 1024×720 | 0 | 0 | 0 |
| History compact | 820×720 | 0 | 0 | 0 |

The first run exposed one clipped density option after the new menu action was
added. The chapter menu now has a viewport-bounded scroll area, and the rerun
passed all four profiles with zero runtime errors.

Evidence:

- [Visual metrics](./phase-1.2g-export-trust-visual-metrics.json)
- [Chapter completion menu, 1440×900](./screenshots/phase-1.2g-export-trust/01-chapter-completion-menu-1440x900.png)
- [History receipt, 1280×800](./screenshots/phase-1.2g-export-trust/02-history-export-receipt-1280x800.png)
- [History, 1024×720](./screenshots/phase-1.2g-export-trust/03-history-export-1024x720.png)
- [History, 820×720](./screenshots/phase-1.2g-export-trust/04-history-export-820x720.png)

## Automated verification

| Gate | Result |
| --- | --- |
| Focused export, writer workspace and visual-contract regressions | 3 files / 20 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 161 files / 639 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 68 passed / 2 explicit external gates ignored |
| Change-aware full self-test | Passed; `artifacts/self-test/latest.json` |
| Tauri Release and NSIS | Passed |

## Native Windows smoke

The fresh portable Release was launched with an isolated WebView profile.

| Check | Result |
| --- | --- |
| Process | PID 37408 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2g-chapter-export-trust-2026-08-01/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,633,771 | `581B84DB54A3EAE7640DEF80554492F47A76420FE36905CF9250C3BFA405F532` |
| `Writing-Buddy-portable.exe` | 8,367,616 | `C14EC69A29DE8258BF33CB2BB2FD41C2B28D0EB311640A6E3D50681548A62C49` |

The same values are machine-readable in `SHA256.json` beside the binaries.
