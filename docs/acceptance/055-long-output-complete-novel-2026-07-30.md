# Long output and complete novel acceptance

Date: 2026-07-30

Repository: `D:\develop_tool\writing-buddy-genre-to-draft`

Branch: `codex/genre-to-draft-gates-a-c`

Baseline: `c77c854d feat: add inline ai draft insertion`

## Accepted scope

- Expanded the shared TypeScript, browser and Rust maximum-output preset
  contract from 8,192 through 384,000 tokens.
- Kept the existing 2,048-token default. Selecting a high ceiling does not
  force the provider to fill it.
- Added a visible warning at 64K and above because long requests can
  materially increase latency and cost; scene- or chapter-sized generation
  remains the recommended author workflow.
- Scaled the native hard deadline from a ten-minute minimum to a bounded
  maximum of two hours. A 384K request receives 100 minutes.
- Preserved partial plain-text output when the provider returns
  `finish_reason = length`.
- Rejected token-limited structured JSON before parsing or writing so a
  truncated Story Kernel response cannot become project data.
- Reduced Vitest concurrency to two workers and gave the asynchronous
  selection-rewrite acceptance path a five-second DOM query budget. Product
  assertions and the fail-before-write contract are unchanged.

The provider boundary is based on DeepSeek's official model and chat
completion documentation:

- `https://api-docs.deepseek.com/quick_start/pricing/`
- `https://api-docs.deepseek.com/api/create-chat-completion/`

No live paid DeepSeek generation was sent during deterministic acceptance.
The provider request/validation boundary, streaming completion state, browser
fixture and native persistence were exercised locally.

## Complete novel

`《零点回声》` is a completed near-future suspense first draft:

- 3 acts, 12 chapters and 24 authored scenes;
- 29,770 non-whitespace source characters;
- 26,225 Writing Buddy project words;
- 5 characters, 12 locations and 24 Story Kernel scenes;
- 68 indexed Story Kernel records in total;
- central mystery, protagonist arc, plot threads and foreshadowing resolved;
- no `TODO`, `TBD`, placeholder chapter or duplicated chapter body.

The generated project contains a valid manifest, all chapter manuscripts,
Creation Journey v2 state, scene anchors and Story Kernel resources. The
standalone manuscript SHA-256 is
`FC490B6531C24EEE1124968EEF4C76DFB396353B798E536BFA0F9F212F4276AC`.

## Native end-to-end acceptance

The same-source diagnostic desktop build completed these native operations:

1. Opened the generated project with zero integrity errors.
2. Read 12 chapter and 24 scene nodes from Creation Journey.
3. Rebuilt the Story Kernel index and queried all 24 scenes.
4. Round-tripped the 384,000-token preference and rejected 384,001.
5. Created a safety snapshot, edited a chapter and restored exact content.
6. Created, inspected and restored a 72-entry project backup.
7. Rendered 390×844, 1024×720, 1280×800 and 1536×992 profiles with the title
   visible and no page-level horizontal overflow.
8. Closed with exit code 0, reopened in a second native process, verified the
   same project and closed again with exit code 0.

There were zero runtime exceptions and zero console errors. Evidence:
`artifacts/novels/zero-hour-echo/acceptance-report.json` and its four
screenshots.

The final production portable executable independently reached input idle,
created its main window, accepted a non-forced Windows close request and
exited with code 0.

## Automated gates

Environment: Node `24.18.0`, pnpm `10.32.1`.

- ESLint: passed with zero warnings;
- TypeScript: passed;
- Vitest: 157 files / 603 tests passed;
- production Vite build: passed;
- Cargo formatting: passed;
- Rust: 68 passed, 2 explicit external-data gates ignored;
- Tauri optimized Release build: passed;
- NSIS x64 installer: passed;
- release self-test: passed in 288.5 seconds;
- complete-novel native acceptance: passed.

The two ignored Rust gates still require their explicit external
`STORYFORGE_REAL_PROJECT` and performance fixtures. They are not product-test
failures.

## Delivery

Release directory:
`artifacts/release/long-output-complete-novel-2026-07-30/`

- portable EXE:
  `12A8B97A2003289214B10114CDE07395A5BB428CC9C72CA2F6ABD3D0D9C084C0`
- NSIS installer:
  `F428A8F6721024C5211466B5B3D5741282C877F05EDBDB6DBE2836233167C637`
- release self-test report:
  `D97FF4029DCA758E95DB8CE0029DC4F32BF79691BD35E87C4B79E6FB0B4858E1`
- native complete-novel report:
  `0C6C97E0EFE576AC612780DC5B9646AF5294178489F9C54BBD843AD41237A7EF`

Novel delivery:
`artifacts/novels/zero-hour-echo/`

- `零点回声-完整初稿.md`
- `Writing Buddy Project/`
- `acceptance-report.json`
- `screenshots/`
