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
