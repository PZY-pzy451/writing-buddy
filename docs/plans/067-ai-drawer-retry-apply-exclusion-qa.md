# AI drawer retry and apply exclusion QA

Date: 2026-08-04

## User risk

The drawer renders a localized failure but disables its only generation button
whenever `error` is present, so the author cannot perform the explicit retry
that the Store already supports. Conversely, `applying` is not included in the
generation guard: a second request can start while a validated candidate is
being applied, clearing the preview transaction and potentially creating an
unintended paid request.

## Contracts

1. A localized generation failure keeps the generation control enabled for an
   explicit user retry.
2. One hundred same-tick retry actions perform one provider validation and start
   at most one new job.
3. During `applying`, the rendered start and stop controls are both disabled:
   application is busy work but is not a cancellable provider stream.
4. One hundred direct Store generation attempts during `applying` perform zero
   provider checks, start zero jobs and preserve the candidate transaction.
5. Invalid action input remains blocked by the Store even if a caller bypasses
   the disabled rendered control.
6. Cancelled and completed/rejected states keep their existing explicit
   regeneration behavior.

## Execution

- Add rendered failure-retry and applying-state contracts before production
  changes.
- Add Store-level pressure coverage so bypassing the disabled button cannot
  evade the invariant.
- Separate provider-active state from the broader start/context lock in the UI.
- Run drawer, context, App, session, save and AI error impact tests followed by
  fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Four contracts failed red: the failure-state button was disabled, the
  applying-state button was enabled, direct applying-state calls started a new
  provider validation, and invalid input could bypass the rendered guard.
- Failure state now permits an explicit retry while other error-bearing states
  remain blocked. One hundred retry actions start one request.
- `applying` is guarded synchronously in the Store and by the rendered control;
  100 direct attempts perform zero additional provider checks or jobs and keep
  the validated transaction intact.
- Invalid action input performs zero provider checks even through direct Store
  calls. Cancelled and rejected outcomes remain explicitly regenerable.
- Focused regression: 2 files / 48 tests passed.
- Impact regression: 10 files / 147 tests passed.
- Full frontend acceptance: lint, TypeScript, 180 files / 882 tests and the
  production build passed with a normal worker-pool exit.
- Rust baseline: 79 tests discovered, 77 passed, 2 environment-gated tests
  ignored and 0 failed.
- Execution status is `PASS`; product status remains `PARTIAL` for the open
  release gates above.
