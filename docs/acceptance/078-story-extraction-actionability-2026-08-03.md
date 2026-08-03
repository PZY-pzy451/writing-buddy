# Story extraction actionability acceptance

Date: 2026-08-03

## Outcome

The visible story-fact extraction action is usable again. Project chapter IDs
such as `chapter-a11ce001` are converted once to canonical Story Kernel IDs,
and the same canonical value is used by AI input, pending facts, evidence,
story position, filtering and author confirmation.

The surface no longer exposes `invalidStoryExtractionInput` or other internal
identifiers. Empty/oversized selections are explained before a request, rapid
double-clicks start one request, malformed responses receive bounded repair and
strict validation, and successful zero-result extraction remains visible.

## Adjacent actionability audit

- AI extraction accepts fenced/wrapped JSON and harmless fact field/type aliases.
- Extract, accept and reject failures use author-facing recovery guidance.
- Concurrent local changes remain fail-before-write and keep the fact pending.
- All five selection resource routes, quick capture, existing-resource linking
  and contextual dialogue AI are covered by component tests.
- Browser acceptance scans the visible surface for raw `invalid*`, `undefined`,
  `null`, stack and unhandled-error text.
- Gate G keyboard drag uses a delivered CDP key event; the acceptance browser
  explicitly owns focus instead of relying on foreground-window timing.
- Phase 1.2B/1.2C disable Edge background timer throttling. Their standalone
  journeys passed in 9.84 s and 9.27 s instead of being stretched to minutes.

## Verification

- Focused parser/service/component suite: 4 files, 43 tests passed.
- Complete frontend acceptance: 168 files, 701 tests passed; lint, TypeScript
  and production Vite build passed.
- Rust: 77 passed, 2 dedicated ignored gates; formatting passed.
- Full regression source: `876485c933b3492f07b0dbdb52e0cbcf9f827af9`,
  clean at start.
- Aggregate: 26/26 steps passed in 590,101 ms, including 19 browser journeys,
  performance, native Gates A-D, complete novel, recovery and portable smoke.
- User-detail soak: 100,661-character manuscript, 40 resize attempts, 30
  workspace transitions, three reloads, fact extraction accepted to zero
  pending facts, and no raw errors.
- Machine report: [full-regression-latest.json](./full-regression-latest.json).
- Story extraction evidence:
  [phase-1.2s-user-detail-soak.json](./phase-1.2s-user-detail-soak.json).

## Windows delivery

- Portable:
  `artifacts/release/full-regression-2026-08-02/876485c9/Writing-Buddy-Portable.exe`
- Installer:
  `artifacts/release/full-regression-2026-08-02/876485c9/Writing Buddy_0.1.0_x64-setup.exe`
- Portable SHA-256:
  `B302F18FEE0FCE0D24E96781E22D08196DB0820485E8FE72F4356A92221076BF`
- Installer SHA-256:
  `48FEB23C69B16FA49DFFBB0B79935D29C068ABC61FDD3FF1197D89E8744C17EC`
