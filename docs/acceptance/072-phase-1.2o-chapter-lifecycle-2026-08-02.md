# Phase 1.2O chapter lifecycle acceptance

Date: 2026-08-02

## Outcome

The publication-readiness dead end is closed. An author can now see and change
the active chapter between `初稿`, `修订中` and `已完成` directly in the writing
header, then observe the Check page recompute from the verified project state.

## Author-control contract verified

- Missing status metadata remains backward compatible and appears as `初稿`.
- Each state has text and a Lucide icon; color is supporting information only.
- The menu explains that status is author-controlled metadata and does not
  judge prose quality or modify manuscript content.
- Transitions are reversible. Browser and component tests exercised
  `初稿 → 已完成 → 修订中 → 已完成`.
- Read-only projects show the current status without exposing an edit control.
- No status transition invokes AI, writes Story Kernel data or creates a
  snapshot.

## Persistence safety verified

- Dirty manuscript content is saved through the central save transaction before
  a status update. A failed save prevents the native status command entirely.
- The native command requires the current project revision, validates the fixed
  status vocabulary and locates the exact chapter before writing.
- It changes only `.writing-buddy/project.json`, writes atomically, reopens the
  project and verifies the status and new manifest hash.
- Verification failure restores the exact previous manifest bytes.
- Rust no-write coverage includes stale revisions, unsupported states and
  missing chapter IDs; success coverage confirms manuscript bytes are unchanged.

## Browser acceptance

The required in-app browser connection was attempted twice and hit the known
runtime initialization conflict. The isolated repository Edge/CDP driver then
exercised the same browser bridge from a fresh profile.

| View | Result |
| --- | --- |
| Draft status, 1440×900 | Passed |
| Status menu, 1440×900 | Passed |
| Completed status, 1440×900 | Passed |
| Status menu, 1024×720 | Passed |
| Status menu, 820×720 | Passed |
| Publish readiness after transition, 820×720 | Passed |

All measured views had zero horizontal or vertical page overflow, zero clipped
interactive controls, zero chapter-status controls below 44 px, zero control
occlusion and zero runtime errors. The publish checklist changed from three to
two unfinished chapters immediately after the first chapter was completed.
Machine-readable evidence is in
`phase-1.2o-chapter-lifecycle-visual-metrics.json`; screenshots are under
`screenshots/phase-1.2o-chapter-lifecycle/`.

## Automated verification

| Gate | Result |
| --- | --- |
| Focused chapter/publish regressions | 2 files / 27 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 167 files / 682 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 76 passed / 2 explicit external gates ignored |
| Full self-test | Passed |
| Release self-test | Passed |
| Tauri Release and NSIS | Passed |

The full suite initially caught two visual-contract regressions in the new
control: a disabled opacity below the project threshold and 15/17 px one-off
icons. Both were corrected to the established opacity and 16/18 px tiers before
the final green run.

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 24568 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| Direct WebView2 child | 1 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2o-chapter-lifecycle-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,735,091 | `6754BBCB0DA755C7CE467524CF9360AAE80EC425794A44EE364984511E65359D` |
| `Writing-Buddy-portable.exe` | 8,592,896 | `8E0FF07505AC3C45F19EFC5F6B8819C4221E2594798455AA808B622B54D3F924` |
| `self-test-release.json` | 6,684 | `05FE87EA60FCC63071F8DCFABB0E0C2722A2E9274FBF51E00A5B4E10390D800E` |

The same values are machine-readable in `SHA256.json` beside the binaries.
