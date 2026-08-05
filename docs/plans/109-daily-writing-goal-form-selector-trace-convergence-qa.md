# 109 Daily writing goal form selector and trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `b3b82d9` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,657 unmapped items. Test mapping is 192/1,058,
  leaving 866 discovered cases unmapped.
- Control inventory has 510 declarations and 75 missing stable selectors.
- `DailyWritingGoalControl.tsx` has three controls and 66 states. Two controls
  have semantic selectors, but the form boundary has neither a stable identity
  nor an accessible form name; no source control/state or either existing UI
  case is strictly mapped.
- The component appears in both the writer header and Story Dashboard, so its
  identity must stay stable while retaining explicit placement context.

## Failure-first contracts

1. The form exposes one stable identity and an accessible Chinese form name in
   both header and dashboard placements.
2. Placement remains explicit without creating duplicate inventory controls.
3. Pointer opening plus Enter submission updates a valid project goal and
   exposes public success status.
4. An out-of-range value remains inline, exposes an alert and does not mutate
   project progress.
5. Both existing UI cases become strictly mapped without adding test count.

## Validation

- Extend the existing component and inventory cases, run them red, then add the
  smallest semantic form boundary.
- Run all daily-progress, Story Dashboard and Writer Workspace impact tests
  under Node 24, plus typecheck, zero-warning lint and diff validation.
- Run frontend, Rust and QA infrastructure gates sequentially from a fixed
  product commit.
- Rebuild traceability against 9,657 aggregate gaps, 75 selector gaps and 866
  unmapped tests; keep inventory expansion separate from real mapping gain.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Source `a756c35` gives the form a stable `daily-writing-goal-form` identity,
  the accessible name `每日写作目标设置` and explicit `dashboard` / `header`
  placement context without creating another inventory declaration.
- Three failure-first assertions reproduced the missing form semantics and
  inventory gap. They converged to 17/17 focused/inventory and 39/39 progress,
  Story Dashboard and Writer Workspace impact tests.
- Pointer opening plus Enter submission persists a valid goal and exposes
  success. Out-of-range input stays inline, exposes an alert and performs no
  persistence mutation.
- All 3 source controls, 15 of 66 source states and both existing product cases
  are now strictly mapped. Global mapped controls rise by 3, states by 16 and
  tests by 2 without adding inventory or test count.
- Sequential fixed-source acceptance passed 189 frontend files / 979 tests,
  production build, 77 native tests with two reasoned ignores and 30/30 QA
  infrastructure tests.
- Strict gaps fall from 9,657 to 9,636, selector gaps from 75 to 74 and
  unmapped tests from 866 to 864. Strict coverage is 26.11%, stable-selector
  coverage is 85.49%, test mapping is 18.34% and release hard gates remain
  1/4 complete.
