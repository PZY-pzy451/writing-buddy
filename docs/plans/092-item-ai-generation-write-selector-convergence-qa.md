# 092 Item AI generation, write and selector convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `16fc8b0` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 10,379 unmapped items.
- Control inventory has 475 declarations and 118 missing stable selectors.
- `ItemAiPanel.tsx` has seven inventoried declarations: three mapped and four
  missing. Ten logical control groups are collapsed because action, generation,
  acceptance, field/state selection and their evidence actions lack distinct
  stable identities.
- Generation parsing and candidate persistence both expose arbitrary
  `Error.message` values, including internal schema codes and private snapshot,
  repository or state-store details.

## Failure-first contracts

1. Action tabs, chapter selection, instruction, generation, item-field and
   state selection, their distinct evidence actions, candidate acceptance and
   close produce ten stable declaration identities with no selector gap.
2. One hundred same-frame generation actions still start one paid request after
   selector instrumentation.
3. A structurally invalid item response is safely isolated, does not display
   `invalidItemCandidateCount`, leaves generation retryable and succeeds on one
   explicit retry.
4. A candidate write rejected with a private filesystem path displays only a
   localized message and leaves the same selected fields retryable.
5. The write retry performs one new snapshot attempt and succeeds without a
   second AI generation or lost selection.
6. Inventory generation enforces the exact ten-control set.

## Validation

- Run the modified Story Assets page and inventory contracts red before product
  implementation.
- Run Item AI review service/page impact and all QA infrastructure tests.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit.
- Run Rust format/tests, rebuild strict traceability and record net movement
  from 10,379 unmapped items / 118 selector gaps.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Four failure-first contracts reproduced a seven-control inventory, missing
  stable identities, raw `invalidItemCandidateCount` feedback and a private
  `C:\private\author\items.json` snapshot path in the write alert.
- `ItemAiPanel` now exposes ten distinct controls with 10/10 stable identities.
  Field/state controls and their evidence actions are separate declarations.
- Malformed item output is safely isolated and retryable. Unknown persistence
  failures are localized, known domain failures remain actionable and the same
  selected candidate fields survive a rejected write without another paid
  generation.
- One hundred same-frame generation actions still start one provider request.
  Ten rendered representative controls are visible, enabled and keyboard
  focusable; both evidence actions and field/state selection are exercised.
- Initial focused contracts passed 19/19, the final item impact set passed 42
  tests through full execution and QA infrastructure passed 29/29.
- Fixed source `3b265f2` passed Node 24 lint, typecheck, 188 frontend files /
  975 tests and production build. Rust passed 77 with two reasoned ignores.
- Stable-selector debt fell from 118 to 114. Strict aggregate gaps fell from
  10,379 to 10,286 despite three controls, 66 derived states and three discovered
  tests being added.
- Release remains blocked at 1/4 gates: strict traceability, real-provider
  smoke and packaged-EXE acceptance remain incomplete.
