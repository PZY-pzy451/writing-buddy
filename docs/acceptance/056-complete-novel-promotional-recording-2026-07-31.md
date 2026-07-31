# Complete novel promotional recording acceptance

Date: 2026-07-31

Branch: `codex/genre-to-draft-gates-a-c`

Baseline: `e57e7c64 feat: add long-output novel acceptance`

## Outcome

Writing Buddy now has a reproducible promotional demonstration built from a
real Windows desktop-client session and a disposable copy of the complete
`《零点回声》` project.

The final cut shows:

1. a 12-chapter, 26K-word project overview;
2. the Creation Journey and its story/act/chapter/scene hierarchy;
3. a real chapter manuscript and active scene;
4. grounded AI context selected by the author;
5. three distinct continuation candidates;
6. explicit author adoption, safety snapshot and save confirmation;
7. current-scene character context;
8. navigation to the final chapter and completed ending; and
9. the final 12-chapter, 26,266-word, zero-pending project overview.

## Deliverables

- Captioned promotional cut:
  `artifacts/promo/complete-novel-writing-2026-07-31/Writing-Buddy-complete-novel-demo.zh-CN.mp4`
- Separate captions:
  `artifacts/promo/complete-novel-writing-2026-07-31/captions.zh-CN.srt`
- Shot list and disclosure:
  `artifacts/promo/complete-novel-writing-2026-07-31/shot-list.md`
- Clean source recording:
  `artifacts/promo/complete-novel-writing-2026-07-31/raw/complete-novel-writing-webview-take.mp4`
- Reproducible recorder, fixture installer and compositor:
  `scripts/recording/`
- Updated portable executable:
  `artifacts/release/complete-novel-promo-2026-07-31/Writing-Buddy-portable.exe`
- Updated NSIS installer:
  `artifacts/release/complete-novel-promo-2026-07-31/Writing-Buddy-0.1.0-x64-setup.exe`

The promotional artifacts remain outside source control through the existing
`artifacts/` ignore rule. The code, regression test, recording utilities and
acceptance record are committed.

## Capture and edit verification

| Check | Result |
| --- | --- |
| Capture source | Writing Buddy Windows WebView via CDP screencast |
| Raw source | 2560×1370, H.264, 8 fps, 6:24 |
| Final cut | 2560×1440, H.264 High, yuv420p, 24 fps, 6:27 |
| Public-cut size | 11,725,632 bytes |
| Public-cut SHA-256 | `69ee4197aaab778e899c42a4cdd05d7f42e84c0eeb87028261d1a3c8c864e441` |
| Full decode | Passed with zero ffmpeg decode errors |
| Contact-sheet review | Passed at 15-second intervals plus a 1-second cut-boundary review |
| Cursor preflight warning | Removed from source interval 00:01:19–00:01:32 |
| Visible raw errors | None in public cut |
| Secrets/personal paths | None visible |
| Debug console/terminal | None visible |
| AI/character panels | Present in direct WebView capture |

The first Windows GDI attempts were rejected because compositor-hosted
sidebars did not appear in those videos. The direct WebView recorder is the
accepted capture path.

## Rehearsal defect and regression

After an AI candidate was inserted, the host correctly advanced the manuscript
revision. The continuation panel then treated its already accepted batch as
stale, showing a red warning beside the green success message.

The stale calculation now applies only while a batch has not been accepted.
The focused regression rerenders the panel with the updated manuscript and
revision, verifies that the snapshot success remains visible and verifies that
the stale warning is absent.

## AI fixture boundary

`install-complete-novel-promo-fixture.mjs` installs a deterministic response
fixture into the currently connected diagnostic WebView only. It intercepts
the diagnostic page's AI IPC transport and provides the three scripted
directions used in the recording. It does not change production application
code, AI provider settings, release artifacts or the canonical novel fixture.

The public shot list states that AI output remains a candidate until the
author explicitly adopts it.

## Automated validation

All commands used Node 24.14.0 unless noted.

| Gate | Result |
| --- | --- |
| Focused continuation regression | 1 file / 5 tests passed |
| ESLint | Passed, zero warnings |
| TypeScript | Passed |
| Vitest | 157 files / 604 tests passed |
| Production Vite build | Passed |
| Cargo format | Passed |
| Cargo test | 68 passed / 2 explicit external gates ignored |
| Complete-novel static acceptance | 12 chapters / 24 scenes / 29,770 non-whitespace characters |
| Tauri Release / NSIS | Passed |
| Fresh portable smoke | Startup page accessible; Alt+F4 normal exit; exit code 0 |
| Final MP4 full decode | Passed |

The existing comprehensive native CDP acceptance runner did not reach its
first application assertion in this environment: the hidden Release process
did not publish the requested WebView debugging port, so the runner stayed in
target discovery until the external timeout. This gate is not counted as
passed or as a product failure. Its static preparation gate passed, the same
native suite passed on the baseline release, and this change does not modify
the Rust/native boundary. The new binaries received a separate visible
startup, accessibility-tree and normal-close smoke check.

## Windows binary hashes

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-portable.exe` | 8,358,912 bytes | `161e5941cd2d77f0a8b4640b8faf825e6ae929ce7ad40554241a558c6545933f` |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,627,724 bytes | `bbfca32a5274c417eca98b990e9be6e71bf6d36f1cf1ac560da5139c45e32de3` |

## Promotion claims

The recording demonstrates that Writing Buddy supports an end-to-end,
author-controlled novel workflow. It does not claim that a single opaque AI
request wrote the entire novel. The recorded AI step is a bounded continuation
choice grounded in the current manuscript and confirmed resources.
