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

## Result

- Four failure-first failures reproduced raw Zod field paths, missing
  generation/acceptance selectors and a seven-control inventory.
- `RelationshipAiPanel` now exposes nine distinct controls with 9/9 stable
  identities. Source and target selectors are independently addressable.
- Malformed relationship output is localized, safely isolated and retryable.
  Unknown snapshot/repository failures are redacted and the same candidate can
  succeed on explicit retry without another provider request.
- One hundred same-frame Generate actions still start one provider request.
  Nine representative controls are visible, enabled and keyboard focusable;
  evidence opening is verified by pointer.
- Focused contracts passed 22/22, the relationship/AI/QA impact set passed
  79/79 and QA infrastructure passed 29/29.
- Fixed source `c19c46c` passed Node 24 lint, typecheck, 188 frontend files /
  978 tests and production build. Rust passed 77 with two reasoned ignores.
- Stable-selector debt fell from 114 to 110. Strict aggregate gaps fell from
  10,286 to 10,149 while two controls, 44 derived states and three tests were
  added. Mapped tests rose from 148 to 152, so all three additions are mapped
  and one existing test gained a valid mapping.
- Release remains blocked at 1/4 gates: strict traceability, real-provider
  smoke and packaged-EXE acceptance remain incomplete.
