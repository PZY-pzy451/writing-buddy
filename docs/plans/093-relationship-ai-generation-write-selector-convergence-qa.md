# 093 Relationship AI generation, write and selector convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `e613a940` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 10,286 unmapped items, including 906 discovered test
  cases that are not yet mapped to a feature/control/state contract.
- Control inventory has 478 declarations and 114 missing stable selectors.
- `RelationshipAiPanel.tsx` has seven inventoried declarations: three mapped
  and four missing. Nine author-facing logical controls are collapsed because
  the action, source/target character, generation, instruction, evidence and
  acceptance paths do not all have distinct stable identities.
- Generation parsing and candidate persistence still expose arbitrary
  `Error.message` values, including malformed relationship schema codes and
  private snapshot or repository paths.

## Failure-first contracts

1. Action tabs, chapter selection, source and target character selection,
   instruction, generation, evidence, acceptance and close produce nine stable
   declaration identities with no selector gap.
2. One hundred same-frame generation actions still start one provider request.
3. A structurally invalid relationship response is safely isolated, never
   displays a raw Zod/schema detail, leaves generation retryable and succeeds
   on one explicit retry.
4. A candidate write rejected with a private filesystem path displays only a
   localized message and leaves the same candidate retryable.
5. The write retry performs one new snapshot attempt and succeeds without a
   second AI generation.
6. Rendered representative controls remain visible, enabled and keyboard
   focusable, and evidence opening remains pointer-operable.
7. Inventory generation enforces the exact nine-control set while every new
   product test is independently mapped by traceability.

## Validation

- Run the modified relationship page and inventory contracts red before
  product implementation.
- Run relationship AI review service/page impact and all QA infrastructure
  tests.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit.
- Run Rust format/tests, rebuild strict traceability and record net movement
  from 10,286 unmapped items / 114 selector gaps / 906 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.
