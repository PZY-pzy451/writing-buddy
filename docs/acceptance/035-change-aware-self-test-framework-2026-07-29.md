# Change-aware self-test framework acceptance

Date: 2026-07-29

## Outcome

Writing Buddy now has one project-owned self-test runner that automatically
selects existing regression coverage for current changes and escalates to
broader gates when the affected surface is cross-cutting.

The framework adds no test provider or runtime dependency. It composes the
repository's pinned Vitest, ESLint, TypeScript, Vite, Cargo, and Tauri
toolchain.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm self-test` | Discover current impact and execute proportional checks |
| `pnpm self-test:plan` | Print and report the plan without executing tests |
| `pnpm self-test:full` | Run complete frontend acceptance plus Rust gates |
| `pnpm self-test:release` | Add Tauri Release/NSIS packaging |

The default selector includes staged, unstaged, untracked, and deleted paths.
`--base <ref>` or `SELF_TEST_BASE` adds branch/CI-relative committed changes.
A clean worktree evaluates the latest commit.

## Impact behavior

- Vitest dependency analysis selects statically related tests.
- Changed feature leaves and workspace packages add all colocated tests,
  covering stores, registries, factories, and filesystem-read relationships
  that static imports may not expose.
- Explicit rules add cross-cutting safety tests for AI/prompt parity,
  snapshots/versioning, Story Kernel transactions, project persistence,
  desktop shell/layout, and Tauri boundaries.
- Test infrastructure and workspace dependency metadata fail safe by
  promoting to the complete frontend acceptance suite.
- Rust changes run `cargo fmt -- --check` and the complete Rust test suite.
- Runtime frontend changes retain TypeScript and production-build coverage.
- Documentation-only changes remain on repository hygiene checks.
- Selection-aware whitespace/conflict checks cover the worktree, index,
  base-relative commits, or latest commit as applicable.

## Reporting and failure behavior

Each run writes `artifacts/self-test/latest.json`, an ignored machine-readable
report containing:

- selection source and changed files;
- matched rules and risk areas;
- resolved related/colocated tests;
- planned commands and working directories;
- per-step start time, duration, status, exit code, and error;
- final pass/fail status.

Execution is sequential and stops at the first failure. `--keep-going` records
all failures for diagnosis. Dry-run mode executes no test command.

## Automated evidence

| Gate | Result |
| --- | --- |
| Planner regression | 1 file / 9 tests passed |
| Real character-panel dependency selection | 6 files / 19 tests passed |
| Default `pnpm self-test` | Correctly promoted infrastructure edits to complete frontend acceptance |
| `pnpm self-test:full` | Passed |
| Frontend acceptance inside framework | ESLint, TypeScript, 106 files / 382 tests, and production build passed |
| Cargo gates inside framework | Formatting passed; 52 tests passed / 2 explicit external gates ignored / 0 failed |
| Base-relative dry-run | Included base, worktree, and index checks |
| Release dry-run | Included frontend acceptance, Cargo gates, and `pnpm tauri:build` |

The full JSON report recorded all five executed steps as passed, including
durations and exit codes. Generated reports remained ignored and did not alter
the Git worktree.

## Contributor integration

`AGENTS.md` now directs implementation work to inspect
`pnpm self-test:plan`, run `pnpm self-test` while iterating, and use the full or
release mode for cross-cutting and packaging milestones. Extension guidance
and rule maintenance live in `scripts/self-test/README.md`.
