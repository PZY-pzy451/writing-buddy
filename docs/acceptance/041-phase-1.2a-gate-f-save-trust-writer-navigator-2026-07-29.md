# Phase 1.2A Gate F save trust and Writer Navigator acceptance

Date: 2026-07-29

## Decision

Gate F is complete and recommended for human approval. The implementation
stops before Gate G.

The gate adds one explicit manuscript save-state contract, persistent recovery
and close protection, and a local-only Writer Navigator opened with
`Ctrl/Cmd+K`. It reuses the atomic file writer, external-conflict comparison,
Writer Session, Story Repository, resource routes, TextAnchor, and editor
reveal path. It adds no AI action, Prompt, provider, Story resource type,
project index, cloud service, or resident process.

## Save trust

- Every manuscript surface reads the same `clean`, `dirty`, `saving`,
  `offline`, `failed`, or `external_conflict` state and presents explicit
  text such as **正在保存…**, **已保存**, **离线，等待保存**, **保存失败**, and
  **文件已被其他程序修改**.
- The atomic write now records the exact payload sent to disk. Text entered
  while that write is running remains dirty instead of being misreported as
  saved.
- A second explicit save request made during an in-flight write is queued and
  writes the newer content against the first write's returned hash.
- Persistent failure stays visible with **重试**, **另存副本**, and sanitized
  diagnostics. Raw paths and exception details are not exposed.
- The existing conflict workflow continues to preserve local and disk content
  and exposes comparison, reload, save-copy, and explicit overwrite.
- Disk polling is suspended during an active write, preventing a completed
  atomic save from being mistaken for an external edit.

## Close protection

- Clean windows flush Writer Session and close normally.
- A close requested during saving waits for the write to resolve and exits
  only after the state becomes clean.
- Dirty, offline, failed, and conflicting states block silent exit and show a
  keyboard-accessible decision dialog.
- Save/retry, save-copy, explicit discard, and cancel remain distinct actions.
  The dialog states that Quick Captures are already durable and unconfirmed AI
  candidates have not entered the manuscript.
- The final accepted close flushes Writer Session and destroys only the
  current Tauri window.

## Writer Navigator

- The top search affordance and `Ctrl/Cmd+K` synchronously open one
  keyboard-first navigator.
- It groups chapters, scenes, on-demand manuscript occurrences, existing Story
  resources, settings, recent stable IDs, and existing local commands.
- Up/Down and Home/End select results. Enter opens, `Ctrl/Cmd+Enter` previews
  without leaving, and Escape closes while restoring the previous focus.
- Manuscript matches carry exact TextAnchor data. Acceptance opened the
  navigator from **第二章 迷路的旅人**, searched a phrase that exists only in
  chapter one, and reached **第一章 停摆的时钟** through the canonical
  resource/reveal path.
- Manuscript scanning begins only after a non-empty query, uses four bounded
  workers and a process-memory per-project cache, and stores no author text or
  paths in recent history.
- Browser instrumentation found zero AI surfaces opened by search, preview,
  focus restoration, or navigation.

## Automated verification

The final commands used Node 24.14.0 and pnpm 10.32.1.

| Check | Result |
| --- | --- |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Gate F targeted tests | 6 files, 27 tests passed |
| Complete Vitest suite | 124 files, 446 tests passed |
| Change-aware self-test | Passed; 152 related and 63 safety tests |
| Vite production build | Passed, 2,969 modules |
| Rust formatting | Passed |
| Rust tests | 53 passed, 2 explicit external gates ignored |
| Windows Tauri release | Passed |
| NSIS installer | Passed |
| Native launch / normal close | Responsive, exit code 0 |

One first full-suite pass observed the pre-existing association-page fixture
empty in a concurrent run. The same test passed in isolation and the complete
Node 24 suite then passed at 124/124 files and 446/446 tests without a product
change.

## Visual and interaction acceptance

The deterministic browser fixture exercises the real compiled React surface:

- [Writer Navigator TextAnchor preview, 1536×992](./screenshots/gate-writer-f/01-writer-navigator-preview-1536x992.png)
- [Unified resource and manuscript search, 1280×800](./screenshots/gate-writer-f/02-writer-navigator-unified-search-1280x800.png)
- [Distinct local command result, 1024×720](./screenshots/gate-writer-f/03-writer-navigator-command-1024x720.png)

All three targets report:

- zero page X/Y overflow;
- zero clipped interactive controls;
- zero effective controls below 44 px;
- the dialog fully inside the viewport;
- input focus on open and trigger focus restored on Escape;
- zero AI drawer/review/continuation surfaces.

At 1024×720 the command result uses distinct dashed treatment and the dialog
remains inside the compact two-column workspace. Machine-readable evidence is
in [`gate-writer-f-visual-metrics.json`](./gate-writer-f-visual-metrics.json).

## Build artifacts

- Portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,636,480 bytes
  - SHA-256
    `0F76F00DB466873AF2B88DCEE4F2850A9AD4E9B07D099A3E13E437037B77557D`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,444,889 bytes
  - SHA-256
    `39CB5A8CEAA0438EC5FA96DF3E16E2904D52D93D3367AF7457B0D13ABF625F48`

Both are internal unsigned Windows x64 0.1.0 builds.

The portable executable was launched with isolated application-data
directories as PID 6884. It became input-idle, exposed a responsive main
window titled `Writing Buddy`, accepted normal close, and exited with code 0.

## Build advisory

The first cold release target exhausted memory under Cargo's default parallel
job count and produced the known cascade of invalid dependency diagnostics.
Per `docs/postmortem/004-cargo-release-memory-pressure.md`, that target was not
reused. The accepted build used `CARGO_BUILD_JOBS=1` and the known-clean Gate E
dependency cache, then freshly compiled the application, linked the EXE, and
created the installer.

The production build retains the existing Monaco chunk-size advisory. Gate F
adds no eager manuscript index or background process.

## Stop line

Do not begin Gate G until a new user direction explicitly authorizes it.
