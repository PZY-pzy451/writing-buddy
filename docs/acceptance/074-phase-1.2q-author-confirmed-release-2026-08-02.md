# Phase 1.2Q author-confirmed release candidate acceptance

Date: 2026-08-02

## Outcome

An exact whole-work export is no longer treated as the author's final delivery
decision. Check now requires one explicit, reversible author confirmation before
the delivery row passes, and History preserves which exact export was selected.

## Contract verified

- Only whole-work receipts with a valid exact source fingerprint can receive a
  strict ISO `confirmedAt` value.
- Confirming a receipt clears the previous active confirmation for the same
  project without changing other projects.
- Confirmation changes only local receipt metadata. It does not write the
  project, manuscript, manifest or exported destination.
- Check passes delivery only when the confirmed receipt still matches a fresh
  read-only source inspection and manuscript saving is clean.
- A later export does not silently replace an exact confirmed candidate. A
  source or manifest change visibly makes the confirmation stale.
- History exposes the confirmation timestamp and a 44 px reversible
  `取消发布确认` action. Malformed timestamps and confirmations on legacy or
  chapter receipts are discarded while parsing persistence.

## Browser acceptance

The in-app browser connection was attempted twice and hit the recurring runtime
initialization conflict. The isolated repository Edge/CDP driver then exercised
the same browser bridge from a fresh profile.

The journey exported a three-chapter Word work, observed an exact but
unconfirmed delivery, confirmed it in Check, changed only chapter lifecycle
metadata to make it stale, navigated to History, reloaded the application,
verified the confirmation was still present and finally revoked it.

The first scripted run assumed a project reload would remain on History. The
product intentionally restores to Writing Home, so the acceptance route was
corrected to reload, wait for Writing Home and explicitly return to History. No
product persistence failure was found.

| View | Result |
| --- | --- |
| History exact receipt, 1440×900 | Passed |
| Exact export awaiting confirmation, 1440×900 | Passed |
| Confirmed delivery, 1440×900 | Passed |
| Confirmed delivery, 1024×720 | Passed |
| Confirmed delivery row, 820×720 | Passed |
| Stale confirmed delivery row, 820×720 | Passed |
| Reloaded History confirmation, 1024×720 | Passed |
| Revoked History confirmation, 1024×720 | Passed |

All eight measured views had zero horizontal or vertical page overflow, zero
clipped interactive controls, zero scoped controls below 44 px, zero control
occlusion and zero runtime errors. Keyboard regression also confirms that the
delivery-row action retains focus when confirmation changes it into
`查看交付记录`.

Machine-readable evidence is in
`phase-1.2q-author-confirmed-release-visual-metrics.json`; screenshots are under
`screenshots/phase-1.2q-author-confirmed-release/`.

## Automated verification

| Gate | Result |
| --- | --- |
| Focused export/readiness/experience regressions | 4 files / 46 tests passed |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 167 files / 689 tests passed |
| Production Vite build | Passed |
| `cargo fmt -- --check` | Passed |
| Rust tests | 77 passed / 2 explicit external gates ignored |
| Full self-test | Passed |
| Release self-test | Passed |
| Tauri Release and NSIS | Passed |

The optional UI/UX recommendation helper was absent. Its documented
accessibility, touch-target, responsive, focus and contrast rules were applied
directly and verified in the browser run.

## Native Windows smoke

| Check | Result |
| --- | --- |
| Process | PID 39600 |
| Input idle | Reached |
| Main window title | `Writing Buddy` |
| Main window responding | Yes |
| WebView2 process tree children | 6 |
| Diagnostic ports 9223 / 9751 | None |
| Normal close requested | Yes |
| Normal exit | Yes, code 0 |

## Windows delivery

Directory:
`artifacts/release/phase-1.2q-author-confirmed-release-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,737,850 | `B3D736D83F420D44C8882041F50A8CD5E6802639846FAC41FE78E56A05FEEFD4` |
| `Writing-Buddy-portable.exe` | 8,598,016 | `538052453B98C0682A8001C50177702D6E4715D73D13B02605CFABE533A5DCF7` |
| `self-test-release.json` | 7,032 | `C11E622A1E85AFBDACCE9F01BAAFADBF181E551F065D42C417E50779E71BDC38` |

The same values are machine-readable in `SHA256.json` beside the binaries.
