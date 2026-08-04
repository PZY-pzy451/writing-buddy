# Manuscript extraction action lifecycle QA

Date: 2026-08-04
Branch: `codex/full-regression-gates-a-e-v2`

## User risk

The manuscript extraction center is a paid, persistence-heavy author path. Its
source currently collapses the author workflow into eleven inventory controls,
five of them unmapped, instead of distinguishing nineteen scope, field, run,
review and recovery declarations. Planning, candidate confirmation and undo also acquire
their visible busy state only through React rendering, so repeated same-frame
actions can enter the same persistence transition more than once.

An unexpected storage failure is rendered with its internal error code. That
leaks implementation details and gives the author no safe recovery guidance.

## Failure-first contracts

1. Inventory must discover all nineteen extraction declarations and report all
   nineteen as stably mapped, including plan, start/resume, stop, confirm and
   undo.
2. One hundred same-frame plan actions must read the selected manuscript once
   and append one run.
3. One hundred same-frame confirmation actions must create one safety snapshot
   and execute one confirmation transaction.
4. One hundred same-frame undo actions must execute one undo transaction.
5. An unexpected storage failure must keep the center visible, preserve retry,
   and show localized guidance without exposing the raw error value.

## Repair boundary

- Add static `data-testid` metadata without replacing author-facing accessible
  names or native control semantics.
- Use a component-owned synchronous mutation guard across asynchronous author
  transitions. Stop remains independently available while a paid run is active.
- Release the guard in every terminal success and failure path so retry remains
  explicit and safe.
- Map known invalid extraction state to actionable localized copy and redact
  all unknown error details.

## Verification

- Red run: extraction page plus inventory contracts fail only for the intended
  selector, repeated-action and error-presentation gaps.
- Focused green: extraction page/service and inventory suites.
- Impact: Story Kernel generation, pending facts, quick capture, app workspace,
  save and publish surfaces touched by candidate persistence and navigation.
- Fixed-commit acceptance: Node 24 lint, typecheck, production build and all
  Vitest files; Rust format/tests; inventory, plan, ledger and convergence
  recording.

## Release boundary

This cycle closes one high-risk author workflow. Product release remains
fail-closed until all remaining selector/traceability debt, real-provider
acceptance and packaged executable acceptance are complete.

## Result

- Five intended contracts failed red. One hundred same-frame plan actions
  appended 100 runs, confirmation created 100 safety snapshots, undo entered
  100 transactions, unexpected storage details were exposed and inventory
  collapsed or omitted author operations.
- A component-owned synchronous mutation guard now covers planning, paid run
  start, stale refresh/replan, candidate confirmation/rejection, reconciliation
  resolution and undo. Stop retains its independent cancellation guard.
- Failed transitions release the guard for one explicit retry. Unknown details
  are redacted to localized recovery guidance while the center stays visible.
- Source controls moved from 11 declarations with five missing selectors to
  19/19 explicit stable declarations. Global controls moved from 461 to 469,
  states from 10,142 to 10,318 and selector debt from 145 to 140. The expanded
  honest surface raises strict traceability debt from 10,901 to 11,065.
- Focused regression passed 2 files / 20 tests. Story Kernel, extraction, quick
  capture, workspace, save and review impact passed 11 files / 163 tests with
  no stderr. QA infrastructure passed 5 files / 22 tests.
- Fixed-commit Node 24 acceptance passed lint, typecheck, production build and
  183 files / 941 tests. Rust collected 79, passed 77 and retained two reasoned
  ignores.
- Product commit: `72e1147` (`fix: harden manuscript extraction actions`).
