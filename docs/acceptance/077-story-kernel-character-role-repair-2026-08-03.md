# Story Kernel character-role repair acceptance

Date: 2026-08-03  
Status: PASS  
Verified source: `75ddef7f832826c5f75ca934abb51f922ba7bf82`

## User-visible outcome

- Character candidates no longer become unconfirmable only because an AI used
  Chinese, different casing, spaces or underscores for `role`.
- Recognized aliases are normalized to the Story Kernel enum
  `protagonist|antagonist|supporting|minor` before strict validation.
- Empty or unknown text is omitted because `role` is optional. Non-text values
  remain blocked, so structural corruption is never guessed into valid data.
- The same repair runs when persisted candidates are loaded. A candidate that
  was previously blocked only by a repairable role can be confirmed after the
  upgrade without another AI generation request.
- TypeScript and native prompts now state the same exact role contract.

## Focused verification

- Three focused test files passed all 71 tests.
- Parser coverage includes Chinese aliases, casing, spaces, underscores,
  unknown text and invalid non-text input.
- Service coverage stages, confirms and persists `supporting_character` as
  `supporting`, and reopens a persisted `重要配角` candidate conflict-free.
- Phase 1.2C browser acceptance used a real non-canonical character role,
  confirmed it without a field-structure blocker, quarantined independently
  malformed candidates and reduced rapid repeated clicks to one AI request.
- The 1024x720 guided-creation journey passed without clipped progress actions.

## Final clean regression

`pnpm acceptance:full-regression` completed in 616,191 ms with 26/26 recorded
steps passing from a clean worktree:

- 167 frontend test files / 694 tests, lint, typecheck and production build;
- 77 Rust tests passed, with the two deliberate native gates also exercised;
- 19 browser journeys, StoryForge performance/recovery, native Gates A-D,
  complete-novel acceptance and a seven-second portable smoke;
- the user-detail soak passed a 100,661-character manuscript, 40 splitter
  resize attempts, 30 workspace transitions, three reloads and all compact
  Planning/Story Library views.

The full machine-readable result is `full-regression-latest.json`.

## Bugs converged during final verification

- Compact creation progress now retains all six actions at 1024 px.
- The browser soak retries only transient CDP execution-context errors created
  by deliberate page reloads; product/runtime errors still fail immediately.
- Release artifacts are archived under the verified source hash, avoiding an
  overwrite failure when an older portable build is still running.

## Deliverables

- Portable: `artifacts/release/full-regression-2026-08-02/75ddef7f/Writing-Buddy-Portable.exe`
  - size: 8,598,016 bytes
  - SHA-256: `0F1F74A581C2343AC215D435991C364C315682F6FDA4D15430668562A3EF1F4C`
- Installer: `artifacts/release/full-regression-2026-08-02/75ddef7f/Writing Buddy_0.1.0_x64-setup.exe`
  - size: 3,738,598 bytes
  - SHA-256: `7362ECD2D53795A1C81498B5C552DA7EF541A47D80A559E6AAFF15E8DBE0B1F2`

The Windows binaries remain unsigned development artifacts and may display a
SmartScreen warning.
