# Inline AI language check acceptance

Date: 2026-07-29

## Outcome

Writing Buddy now provides an opt-in AI spelling and grammar check inside the
Monaco manuscript editor. After the author pauses for 1.2 seconds, only the
changed paragraph is checked and clear problems appear as native editor
squiggles. The feature never rewrites text automatically: each replacement is
an explicit Monaco edit and remains available to normal Undo.

## Privacy and reliability contract

- The persisted preference is off by default.
- Opening the application or a project does not start a request, even if a
  returning author previously enabled the feature.
- Initial enable and explicit retry check only the cursor paragraph. Later
  edits check only the changed paragraph.
- Each request is limited to 2,400 JavaScript UTF-16 code units. Long
  paragraphs use a bounded sentence-aware window around the edit.
- Only one inline job runs at a time. Newer edits cancel stale work, exact
  completed slices use a 64-entry session cache, and retryable failures enter a
  ten-second cooldown.
- The dedicated prompt accepts only clear spelling, typo, grammar,
  collocation, punctuation, and duplicate-word findings. Style and optional
  polishing advice are excluded.
- Returned targets must match the submitted slice exactly or re-anchor to one
  unique occurrence. Mismatched or ambiguous results are discarded before
  Monaco receives a marker.
- The native Rust validator enforces the same job type, prompt, model, JSON
  response, thinking-disabled mode, and slice bound as the TypeScript
  contract.

## Editor behavior

The editor toolbar exposes the current state as **AI 语法 关/开/数量**. Its
dialog explains the data boundary and shows issue title, exact source target,
explanation, and replacement. Monaco warning markers and hover decorations
carry the same explanation and replacement text. Status, icons, and labels
make the feature usable without relying on color alone.

The deterministic browser provider returned the following accepted case:

| Source | Diagnostic | Replacement |
| --- | --- | --- |
| `somthing` | English spelling error | `something` |

Applying the proposed replacement changed only that marker range and removed
the squiggle. `Ctrl+Z` restored `somthing` and the cached finding restored the
squiggle without a second provider request.

## Automated gates

| Gate | Result |
| --- | --- |
| Runtime | Node 24.14.0 / pnpm 10.32.1 |
| `pnpm acceptance` | ESLint, TypeScript, 103 files / 363 tests, and production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 52 passed / 2 explicit external gates ignored / 0 failed |
| `pnpm tauri:build` | Release EXE and NSIS installer built |
| Isolated native startup/normal close | PID 38244; responsive; close requested; exit code 0 |

Unit coverage includes bounded changed-paragraph and long-paragraph slicing,
UTF-16 surrogate safety, response verification, rebasing, slice replacement,
exact-result caching, cancellation, settings state, prompt parity, marker
presentation, explicit replacement, and read-only behavior.

## Browser interaction evidence

The in-app browser exercised the local Vite application and deterministic AI
fixture without a real provider credential or author project.

At 1280x720 in Paper:

- the disabled state displayed **AI 语法 关**;
- the settings disclosure and explicit opt-in were reachable;
- opening a project with the stored opt-in produced no request or diagnostic;
- typing `somthing` produced one `.squiggly-warning` after the debounce;
- the dialog showed the exact source, explanation, and
  **替换为“something”** action;
- replacement and `Ctrl+Z` behaved as described above.

At 1024x720 in Paper and Midnight:

- the portalled dialog remained inside the viewport instead of being clipped
  by the task dock;
- Midnight dialog geometry was 340px wide, about 325px high, and ended at
  y=671 inside the 720px viewport;
- the editor squiggle, status, issue card, and replacement action remained
  visible;
- browser warning and error logs were empty.

The fixture manuscript was restored to its original 94 characters, the Paper
theme and default viewport were restored, and the browser session was closed.

## Windows artifacts

- Portable EXE:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,407,616 bytes
  - SHA-256:
    `568C6D7512FBD437A4B7C0DF3E5A53769FFADBC5C332C55D0850E23D3D4998E2`
- NSIS installer:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,216,000 bytes
  - SHA-256:
    `AEB49A08249418822B62C25F97B1746B3F48E20F9354820B4121366F1C7EDDB2`
