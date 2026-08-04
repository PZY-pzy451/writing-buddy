# Project open latest-intent QA

Date: 2026-08-04

## User risk

Project opening is single-flight, but author intent is not necessarily repeated.
If project A is still loading and the author selects project B, B must not be
silently discarded. Repeated clicks on one target should still perform one
native open, while distinct targets should converge on the latest choice.

## Contracts

1. One hundred same-target actions continue to produce one native open.
2. If A is active and 100 B actions arrive, the store opens A at most once and
   B at most once, then leaves B active.
3. If A is active and B then C arrive, B is superseded and only C follows A.
4. Failure of A does not suppress queued B or leave A's recovery dialog visible
   after B succeeds.
5. Every caller in the burst settles only after the latest queued intent has
   completed.
6. Dirty-manuscript confirmation remains single-flight and cancellation never
   opens a project behind the author's decision.

## Execution

- Add deterministic delayed-open and failure pressure tests first.
- Introduce a store-owned latest-intent queue keyed by project root and mode.
- Run project-open, session-restore, save/resource lifecycle and workspace
  impact suites before complete frontend and Rust gates.
- Record exact test totals and retain `PARTIAL` product status for any unrun
  real-provider, packaging or strict traceability gates.

## Result

- Red-first pressure reproduced three lost-intent paths and one stale-visibility
  path: delayed A plus B, A plus B plus C, failed A plus B, and superseded A
  becoming visible while B remained in flight.
- The store now deduplicates same-target requests and processes one coalesced
  latest target. Intermediate targets are skipped, earlier failure does not stop
  the queue, superseded project state is never committed, and one accepted dirty
  discard confirmation is reused.
- Focused project-open tests passed 12/12; the seven-file project-open/save/
  session/workspace/Story-resource impact set passed 89/89.
- Full Node 24 acceptance passed 178 files / 834 tests, lint, typecheck and the
  production build. Rust collected 79, passed 77 and retained two reasoned
  ignores. The 913-case ledger records 911 passes and two reasoned skips.
- Execution is `PASS`. Product status remains `PARTIAL` because strict
  traceability, real-provider AI smoke and release packaging are not complete.
