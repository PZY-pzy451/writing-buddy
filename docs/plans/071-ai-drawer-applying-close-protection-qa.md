# AI drawer applying close protection QA

Date: 2026-08-04

## User risk

Candidate application is treated as an atomic lifecycle stage: generation,
cancellation, context changes and rejection are already locked. Close button,
Escape, backdrop dismissal and direct Store `close()` still reset the drawer,
discarding its transaction and visible evidence while the underlying apply may
continue.

## Contracts

1. One hundred direct Close actions while applying preserve the complete Store
   snapshot and perform no cancellation.
2. Close button is visibly disabled while applying.
3. Escape and backdrop dismissal cannot close an applying drawer.
4. Normal idle close and streaming close/cancellation behavior remain intact.
5. Explicit internal `reset()` remains available for application teardown; the
   author-facing `close()` boundary alone is locked.

## Execution

- Add Store pressure plus button/Escape/backdrop rendered contracts before
  changing production behavior.
- Guard applying state in Store `close()` and reflect that guard on the close
  button; other UI paths continue through the same Store authority.
- Run Store/drawer/context/App/session/save/error impact tests, followed by
  fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Four contracts failed red: 100 direct Close actions erased an applying
  transaction, the close button remained enabled, and Escape/backdrop both
  unmounted the drawer.
- Author-facing `close()` now rejects applying state synchronously. The button
  exposes the same disabled contract; Escape and backdrop continue through the
  Store authority and therefore preserve the transaction.
- The applying snapshot survives all four close paths without cancellation.
  Internal `reset()` still performs explicit teardown, and existing idle plus
  streaming close/cancellation contracts remain green.
- The first fixed-commit inventory exposed a previously hidden width-toggle
  selector after the close button became a distinct control: missing stable
  selectors temporarily rose from 221 to 222. The toggle now keeps the static
  accessible name `切换 AI 抽屉宽度` while its tooltip describes the current
  expand/restore action; inventory returned to 221 missing selectors.
- Focused Store/drawer regression: 2 files / 67 tests passed, including a real
  expand transition with a stable accessible name.
- Impact regression: 10 files / 165 tests passed.
- Full frontend acceptance: lint, TypeScript, 180 files / 900 tests and the
  production build passed with no timer or worker leaks.
- Rust baseline: 79 tests discovered, 77 passed, 2 environment-gated tests
  ignored and 0 failed.
- Execution status is `PASS`; product status remains `PARTIAL` for the open
  release gates above.
