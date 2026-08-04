# AI drawer reopen-cancellation QA

Date: 2026-08-04

## User risk

An author can press Stop and immediately reopen AI quick actions from another
chapter while the first native cancellation is still pending. `openAiAction()`
currently sends its own unguarded cancellation, so one author intent can become
two bridge commands. The old job must not overlap, charge twice or leak output
into the newly opened context.

## Contracts

1. Reopening from a new chapter during streaming invalidates the old attempt and
   requests at most one native cancellation.
2. One hundred repeated reopen actions remain one cancellation and preserve the
   latest requested chapter context.
3. If Stop already owns the cancellation, reopen reuses that in-flight boundary
   instead of sending another bridge command.
4. Old buffered output, delayed stream events and late cancellation success or
   failure cannot mutate the reopened action.
5. The reopened action remains usable and can start one fresh provider request
   after the old cancellation settles.

## Execution

- Add Store pressure and ordering contracts before changing behavior.
- Route reopen, stale-source invalidation and reset through one shared guarded
  silent-cancellation helper while preserving explicit Stop feedback.
- Run drawer, App, AI, session and save impact tests followed by complete Node
  24 and Rust acceptance.
- Keep product status `PARTIAL` while traceability, real-provider smoke and
  packaging gates remain open.

## Result

- Two parameterized red instances proved that reopening while an explicit Stop
  cancellation was pending sent two native cancellation commands on both
  success and failure completion paths.
- Reopen, stale-source invalidation and reset now share one guarded silent
  cancellation helper. One hundred reopen actions preserve the latest chapter,
  cancel once and discard buffered or delayed output.
- Late cancellation success/failure cannot mutate the reopened action, which
  remains able to start one fresh request against the current chapter.
- Focused drawer suites pass 25/25 and the nine-file impact set passes 121/121.
  Full Node 24 acceptance passes 179 files / 858 tests plus lint, typecheck and
  production build. Rust collects 79, passes 77 and retains two reasoned
  ignores.
- Execution is `PASS`; product remains `PARTIAL` pending traceability,
  real-provider smoke and release-package evidence.
