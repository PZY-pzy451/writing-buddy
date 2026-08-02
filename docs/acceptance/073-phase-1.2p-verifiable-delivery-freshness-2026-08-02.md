# Phase 1.2P verifiable delivery freshness acceptance

Date: 2026-08-02

## Outcome

Whole-work delivery freshness is now verified from the exact local source state.
An equal-word-count rewrite or a manifest-only change can no longer leave a
stale export marked as current.

## Source fingerprint contract verified

- Native project snapshots expose the SHA-256 of each readable manuscript's
  exact file bytes, keyed by chapter ID.
- The whole-work fingerprint is a versioned SHA-256 over the exact manifest
  revision plus ordered chapter ID, relative path and manuscript hash tuples.
- Export computes the fingerprint from the same files it reads into the Word,
  Markdown or plain-text payload and records it only after destination writing
  succeeds.
- Check reopens the local project read-only, rejects a changed manifest and
  recomputes the fingerprint from live chapter hashes.
- A delivery passes only when the latest project-scoped whole-work receipt has
  the exact same fingerprint and manuscript saving is clean.
- Old receipts remain visible as history but explicitly require re-export.
  Malformed persisted fingerprints are discarded instead of trusted.
- The UI states that this verifies the export source, not the continued
  existence or unchanged bytes of the destination file.

## Browser acceptance

The required in-app browser connection was attempted twice and hit the known
runtime initialization conflict. The isolated repository Edge/CDP driver then
exercised the same browser bridge from a fresh profile.

The journey exported a three-chapter Word document, observed `精确源指纹` in
History, expanded Check and observed the delivery row pass. It then changed only
the first chapter's lifecycle status. The visible publication context remained
`3 章 / 209 字`, while the delivery row changed to attention and stated that
equal word counts are not the same version.

| View | Result |
| --- | --- |
| History exact receipt, 1440×900 | Passed |
| Exact delivery match, 1440×900 | Passed |
| Exact delivery match, 1024×720 | Passed |
| Exact delivery match row, 820×720 | Passed |
| Stale same-count delivery row, 820×720 | Passed |

All measured views had zero horizontal or vertical page overflow, zero clipped
interactive controls, zero publish controls below 44 px, zero control occlusion
and zero runtime errors. Visual inspection also found that the export success
notice obscured narrow Check content; mode changes now dismiss that contextual
notice before the final browser run.

Machine-readable evidence is in
`phase-1.2p-delivery-freshness-visual-metrics.json`; screenshots are under
`screenshots/phase-1.2p-delivery-freshness/`.

## Automated verification

| Gate | Result |
| --- | --- |
| Focused fingerprint/export/review regressions | 4 files / 43 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 167 files / 686 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 77 passed / 2 explicit external gates ignored |
| Full self-test | Passed |
| Release self-test | Passed |
| Tauri Release and NSIS | Passed |

The first full gate caught two unsafe test matcher assignments. They were
replaced with direct, strongly typed fingerprint assertions; no production
failure was involved.

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 35788 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| WebView2 process tree children | 6 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2p-delivery-freshness-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,736,526 | `DF9DF05AAECB58D7BE0ED2F2CDB7302EFD03F3712D8DFE659BC81F9799D7A915` |
| `Writing-Buddy-portable.exe` | 8,593,920 | `B7F452A89C2813C0E56B3B31322715BD2DFA2C6FD6D4F1CAFD41200E5705E23C` |
| `self-test-release.json` | 8,088 | `64F73BB5C7D1DC2D5155F24C72D0712F42C90078F0C1485CC7877422E55286D8` |

The same values are machine-readable in `SHA256.json` beside the binaries.
