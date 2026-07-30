# Phase 1.2B idea-to-outline creation journey acceptance

Date: 2026-07-30

## Decision

Phase 1.2B passes.

The accepted vertical slice is:

**new project → a few ideas → editable story core → exactly three story
directions → select one or merge two → editable and reorderable story outline
→ exactly three opening chapters → one explicit atomic confirmation → open
chapter one.**

AI never starts when the project or a stage opens. The verified journey uses
four author-triggered AI requests, each handling one bounded decision. AI
output remains editable draft content until the author confirms the next
step.

## Visible journey outcome

The real Edge interface completed the following sequence:

1. open the new-project wizard;
2. see six truthful creation starts, with **我只有几个想法** selected by
   default;
3. verify that this route disables and unchecks early first-chapter creation;
4. create the project without an AI request;
5. enter three story elements;
6. explicitly generate and confirm an editable story core;
7. explicitly generate exactly three distinct directions;
8. select one direction and explicitly generate a five-node story outline;
9. reorder the outline through the visible move control;
10. explicitly split the outline into exactly three chapter proposals;
11. confirm one native transaction;
12. verify that the manifest and journey contain exactly three native chapter
    IDs and that **夜雨站台** opens as chapter one.

The runner recorded four AI calls and one materialization call. It observed
zero browser exceptions and no visible journey alerts.

## Project and write safety

- `.writing-buddy/creation/journey.json` is project-owned, versioned, strictly
  parsed, size bounded, and written with expected-hash conflict checks.
- Initial journey creation and subsequent autosaves share one serialized
  write queue.
- Editing an upstream decision preserves downstream drafts but marks them
  stale. Stale content cannot be materialized.
- The AI request contract contains only the bounded current decision. It
  rejects unknown keys, project paths, credentials, incomplete input, and
  malformed result counts.
- Native materialization validates the project revision and journey hash,
  creates exactly three chapter files, writes the manifest once, writes the
  materialized journey state, reopens both, and rolls everything back on any
  failure.
- Native tests verify both the successful exactly-three result and the
  fail-before-write path.

## Responsive and accessibility evidence

| Stage | Theme and media | Viewport | Overflow | Clipped controls | Minimum control | Heading focus |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Three ideas | Paper | 1536×992 | 0 px | 0 | 44 px | Passed |
| Reordered outline | Midnight, reduced motion | 1280×800 | 0 px | 0 | 44 px | Passed |
| Three chapters | Paper | 1024×720 | 0 px | 0 | 44 px | Passed |

The first compact run exposed the sixth journey-progress button outside the
1024 px viewport. The progress grid was changed to a compact six-column
contract below 1100 px, and the same automated check then passed with zero
clipped controls.

Visual evidence:

- [Six honest starts, Paper, 1536×992](./screenshots/phase-1.2b-creation-journey/01-six-honest-starts-paper-1536x992.png)
- [Three ideas, Paper, 1536×992](./screenshots/phase-1.2b-creation-journey/02-three-ideas-paper-1536x992.png)
- [Three directions, Paper, 1536×992](./screenshots/phase-1.2b-creation-journey/03-three-directions-paper-1536x992.png)
- [Reordered outline, Midnight and reduced motion, 1280×800](./screenshots/phase-1.2b-creation-journey/04-reordered-outline-midnight-reduced-1280x800.png)
- [Exactly three chapters, Paper, 1024×720](./screenshots/phase-1.2b-creation-journey/05-three-chapters-paper-1024x720.png)
- [Opened first chapter, Paper, 1024×720](./screenshots/phase-1.2b-creation-journey/06-opened-first-chapter-paper-1024x720.png)

The screenshots were inspected directly for hierarchy, contrast, editability,
compact navigation, full-width forms, and absence of visible clipping.
Machine-readable evidence is in
[`phase-1.2b-creation-journey-metrics.json`](./phase-1.2b-creation-journey-metrics.json).

## Automated verification

All final commands used Node 24.14.0, pnpm 10.32.1, and
`CARGO_BUILD_JOBS=1`.

| Check | Result |
| --- | --- |
| Focused journey model/store/AI/experience tests | 4 files, 16 tests passed |
| Real Edge journey runner | Passed full 12-step journey |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Complete Vitest suite | 132 files, 487 tests passed |
| Vite production build | Passed, 2,978 modules |
| Change-aware full self-test | Passed |
| Rust formatting | Passed |
| Rust complete test suite | 58 passed, 2 explicit external gates ignored |
| Change-aware release self-test | Passed |
| Windows Tauri release | Passed |
| NSIS installer | Passed |
| Native portable smoke test | Alive after 3 seconds, responsive main window, normal close passed |

The two ignored Rust tests remain explicit opt-in gates for a supplied real
project recovery fixture and the dedicated large-fixture performance run.
The production build retains the existing Monaco chunk-size advisory.

## Build artifacts

- Portable x64:
  `artifacts/release/phase-1.2b/Writing-Buddy-Phase-1.2B-Portable-x64.exe`
  - 7,825,408 bytes
  - SHA-256
    `FB7EB352FAF0C2296F2AF3D3EDD47DA7673156CE2B51D53AAA85B19263C9FEA0`
- NSIS installer x64:
  `artifacts/release/phase-1.2b/Writing-Buddy-Phase-1.2B-Setup-x64.exe`
  - 3,495,411 bytes
  - SHA-256
    `82215831FA2C0663B0B700BE5C8D84B8D29FEC1BBEB355ACF6BF23EC6304A44C`

Both are internal unsigned Windows x64 version 0.1.0 builds. The portable
artifact remained alive through the startup observation, exposed a nonzero
main-window handle, accepted a normal close request, and exited normally.

## Stop line

Phase 1.2B is complete. Phase 1.2C, Guided AI Story Development, remains a
separate milestone and should not begin without explicit user direction.
