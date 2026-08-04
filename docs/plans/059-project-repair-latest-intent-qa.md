# Project repair latest-intent QA

Date: 2026-08-04

## User risk

Repairing a damaged project is asynchronous and may take longer than choosing a
different project. If repair of project A completes after the author has chosen
project B, the older repair action must not reopen A or replace B's error with a
stale recovery dialog.

## Contracts

1. One hundred same-tick Repair actions still perform one native repair.
2. If repair A is pending and the author opens B, successful repair A does not
   open A; B remains active.
3. If repair A fails after B succeeds, A's stale failure is ignored and B stays
   active without a recovery dialog.
4. If B fails while repair A is pending, later completion of A does not replace
   B's actionable error or pending root.
5. A repair that is still the latest intent opens its repaired project exactly
   once and remains retryable after failure.

## Execution

- Add delayed repair/open success and failure ordering tests before production
  changes.
- Track the latest project-selection intent across both open and repair actions.
- Run the project-open suite, project/session/save impact set, full Node 24
  acceptance and Rust acceptance.
- Record exact totals and retain `PARTIAL` product status while strict
  traceability, real-provider and packaging gates remain open.

## Result

- The old implementation failed exactly three of 15 focused contracts: delayed
  repair success reopened A after B, delayed repair failure polluted B, and old
  repair success hid B's actionable open failure.
- Repair and open now share one monotonic author-intent version. Superseded
  repair completion clears only its own busy flag and cannot open a project or
  publish an error. One hundred Repair actions still invoke one native repair.
- Focused project-open tests passed 15/15; the seven-file project-open/save/
  session/workspace/Story-resource impact set passed 92/92.
- Full Node 24 acceptance passed 178 files / 837 tests, lint, typecheck and the
  production build. Rust collected 79, passed 77 and retained two reasoned
  ignores. The 916-case ledger records 914 passes and two reasoned skips.
- Execution is `PASS`. Product status remains `PARTIAL` because strict
  traceability, real-provider AI smoke and release packaging are not complete.
