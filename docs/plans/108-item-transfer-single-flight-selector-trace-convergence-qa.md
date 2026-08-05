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

Pending execution.
