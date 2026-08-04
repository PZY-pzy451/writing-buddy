# World rule editor save lifecycle QA

Date: 2026-08-04

## User risk

World rules are author-editable Story Kernel resources after manual creation or
AI confirmation. The editor exposes eight real form operations but inventory
collapses them into six declarations, all without stable selectors. Its submit
path also has no synchronous guard, no author-facing failure state and no draft
resynchronization after the repository returns a newer revision. Rapid submits
can multiply writes, while a normal second save can reuse the stale revision.

## Baseline

- `WorldRuleEditor.tsx` contributes six discovered controls, all six missing
  stable selectors; three text areas are collapsed into one declaration.
- Global inventory contains 452 controls and 9,944 derived states.
- Global stable-selector debt is 161 and strict traceability reports 10,710
  aggregate gaps.
- Existing worldbuilding tests open a rule and verify its statement, but do not
  submit, retry a failed write or save the same rule twice.

## Contracts

1. Form, title, category, statement, scope, exceptions, consequences and save
   each expose a distinct static handle while retaining accessible labels.
2. One hundred same-frame submissions start exactly one persistence request.
3. A rejected save shows localized, redacted feedback and releases the guard
   for one explicit retry.
4. When the parent supplies the saved rule at a newer revision, the next edit
   submits that revision rather than the stale pre-save draft.
5. Blank required fields and visible saving feedback remain authoritative.
6. Worldbuilding, repository/Story Kernel and fixed-commit acceptance suites
   reconcile before convergence is recorded.

## Execution

- Add inventory, rendered metadata, pressure/retry and consecutive-save tests
  before production edits.
- Add static semantic metadata, a synchronous save guard, localized error state
  and prop-to-draft revision synchronization.
- Run focused editor tests, worldbuilding impact tests, QA scripts, fixed-commit
  frontend/Rust baselines and convergence recording.

## Release posture

This closes a Story Kernel author-edit and repeat-save persistence boundary.
Product release remains fail-closed until remaining traceability,
real-provider and packaging gates are complete.

## Result

- Five intended contracts failed red: inventory collapsed eight operations to
  six; stable metadata was absent; one hundred submits issued one hundred
  writes; failures had no feedback; and the second save reused revision zero.
- The editor now exposes 8/8 stable controls, uses one synchronous save guard,
  redacts failures, releases retry and remounts on the saved revision.
- Global controls moved from 452 to 454 and states from 9,944 to 9,988 while
  selector debt fell from 161 to 155. Newly explicit controls/states/tests raise
  honest strict traceability debt from 10,710 to 10,749.
- Focused regression passed 2 files / 10 tests. Worldbuilding and Story Kernel
  impact passed 5 files / 58 tests; the panel passed 22 tests after its one
  React async warning was eliminated. QA infrastructure passed 5 files / 19
  tests.
- Fixed-commit Node 24 acceptance passed lint, typecheck, production build and
  182 files / 925 tests. Rust collected 79, passed 77 and retained two reasoned
  ignores.
- Product commit: `0234330` (`fix: harden world rule saves`).
