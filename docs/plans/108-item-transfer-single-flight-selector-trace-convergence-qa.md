# 108 Item transfer single-flight, selector and trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `7d0dcde` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,714 unmapped items. Test mapping is 191/1,058,
  leaving 867 discovered cases unmapped.
- Control inventory has 508 declarations and 76 missing stable selectors.
- `ItemTransferDialog.tsx` renders two buttons and four inputs, but structurally
  equivalent input declarations collapse to four inventory controls and 88
  states. Three controls are stable, none of its states are strictly mapped,
  and its only UI case is unmapped.
- Confirm relies only on the next React `saving` render, so repeated same-frame
  clicks can start multiple Story Kernel persistence calls. Close and Escape
  are not synchronously blocked while a commit is pending, and a rejected
  commit has no localized retry feedback.

## Failure-first contracts

1. Close, holder, location, quantity, narrative order and Confirm expose six
   distinct stable identities without changing accessible Chinese names.
2. One hundred same-frame Confirm actions start exactly one commit.
3. Close and Escape cannot dismiss the dialog while that commit is pending.
4. A rejected commit produces public localized feedback, releases the guard
   and permits exactly one explicit retry.
5. The committed candidate remains `pending` and appends history rather than
   replacing the current state.
6. The existing UI case becomes strictly mapped without adding test count.

## Validation

- Extend the existing dialog and inventory cases, run them red, then add the
  smallest synchronous guard, close protection, feedback and stable identities.
- Run the complete Story Assets impact set under Node 24, plus typecheck,
  zero-warning lint and diff validation.
- Run frontend, Rust and QA infrastructure gates sequentially from a fixed
  product commit.
- Rebuild traceability against 9,714 aggregate gaps, 76 selector gaps and 867
  unmapped tests; report honest inventory expansion separately from net debt.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source is fixed at `c0d6f24`. Two red tests plus one unhandled
  rejection converged to 16/16 focused/inventory and 15/15 item/history impact.
- Sequential full gates passed 189 frontend files / 979 tests, lint, typecheck,
  production build, 77 native tests with two reasoned external-gate ignores,
  and 30/30 QA infrastructure tests.
- Honest inventory expansion adds 2 controls and 44 states. All 6 source
  controls, 96 of 132 source states and the existing UI case map. Global mapped
  controls rise by 6, states by 96 and tests by 1.
- Strict gaps fall from 9,714 to 9,657, selector gaps from 76 to 75 and unmapped
  tests from 867 to 866. Strict coverage is 25.95%, selector coverage 85.29%
  and test mapping 18.15%.
- Deterministic execution passes, but release remains blocked at 1/4 hard gates
  until strict traceability, real-provider smoke and packaged-EXE acceptance
  complete.
