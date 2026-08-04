# 089 Relationship Inspector save convergence QA

## Objective

Continue net QA convergence from the accepted baseline:

- traceability `totalUnmapped`: 10,489;
- controls missing a stable selector: 130;
- release gates complete: 1/4.

## User risks

1. The four editable/save declarations in Relationship Inspector have no stable selector.
2. One hundred same-frame Save actions can dispatch one hundred persistence requests before the parent renders `saving`.
3. A rejected save has no inspector-owned retry feedback, and the parent currently consumes the rejection after exposing its raw message.
4. The form is keyed only by relationship ID, so an authoritative saved revision can leave the mounted draft on the previous revision and cause the next edit to stale-write.

## Failure contracts

1. Inventory discovers four distinct Relationship Inspector controls with exact selector values and zero missing selectors.
2. One hundred same-frame Save actions dispatch once and expose a pending state.
3. Rejection displays localized feedback, releases the guard and permits one explicit retry.
4. Re-rendering the same relationship ID with a newer authoritative revision resets the draft; the second save carries that revision.
5. Regenerated QA evidence ends below both 10,489 unmapped items and 130 selector gaps.

## Verification

- Failure-first Relationship Inspector and inventory contracts.
- Focused Relationship Inspector and relationship-page suites.
- QA orchestration, lint and typecheck.
- Fixed-commit Node 24 frontend acceptance, Rust baseline, QA plan and convergence ledger.

## Release boundary

This cycle does not authorize release. Strict traceability, real-provider smoke and packaged-EXE acceptance remain fail-closed gates.
