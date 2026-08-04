# AI drawer preview rejection single-commit QA

Date: 2026-08-04

## User risk

The Reject candidate control is rendered only for a preview, but its Store
action checks only whether a transaction exists. Repeated same-tick events call
the transaction transition again after the first rejection and throw
`aiPreviewNotRejectable`. A delayed event from an obsolete button can also
reject an applying preview or throw after the transaction became completed or
stale.

## Contracts

1. One hundred Reject actions against one preview perform one transition and
   never throw.
2. Only Store state `preview` plus transaction status `preview` is rejectable.
3. Delayed Reject actions cannot change applying, completed or stale state or
   transaction data.
4. A rejected candidate remains explicitly regenerable through the existing
   generation boundary.
5. Rejection performs no provider, cancellation, snapshot or manuscript write.

## Execution

- Add direct Store pressure and applying/completed/stale delayed-action matrix
  before changing production behavior.
- Guard both visible lifecycle state and transaction status synchronously.
- Re-run Store/drawer/context/App/session/save/error impact tests, then fixed-
  commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Four contracts failed red: a 100-action preview rejection threw on the second
  action, and delayed rejection threw or changed state while applying,
  completed or stale.
- Rejection now requires both Store state and transaction status to equal
  `preview`; every obsolete or repeated action is a synchronous no-op.
- One hundred valid actions perform one transition, preserve the candidate and
  issue no cancellation or additional provider request.
- Applying, completed and stale snapshots survive 100 delayed actions without
  mutation or exception. Existing rejected-candidate regeneration remains
  green.
- Focused Store regression: 1 file / 50 tests passed.
- Impact regression: 10 files / 161 tests passed.
- Full frontend acceptance: lint, TypeScript, 180 files / 896 tests and the
  production build passed with no timer or worker leaks.
- Rust baseline: 79 tests discovered, 77 passed, 2 environment-gated tests
  ignored and 0 failed.
- Execution status is `PASS`; product status remains `PARTIAL` for the open
  release gates above.
