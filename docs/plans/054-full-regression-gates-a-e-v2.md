# Full regression Gates A-E v2

## Objective

Establish an auditable, hierarchical regression foundation before any broad product repair or release claim. This first round is limited to Gates A-E and a real baseline run.

## Boundaries

- Work only in the isolated `codex/full-regression-gates-a-e-v2` worktree.
- Do not call a real AI provider or include secrets, real author content, full prompts, full model output, or absolute machine paths in QA artifacts.
- Do not enter Gate F, perform broad business fixes, or declare the release ready.
- Treat any unmapped feature, control, state, shortcut, native action, or test as a regression gap; the first-round conclusion must remain `PARTIAL` while gaps exist.

## Gate sequence

1. **Gate A - source map and baseline contract**
   - Record repository baseline, architecture, existing frameworks, commands, tests, fixtures, current evidence, and environment constraints.
   - Add tracked `artifacts/qa` output without exposing machine-specific paths.
2. **Gate B - hierarchical inventory**
   - Generate the twelve-domain feature inventory plus page/workspace, control, state, shortcut, native-action, and test inventories.
   - Use durable semantic IDs and identify items that still lack stable automation selectors.
3. **Gate C - traceability enforcement**
   - Materialize feature-page-control-state-test mappings and coverage counts.
   - Make release validation fail when mappings or required evidence are missing; require a reason for every `NOT_APPLICABLE` item.
4. **Gate D - invalidation and cache ledger**
   - Fingerprint source, dependency, schema, fixture, mock, environment, build configuration, and test implementation inputs.
   - Produce dependency maps, incremental plans, and a ledger supporting `STALE` and `CACHED_PASS` without allowing unsafe reuse.
5. **Gate E - deterministic fixtures and AI mock provider**
   - Add resettable, isolated project fixtures and deterministic AI stream/error scenarios.
   - Verify cleanup, stream ordering, failure injection, and per-test isolation by contract tests.
6. **First baseline only**
   - Run existing type checks/tests/build and the new QA checks.
   - Record actual results and counts, report gaps as `PARTIAL`, and stop before Gate F.

## Verification

- Run the smallest relevant QA tests after each gate.
- After Gate E, run the existing baseline suite with Node 24 and pnpm 10.32.1.
- Inspect generated JSON/CSV for schema validity, deterministic ordering, path sanitization, and absence of secrets or author content.
- Commit each completed gate separately with the requested gate-level messages.

