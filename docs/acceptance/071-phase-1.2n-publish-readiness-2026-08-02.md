# Phase 1.2N publish readiness acceptance

Date: 2026-08-02

## Outcome

The primary Check page now gives the author an explainable, local publication
gate before final delivery. The gate derives its result from the current
manuscript, save state, chapter completion metadata, project integrity, review
backlog and durable whole-work export receipts.

## Readiness contract verified

- Missing manuscripts, empty chapters, unsafe saves, project integrity errors
  and unresolved error-level review issues are explicit blockers.
- Incomplete chapter metadata, read-only projects, integrity warnings,
  non-error review suggestions and absent or scale-mismatched whole-work
  receipts remain author decisions.
- A completely clean project is labelled `可以交付`; the interface does not
  claim that AI inspected every line.
- A matching receipt is described as chapter-count and word-count scale
  evidence only, not as byte-for-byte or line-by-line verification.
- The initial summary is compact. Expanding the six-item checklist performs no
  AI request, manuscript write, snapshot or export.

## Action handoff verified

| Condition | Existing safe destination |
| --- | --- |
| Unsafe current edit | Central save transaction |
| No chapter | Planning |
| Empty/incomplete chapter | Exact manuscript chapter |
| Review issue | Exact chapter and evidence offset with the Check tool open |
| Non-chapter consistency issue | Whole-work consistency review |
| Missing/stale delivery receipt | History and whole-work Word export |

## Focused regression

Two focused files / 13 tests passed. Coverage includes:

- completely ready projects;
- active unsaved word-count projection;
- empty chapters and dirty, offline, failed or conflicting saves;
- review errors versus author-level suggestions;
- read-only and project-integrity states;
- incomplete chapter metadata;
- newest matching and stale whole-work receipts;
- collapsed disclosure, local-only explanation, save recomputation, exact
  review navigation and final History handoff.

## Browser acceptance

The required in-app browser connection was attempted twice and hit the known
runtime initialization conflict. The isolated repository Edge/CDP driver then
exercised the same browser bridge from a fresh profile.

| View | Result |
| --- | --- |
| Summary, 1440×900 | Passed |
| Expanded checklist, 1440×900 | Passed |
| Expanded checklist, 1024×720 | Passed |
| Expanded checklist, 820×720 | Passed |
| Narrow checklist rows, 820×720 | Passed |
| History handoff, 820×720 | Passed |

All measured views had zero horizontal page overflow, zero clipped interactive
controls, zero publish controls below 44 px, zero publish-control occlusion and
zero runtime errors. Machine-readable evidence is in
`phase-1.2n-publish-readiness-visual-metrics.json`; screenshots are under
`screenshots/phase-1.2n-publish-readiness/`.

## Automated verification

| Gate | Result |
| --- | --- |
| Focused model/page regressions | 2 files / 13 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 167 files / 679 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 74 passed / 2 explicit external gates ignored |
| Full self-test | Passed |
| Release self-test | Passed |
| Tauri Release and NSIS | Passed |

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 44336 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2n-publish-readiness-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,732,149 | `757D5FFA05731BF9109B0F837FAFC83AC6313DE65066DF381C3C44CE318CA663` |
| `Writing-Buddy-portable.exe` | 8,581,120 | `91864B8C764E25B3437325B8B453C2B9BE80CF5C2456602566DCD32F33C5BF6C` |
| `self-test-release.json` | 5,873 | `7F5AA7398A5CB862480D8855EF6D8C7110FA0FBCE6DDC9A5B3FB2303903EF3F0` |

The same values are machine-readable in `SHA256.json` beside the binaries.
