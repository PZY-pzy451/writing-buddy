# Change-aware self-test framework

Updated: 2026-07-29

## Problem

The repository has broad Vitest, TypeScript, ESLint, production-build, Cargo,
and Tauri gates, but contributors must choose and compose them manually.
Running only an obvious colocated test can miss indirectly affected behavior
such as AI prompt parity, snapshot ordering, project persistence, or desktop
bootstrap integration. Running the complete release gate after every small
edit is unnecessarily expensive.

## Contract

The repository will expose one self-test runner with four modes:

- `pnpm self-test` discovers staged, unstaged, untracked, and optionally
  base-relative changes, then selects proportional checks.
- `pnpm self-test:plan` prints the same impact plan without executing it.
- `pnpm self-test:full` runs the complete frontend acceptance and Rust gates.
- `pnpm self-test:release` adds a fresh Tauri release/package build.

When the worktree is clean, the default command evaluates the latest commit so
it remains useful immediately after a commit. `--base <ref>` and
`SELF_TEST_BASE` provide deterministic CI or branch-relative selection.

## Impact model

Selection combines three sources instead of trusting a single heuristic:

1. Vitest's static dependency graph runs tests related to changed TypeScript
   and JavaScript source files.
2. Colocated safety roots run all tests in the changed feature leaf or
   workspace package, including tests that reach code through factories,
   stores, filesystem reads, or runtime registration.
3. Explicit high-risk rules add cross-cutting regression tests for AI
   contracts, Story Kernel writes, snapshots/versioning, project persistence,
   desktop bootstrap, layout/theme, and native boundaries.

Global test/config/dependency changes promote automatically to the full
frontend acceptance gate. Rust changes always run formatting and the complete
Rust suite because it is currently fast. Runtime frontend changes also run the
production build.

## Reliability and reporting

- `git diff --check` is always first.
- Deleted files participate in risk selection but are not passed to ESLint or
  Vitest as existing inputs.
- Commands run sequentially and stop at the first failure by default.
  `--keep-going` is available for diagnosis.
- Every execution writes an ignored JSON report to
  `artifacts/self-test/latest.json`, including selection source, changed
  files, risk areas, commands, durations, and exit codes.
- No test step writes author project data, starts a real AI request, or
  installs dependencies.
- The runner itself is covered by pure planning tests for docs-only,
  feature-local, cross-contract, native, global-infrastructure, full, and
  release cases.

## Acceptance

- A Story Kernel or character-panel change selects related/colocated tests,
  the snapshot safety tests, typecheck, lint, and production build.
- A Rust AI change selects Cargo gates plus TypeScript/Rust prompt-parity
  safety coverage.
- Test infrastructure or dependency metadata changes promote to
  `pnpm acceptance`.
- Documentation-only changes run repository hygiene without billing or
  compiling application code.
- Dry-run never executes a test command but records an inspectable plan.
- The framework passes its focused tests, its own change-aware execution, the
  complete frontend acceptance suite, and Cargo tests.
