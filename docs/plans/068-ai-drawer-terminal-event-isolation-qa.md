# AI drawer terminal event isolation QA

Date: 2026-08-04

## User risk

The stream listener checks only `jobId`. After the same job reaches preview,
failure or cancellation, delayed events still match and can move the drawer
back to queued/connecting/streaming, append output, replace usage/error or build
a candidate after the request was already terminal. Duplicate early lifecycle
events can also regress an active stream from streaming back to connecting.

## Contracts

1. Preview, failed and cancelled states ignore every later stream event from
   that same job, including delta, usage and all lifecycle/terminal variants.
2. One hundred delayed event bursts cannot change terminal state, output,
   parsed candidate, transaction, usage or error.
3. Once content streaming begins, duplicate job-started and connection-opened
   events cannot regress progress.
4. Valid ordered events continue through queued, connecting, streaming,
   output validation and preview.
5. Explicit regeneration still creates a distinct job and is the only path out
   of a terminal generation result.

## Execution

- Add a controlled stream runtime and terminal-state matrix before changing
  Store behavior.
- Add 100-burst delayed-event pressure plus active-state monotonicity coverage.
- Guard terminal states globally and enforce per-event monotonic transitions.
- Run drawer, context, App, session, save and AI-error impact tests followed by
  fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Four contracts failed red: preview, failed and cancelled terminal states all
  accepted 100 delayed event bursts, while streaming regressed to connecting
  after duplicate early lifecycle events.
- Terminal states now reject every event from the same old job before buffering
  output or changing usage/error/candidate state.
- Active transitions are monotonic: duplicate job-started and
  connection-opened events cannot move streaming backwards.
- Ordered generation still reaches a validated preview, and explicit
  regeneration remains the supported path out of a terminal result.
- Focused Store regression: 1 file / 40 tests passed.
- Impact regression: 10 files / 151 tests passed.
- Full frontend acceptance: lint, TypeScript, 180 files / 886 tests and the
  production build passed with no timer or worker leaks.
- Rust baseline: 79 tests discovered, 77 passed, 2 environment-gated tests
  ignored and 0 failed.
- Execution status is `PASS`; product status remains `PARTIAL` for the open
  release gates above.
