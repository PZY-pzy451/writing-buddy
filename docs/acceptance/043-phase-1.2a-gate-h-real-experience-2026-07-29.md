# Phase 1.2A Gate H real experience acceptance

Date: 2026-07-29

## Decision

Gate H passes and Phase 1.2A is complete.

This result comes from five deterministic, isolated, no-explanation test
profiles driving the real React interface in Edge. The profiles are not five
people and this report is not a claim of qualitative human usability
research. A separate native Tauri smoke test covers the Windows executable,
real application-data directories, window lifecycle, and normal close.

## Ten-task outcome

Every profile completed the same visible-interface journey:

1. open Writing Buddy;
2. find and activate **继续上次位置**;
3. verify the expected chapter, cursor vicinity, scroll, and layout;
4. write more than 300 Chinese characters and save;
5. enter and exit focus mode;
6. switch to planning and back to writing;
7. resize the chapter sidebar and close;
8. start a second process and continue the restored position;
9. encounter one injected write failure and recover through **重试**;
10. verify that manuscript content and workspace layout remain intact.

The task journey used ordinary pointer, keyboard, Monaco input, and visible
controls. Fixture creation, one-shot save-failure injection, process control,
and read-only evidence collection stayed outside the task sequence.

| Required outcome | Result |
| --- | --- |
| Find Continue Writing | 5/5 |
| Input without explanation | 5/5 |
| Enter and exit focus mode | 5/5 |
| Recognize explicit save state | 5/5 |
| Recover visible save failure | 5/5 |
| Restore on second startup | 5/5 |
| Content or layout loss | 0/5 |
| Blocking crash | 0/5 |

Each profile inserted 413–424 characters. Cursor-line delta and scroll delta
were both zero after the second launch. Every sidebar moved from 272 px to
284 px and restored at the new width.

## Profiles and visual evidence

- [Paper pointer, restored writing at 1536×992](./screenshots/gate-writer-h/01-restored-writing-1536x992.png)
- [Paper keyboard, focus mode at 1280×800](./screenshots/gate-writer-h/02-keyboard-focus-mode-1280x800.png)
- [Paper compact planning at 1024×720](./screenshots/gate-writer-h/03-compact-planning-1024x720.png)
- [Midnight reduced motion, visible save failure at 1536×992](./screenshots/gate-writer-h/04-midnight-reduced-save-failure-1536x992.png)
- [Midnight keyboard, restored and saved at 1280×800](./screenshots/gate-writer-h/05-midnight-restored-1280x800.png)

All ten first/second-launch viewport checks report zero document horizontal
overflow and zero interactive controls clipped outside non-scrollable
regions. The screenshots were also inspected directly for hierarchy,
contrast, focus-mode clarity, responsive behavior, save status, and failure
recovery.

## Performance evidence

Project interaction, restore, and workspace switching met their established
budgets in all five profiles. The Edge-process shell-visible measure was
inside the 2,000 ms target in three profiles; two cold launches measured
2,041 ms and 2,046 ms, missing the target by 41–46 ms. The actual result is
retained as a performance follow-up rather than hidden.

| Measure | Actual range | Budget |
| --- | ---: | ---: |
| Shell visible | 1,053–2,046 ms | under 2,000 ms; 3/5 pass |
| First project interactive | 1,096–2,078 ms | under 5,000 ms |
| Second project interactive | 1,060–1,953 ms | under 5,000 ms |
| Continue to restored editor | 106–146 ms | under 10,000 ms |
| Planning switch | 37–42 ms | suggested under 150 ms |
| Writing switch | 38–60 ms | suggested under 150 ms |
| Focus enter/exit | 13–29 ms | recorded |
| Save failure visible | 15–25 ms | recorded |
| Retry to clean | 17–37 ms | recorded |

The machine-readable report contains only profile IDs, configuration,
booleans, timings, viewport metrics, and counts. It records no author
manuscript, prompts, AI output, person names, project paths, or API keys:
[`gate-writer-h-profile-metrics.json`](./gate-writer-h-profile-metrics.json).

The browser fixture stores project files in renderer memory. To test a new
browser process without inventing persistence, the runner rehydrates the exact
previously verified saved fixture content before the second user journey.
Writer-session and layout restoration still come from the real isolated Edge
profile. Native disk and process lifecycle are covered separately below.

## Automated verification

All final commands used Node 24.14.0 and pnpm 10.32.1. Native work used
`CARGO_BUILD_JOBS=1`.

| Check | Result |
| --- | --- |
| Gate H profile contract | 1 file, 2 tests passed |
| Gate H real-interface runner | 5 profiles, 50/50 tasks passed |
| Gate G interaction runner | Passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 128 files, 470 tests passed |
| Change-aware self-test | Passed complete frontend acceptance |
| Vite production build | Passed, 2,974 modules |
| Rust formatting | Passed |
| Rust tests | 55 passed, 2 explicit external gates ignored |
| Windows Tauri release | Passed |
| NSIS installer | Passed |
| Native launch / normal close | 785 ms, responsive, exit code 0 |

The two ignored Rust tests remain explicit opt-in gates for a supplied real
project recovery fixture and dedicated Release performance run. The
production build retains the existing Monaco chunk-size advisory.

## Build artifacts

- Portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,656,448 bytes
  - SHA-256
    `0B5A37ACBAB26A3F5928FFEFE591EEC31728457DBA82F4D39F04096FDF0F02B8`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,453,508 bytes
  - SHA-256
    `F2E263906357C748696FAC2D184A83091E2A7105425218A875586896FAA82648`

Both are internal unsigned Windows x64 0.1.0 builds. The portable executable
started with isolated application-data directories, exposed a responsive main
window titled `Writing Buddy`, accepted a normal close, and exited with code
0.

## Stop line

Phase 1.2A is complete. Do not start another feature phase without explicit
user direction.
