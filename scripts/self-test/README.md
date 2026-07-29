# Change-aware self-test

The self-test runner chooses proportional repository gates from the current
Git impact surface.

## Commands

```text
pnpm self-test
pnpm self-test:plan
pnpm self-test:full
pnpm self-test:release
```

Useful options:

- `--base <ref>` includes committed changes from the merge-base with `ref`.
- `SELF_TEST_BASE=<ref>` provides the same selection for automation.
- `--keep-going` records every failing step instead of stopping at the first.
- `--report <path>` overrides `artifacts/self-test/latest.json`.

The default command uses staged, unstaged, and untracked files. With a clean
worktree it evaluates the latest commit.

## Selection layers

1. `vitest related` follows static imports from changed source files.
2. All tests in the changed feature leaf or workspace package are added.
3. `impact-rules.mjs` adds cross-cutting tests for behavior that dependency
   analysis cannot reliably see.

Edit `impact-rules.mjs` when a new runtime registry, filesystem-read contract,
code-generated boundary, or other indirect dependency is introduced. Add a
planner regression in `impact.test.mjs` with every new rule.

Every execution writes a machine-readable ignored report containing its
inputs, risk areas, planned commands, timings, and exit codes.
