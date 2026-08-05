# 094 Whole-work consistency AI control and recovery convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `1721a1a9` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 10,149 unmapped items and 905 discovered test cases
  are not mapped to a feature/control/state contract.
- Control inventory has 480 declarations and 110 missing stable selectors.
- `StoryConsistencyAiPanel.tsx` has five inventoried declarations: one mapped
  and four missing. Seven logical controls are collapsed because whole-work and
  selected scope, chapter selection, instruction, run and stop are not all
  independently identifiable.
- All four existing panel tests are currently unmapped despite covering
  duplicate-run, cancellation, selection and partial-batch failure behavior.

## Failure-first contracts

1. Close, whole-work scope, selected scope, chapter selection, instruction,
   run and stop produce seven stable declaration identities with no selector
   gap.
2. One hundred same-frame Run actions still start one provider request and
   publish one atomic result set.
3. One hundred Stop actions still issue one native cancellation command and
   expose the pending disabled state through a stable selector.
4. Selected-chapter mode caps selection at 12, releases the cap after one
   deselection and keeps every enabled representative keyboard focusable.
5. A later whole-work batch failure publishes no partial result, exposes only
   localized feedback and succeeds on an explicit full restart.
6. Inventory generation enforces the exact seven-control set while the four
   existing product tests gain independent state mappings without adding new
   unmapped test cases.

## Validation

- Run modified panel and inventory contracts red before product implementation.
- Run consistency planning/review, AI core and all QA infrastructure impact.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit.
- Run Rust format/tests, rebuild strict traceability and record net movement
  from 10,149 unmapped items / 110 selector gaps / 905 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.
