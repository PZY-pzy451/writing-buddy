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

## Result

- Product source: `807d106`; all seven logical controls now have distinct,
  stable identities and the source has zero selector gaps.
- Failure-first produced five red contracts. Focused execution passed 19/19
  and the continuity/review/AI/QA impact set passed 86/86.
- One hundred Run actions start one provider request and publish one result
  set. One hundred Stop actions issue one cancellation; cancellation remains
  disabled while pending.
- Selected mode caps at 12 chapters, releases a disabled choice after
  deselection and keeps enabled controls keyboard focusable. A later batch
  failure publishes no partial result and a full restart succeeds.
- Node 24 passed lint, typecheck, 188 frontend files / 978 tests and the
  production build. Rust passed 77 tests with two reasoned ignores.
- Existing tests mapped from 152 to 156; no new test debt was added. Aggregate
  gaps fell from 10,149 to 10,086 and selector gaps from 110 to 106.
- Release remains blocked by strict traceability, real-provider smoke and
  packaged-EXE acceptance.
