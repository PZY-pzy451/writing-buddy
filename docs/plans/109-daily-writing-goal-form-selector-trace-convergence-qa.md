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

Pending execution.
