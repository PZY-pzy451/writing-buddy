# Phase 1.2R full regression and bug convergence

Updated: 2026-08-02

## Objective

Run every repeatable, offline product gate in the repository against one exact
commit, fix every reproducible defect found, rerun the affected gate and then
the complete matrix, and package the converged Windows build with machine-
readable evidence.

This cycle is a release-hardening cycle. It does not add a new author-facing
feature or rely on a live AI provider.

## Test matrix

| Layer | Gates |
| --- | --- |
| Source | ESLint, TypeScript, Vitest, production web build |
| Native | Rust formatting, Rust unit/integration tests |
| Product self-test | full change-aware suite and release suite |
| Browser journeys | Gate G, Gate H, Phase 1.2B, 1.2C, 1.2E–1.2Q |
| Legacy visual journey | StoryForge Gate C capture and interaction probes |
| Native journeys | genre-to-draft Gate D and complete-novel creation/reopen/export |
| Data scale | large StoryForge fixture performance gate |
| Recovery | sanitized deterministic project backup/restore/reopen/backlink gate |
| Distribution | Tauri Release, NSIS installer, portable EXE smoke, SHA-256 |

Phase 1.2J and Phase 1.2Q run through their explicit environment modes rather
than being counted as duplicates of Phase 1.2H and Phase 1.2P. Historical
`genre-to-draft:gates-a-c` is a compatibility alias for the current Gate D and
is not counted twice.

## Execution contract

1. All browser fixtures use the local bridge and deterministic AI responses;
   no prompt, manuscript or credential is transmitted to a third party.
2. Each browser process uses an isolated profile and a unique debugging port.
3. A failed gate is classified as product defect, acceptance drift or host
   dependency before any change is made.
4. Every fix receives a focused regression first. The complete matrix is then
   rerun from a clean process state.
5. A gate is reported as passed only when its command exits successfully and
   its expected report or screenshot evidence exists.
6. External-provider health and unsanitized customer-project recovery are not
   inferred from offline fixtures. The recovery gate uses only the repository's
   sanitized deterministic project data.
7. Release artifacts are copied only after the final full rerun passes. Hashes
   are computed from those copied bytes.

## Acceptance

- One command can execute the complete repeatable matrix and write a JSON
  report containing command, duration, exit status and evidence paths.
- Every reproducible defect discovered in this cycle is fixed and protected by
  a focused regression or stronger acceptance assertion.
- Static, unit, browser, native, performance, recovery and distribution gates
  all pass on the same final commit.
- The final archive contains the portable EXE, NSIS installer, full-regression
  report, release self-test report and SHA-256 manifest.
- `docs/progress.md`, the daily memory log and a dated acceptance note agree on
  the exact scope, limitations and artifact paths.

## Non-goals

- Calling a paid or live AI endpoint during automated acceptance.
- Testing private user projects or copyrighted manuscripts.
- Claiming operating-system compatibility beyond the tested Windows host.
- Treating historical aliases as additional independent coverage.
