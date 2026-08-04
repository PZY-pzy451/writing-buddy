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

