# Phase 1.2L whole-work consistency acceptance

Date: 2026-08-02

## Accepted outcome

Writing Buddy now turns its existing grounded cross-chapter engine into a
complete primary Check task.

- The Review Center exposes `全书一致性` directly instead of requiring authors
  to discover it under Planning. The compatibility Planning route remains.
- `全书扫描` is the default AI comparison scope. It loads saved manuscript
  chapters locally, skips empty chapters, preserves manuscript order and plans
  at most eight sequential requests under the existing 2–12 source / 160,000
  aggregate-character contract.
- Consecutive batches reuse their boundary chapter when it fits. The interface
  describes this as ordered batch coverage rather than claiming an exhaustive
  all-pairs comparison.
- Oversized chapters, fewer than two written chapters, impossible source pairs
  and works requiring more than eight batches fail before the first AI call.
- Results accumulate only in memory. Cancellation or failure in any later
  batch leaves the previous review set unchanged; a fully successful pass is
  deduplicated and handed off once. AI findings remain grounded, author-reviewed
  suggestions capped at warning severity.
- A synchronous in-flight lock and a stable disabled Start button prevent rapid
  repeated clicks from creating duplicate jobs. Stop is a separate deliberate
  action, so a double-click cannot accidentally cancel the new scan.

## Real browser journey

The bundled in-app browser bootstrap produced the same runtime initialization
conflict twice, so the repository's isolated Edge/CDP driver exercised the
same browser bridge and visible workflow:

1. Opened the fixture project and entered primary `检查`.
2. Verified the new `全书一致性` task and opened it with one action.
3. Opened `AI 对照审查`; verified full-work scope, per-batch privacy text and
   the explicit `开始全书扫描` action.
4. Switched to `自选章节`; verified all chapters remained available and the
   first two were selected under the existing 2–12 chapter contract.

Initial screenshot inspection found that the 820 px panel was underneath the
Planning sidebar even though its controls remained technically clickable. The
final modal stacking fix keeps the full panel visible and adds a left-edge
occlusion probe to the automated acceptance.

| Viewport / surface | Overflow X/Y | Clipped controls | Controls below 44 px | Occluders | Panel edge covered | Runtime errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1440×900 Review Center | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| 1440×900 whole-work panel | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| 1024×720 whole-work panel | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| 820×720 whole-work panel | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| 820×720 selected panel | 0 / 0 | 0 | 0 | 0 | 0 | 0 |

Evidence:

- [Visual metrics](./phase-1.2l-whole-work-consistency-visual-metrics.json)
- [Review Center entry, 1440×900](./screenshots/phase-1.2l-whole-work-consistency/01-review-center-entry-1440x900.png)
- [Whole-work panel, 1440×900](./screenshots/phase-1.2l-whole-work-consistency/02-whole-work-panel-1440x900.png)
- [Whole-work panel, 1024×720](./screenshots/phase-1.2l-whole-work-consistency/03-whole-work-panel-1024x720.png)
- [Whole-work panel, 820×720](./screenshots/phase-1.2l-whole-work-consistency/04-whole-work-panel-820x720.png)
- [Selected-chapter panel, 820×720](./screenshots/phase-1.2l-whole-work-consistency/05-selected-panel-820x720.png)

## Automated verification

| Gate | Result |
| --- | --- |
| Focused plan/panel/page regressions | 4 files / 14 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 165 files / 667 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 74 passed / 2 explicit external gates ignored |
| Full self-test | Passed |
| Release self-test | Passed |
| Tauri Release and NSIS | Passed |

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 22732 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2l-whole-work-consistency-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,726,704 | `164C63E329630FE34B82878994D14F6753BC7F1B79AE1D8AC0B95BF7BC0ABFA5` |
| `Writing-Buddy-portable.exe` | 8,577,024 | `112841202984314B34BD42F5860C0A8B0125427E6E204BA6CC31AF1371DA7C3C` |

The same values are machine-readable in `SHA256.json` beside the binaries.
