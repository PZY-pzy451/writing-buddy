# Zero-to-complete novel promotional recording acceptance

Date: 2026-07-31

Branch: `codex/genre-to-draft-gates-a-c`

Baseline: `91b52b2c fix: repair malformed AI manuscript responses`

## Outcome

The replacement promotional video now starts before a project exists and
finishes with a complete novella created, written and saved by the real
Writing Buddy Windows desktop client.

The accepted take visibly covers:

1. an empty Writing Buddy welcome state;
2. creating `《零点回声》` through the new-project wizard;
3. choosing genre-to-outline and entering the premise and constraints;
4. reviewing an editable generated outline;
5. confirming 1 volume, 3 chapters and 2 scenes per chapter;
6. atomically materializing the outline into native project files;
7. direct author writing plus `Ctrl+S`;
8. three separate AI manuscript candidates;
9. explicit author confirmation before each manuscript write;
10. snapshots, automatic saves and chapter navigation;
11. the resolved final sentence; and
12. the completed dashboard with 3 chapters and 26,210 characters.

This replaces the earlier promotional approach that opened an already
completed disposable project.

## Truth-contract evidence

| Check | Result |
| --- | --- |
| Target directory before take | Missing |
| Project creation | Visible Writing Buddy new-project flow |
| Preseeded project/manuscript files | None |
| Folder selection fixture | Diagnostic WebView only |
| AI response fixture | Diagnostic WebView only; normal app parsing and candidate flow retained |
| Creation Journey AI calls | 6 |
| Manuscript continuation calls | 3 |
| Duplicate continuation calls | 0 |
| Author confirmation | Required for every manuscript insertion |
| Native project writes | Normal Tauri project, hierarchy, snapshot and manuscript commands |
| Browser/runtime errors | 0 |

The deterministic fixture makes the promotional take repeatable without
provider latency or credentials. It does not copy chapter files into the new
project and it does not modify production AI transport. Every generated
result still crosses Writing Buddy's normal schema, review, confirmation and
native write boundaries.

## Native project verification

Project:

`artifacts/promo/zero-to-complete-novel-2026-07-31/workspace-final/零点回声/`

| Chapter | UTF-8 bytes | Characters | Non-whitespace | Scene anchors | SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| `chapter-001.md` | 29,029 | 10,222 | 9,634 | 2 | `a6bbc215e1fc1c3253b64569923b8a215885b056413119882eb2d54020930c8b` |
| `chapter-002.md` | 31,190 | 10,935 | 10,331 | 2 | `bcac61e23774fc482c3f264db88b06f9904b63f971c6f3ad92907fb419a3b12d` |
| `chapter-003.md` | 31,748 | 11,061 | 10,476 | 2 | `b6a00c0e20ab7e4db62bc50ac955d01b2c0b07795c1a5141a1f132a6fec3c5b6` |
| **Total** | **91,967** | **32,218** | **30,441** | **6** | — |

The third chapter contains and the video shows the resolved ending:

`她终于听见，海原来一直这么响。`

The difference between the native non-whitespace count and the 26,210
dashboard count is expected: the native audit counts Markdown structure and
scene anchors, while the dashboard presents author-facing manuscript text.

Machine-readable evidence:

`artifacts/promo/zero-to-complete-novel-2026-07-31/evidence-final/zero-to-novel-run.json`

## Video verification

| Check | Result |
| --- | --- |
| Accepted cut | `Writing-Buddy-zero-to-complete-novel.zh-CN.mp4` |
| Duration | 00:02:44.00 |
| Resolution | 2560×1440 |
| Video | H.264 High, yuv420p |
| Frame rate | 24 fps |
| Size | 6,295,797 bytes |
| SHA-256 | `279eba8501c74832cea0f2a32510b3490f6a90e3debf61964de7fc1a5537f3f4` |
| Full decode | Passed; zero ffmpeg errors |
| Frame review | Title, workflow contact sheet, dashboard and outro passed |
| Burned captions | Present |
| Separate captions | SRT and ASS present |
| Terminal/debug console/secrets | Not visible |

Deliverables:

- public cut:
  `artifacts/promo/zero-to-complete-novel-2026-07-31/Writing-Buddy-zero-to-complete-novel.zh-CN.mp4`;
- clean source take:
  `artifacts/promo/zero-to-complete-novel-2026-07-31/raw/zero-to-complete-novel-webview-take.mp4`;
- captions:
  `artifacts/promo/zero-to-complete-novel-2026-07-31/captions.zh-CN.srt`;
- shot list and disclosure:
  `artifacts/promo/zero-to-complete-novel-2026-07-31/shot-list.md`.

## Automated validation

All Node gates used Node 24.14.0.

| Gate | Result |
| --- | --- |
| Recording-script syntax | Passed |
| ESLint | Passed, zero warnings |
| TypeScript | Passed |
| Vitest | 157 files / 613 tests passed |
| Production Vite build | Passed |
| Cargo format | Passed |
| Cargo test | 68 passed / 2 explicit external gates ignored |
| From-zero native project audit | Passed |
| MP4 full decode | Passed |
| Tauri Release | Passed |
| NSIS | Passed |
| Production portable smoke | Responsive; title `Writing Buddy`; normal close |
| Production diagnostic port 9223 | Not listening |

The legacy `acceptance:complete-novel` runner was attempted but not counted as
passed: its production WebView did not publish the diagnostic CDP target and
the external command timed out during target discovery. This is the same
environmental limitation documented by the previous promotional acceptance.
The new recorded run supplies stronger direct evidence for this task because
it starts from a missing directory, uses the real desktop client and
independently audits the native files after completion.

## Windows delivery

Directory:

`artifacts/release/zero-to-complete-novel-promo-2026-07-31/`

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-portable.exe` | 8,363,008 bytes | `373b9066413524a9a9cf51df251affb3462d790635e68dea16dd6c86a8114be7` |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,628,359 bytes | `4bf2c2fff38bbe261e5bb8c86ec33831c85bfd173401edd2684942fd0ee98f80` |

The production build was created after stopping every diagnostic client. The
portable smoke confirmed that it does not expose the recording-only remote
debugging port.

## Promotion claim

The video demonstrates a complete, author-controlled novella workflow. It
does not claim that a single opaque request writes a commercial-length novel.
AI supplies bounded candidates; the author reviews and explicitly confirms
what enters the manuscript.
