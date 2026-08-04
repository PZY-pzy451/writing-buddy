# Manuscript extraction early-stop intent QA

Date: 2026-08-04

## User risk

The extraction runner currently resets its stop flag only after its first
asynchronous ledger load. If the author presses Stop immediately after Start,
that intent can be overwritten and the first paid AI request can still begin.
The same gap exists while source text or provider preferences are loading,
before a native AI job ID has registered a cancellation callback.

## Contracts

1. Stop issued in the same turn as `run()` remains authoritative after the
   initial ledger load and starts zero chapter processors.
2. Stop while chapter source text is loading prevents the processor from
   starting after that read resolves.
3. Stop during provider preflight starts zero native AI jobs, even though no
   native job ID exists yet.
4. One hundred rendered Stop actions still invoke one runner stop and expose
   immediate disabled feedback.
5. A stopped run releases its cancellation state so one later explicit resume
   can process the queued or cancelled chapter normally.

## Execution

- Add deterministic service tests that hold the ledger/source await boundary.
- Add a rendered test that holds AI preference lookup before native generation.
- Move stop ownership to a per-run cancellation signal created synchronously
  by the runner, and propagate that signal through provider preflight.
- Run focused extraction and grounded-AI tests, impacted AI lifecycle tests,
  then fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Four contracts failed red. An immediate Stop was overwritten during ledger
  initialization, Stop during source loading still ran the processor, and both
  the rendered flow and direct Grounded AI runner started one native job after
  cancellation during preference lookup.
- Each run now creates an `AbortSignal` synchronously before its first await.
  Stop aborts that signal, source and processor boundaries recheck it, and AI
  provider preflight rejects cancellation before native generation starts.
- A stopped run releases its signal and can be explicitly resumed. Existing
  active-job native cancellation and completed-chapter preservation remain
  green.
- Focused extraction/Grounded AI regression: 3 files / 21 tests passed.
- Shared Grounded AI impact regression: 13 files / 58 tests passed.
- Fixed-commit Node 24 acceptance passed lint, typecheck, production build and
  180 files / 912 tests. Rust collected 79 tests, passed 77, failed zero and
  retained two reasoned ignores.
- Inventory discovers 991 total cases, including 912 frontend cases, 97
  parameterized instances and zero unresolved declarations. Stable-selector
  debt remains 212.
- Execution is `PASS`. Product status remains `PARTIAL` because strict
  traceability has 10,159 open mappings, and real-provider smoke plus release
  packaging remain unrun.
