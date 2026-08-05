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

Pending execution.
