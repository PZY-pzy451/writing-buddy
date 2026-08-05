# 107 Quick capture save, selector and trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `cd7a835` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,767 unmapped items. Test mapping is 188/1,058,
  leaving 870 discovered cases unmapped.
- Control inventory has 508 declarations and 79 missing stable selectors.
- `QuickCaptureDialog.tsx` has five declarations; only two are stable, one is
  strictly mapped and nine of 110 source states have a test mapping.
- The type option, Save action and dialog boundary lack stable identities.
  Button and Ctrl+Enter entry points share no component-local synchronous
  guard before the Store busy state reaches React.
- Three existing `QuickCaptureStore` cases cover empty loading, atomic
  persistence and concurrent-write rejection but are not mapped to the Save
  control states they verify.

## Failure-first contracts

1. Dialog, content input, type option, close and Save expose five distinct
   stable identities without changing accessible Chinese names.
2. One hundred Ctrl+Enter actions plus one hundred Save clicks during the same
   pending operation start exactly one save.
3. A completed false result releases the local guard for one explicit retry.
4. Close cannot bypass a same-frame pending save before React renders busy.
5. Existing Store tests explicitly map loading, persistence and concurrent-
   failure behavior to the stable Save control without adding test cases.
6. Escape close and opening-focus restoration remain intact.

## Validation

- Extend existing dialog, Store and inventory cases, run them red, then add the
  smallest synchronous guard and stable-control boundary.
- Run all quick-capture tests and Writer Workspace shortcut impact tests under
  Node 24, plus typecheck and zero-warning lint.
- Run frontend, Rust and QA infrastructure gates sequentially from a fixed
  product commit.
- Rebuild traceability against 9,767 aggregate gaps, 79 selector gaps and 870
  unmapped tests; report inventory expansion separately from real mapping gain.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source is fixed at `b63947c`. Three failure-first failures converged
  to 20/20 focused/inventory and 38/38 Quick Capture plus Writer Workspace
  impact tests.
- Sequential full gates passed 189 frontend files / 979 tests, lint, typecheck,
  production build, 77 native tests with two reasoned external-gate ignores,
  and 30/30 QA infrastructure tests.
- All five source controls are stable and strictly mapped. Source mapped states
  rise from 9 to 53 and all five product cases map. Global mapped controls rise
  by 4, states by 46 and tests by 3.
- Strict gaps fall from 9,767 to 9,714, selector gaps from 79 to 76 and unmapped
  tests from 870 to 867. Strict coverage is 25.25%, selector coverage 85.04%
  and test mapping 18.05%.
- Deterministic execution passes, but release remains blocked at 1/4 hard gates
  until strict traceability, real-provider smoke and packaged-EXE acceptance
  complete.
