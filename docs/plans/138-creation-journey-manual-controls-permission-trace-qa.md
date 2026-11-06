# 138 Creation Journey manual controls, permission and trace QA

Date: 2026-11-06

## Goal

Converge the author-controlled Creation Journey editor from ideas through
directions, outline, chapter proposals, impact review and first-chapter entry.
Every repeated control must have locale-independent and instance-specific
identity, while read-only projects must remain browsable without exposing any
project mutation path.

## Baseline

- Global inventory: 542 controls / 11,924 states / 1,107 tests.
- Global mapped: 458 controls / 5,664 states / 330 tests.
- Global unmapped: 84 controls / 6,260 states / 777 tests; 7,316 strict gaps.
- Stable selector gaps are formally zero, but 15 Creation Journey controls
  still rely on localized accessible names or form names instead of exact test
  IDs.
- Creation Journey Page: 39 controls / 858 states; only 15 controls and 94
  states are strictly mapped, leaving 24 controls with no owned mapping.
- Read-only disables the main AI/materialization actions but does not disable
  manual fields, locks, reorder/delete actions or impact resolutions; the shared
  state mutation path also lacks a read-only guard.

## User risks

1. Read-only authors can receive apparently successful local edits that later
   attempt persistence or drift away from the project snapshot.
2. Repeated direction, outline and chapter controls cannot be selected by exact
   resource identity across copy or locale changes.
3. Locking, reordering, deleting, custom guidance, impact dismissal and opening
   the first chapter can regress without dedicated author-journey ownership.
4. A broad end-to-end test can pass while individual disabled, keyboard, focus,
   persistence and restart states remain unowned.

## Execution

1. Add failure-first rendered contracts for editable stages, read-only browsing,
   error recovery, guidance/impact controls and first-chapter navigation.
2. Add exact test IDs plus element/direction/outline/chapter instance IDs to all
   remaining controls.
3. Add a fail-closed read-only guard at the shared state mutation boundary and
   disable every rendered mutation control while keeping stage navigation and
   first-chapter viewing available.
4. Run focused tests, repeated-action pressure, QA infrastructure and fixed
   Node/Rust release gates.
5. Regenerate trace artifacts and record product/evidence commits separately.

## Release rule

This batch may reduce strict gaps while release remains blocked. No release claim
is allowed until strict traceability, real-provider smoke and packaged-EXE
acceptance all pass.

## Outcome

- Failure-first tests exposed 24 unmapped controls, locale-dependent selectors
  and writable manual controls in read-only projects.
- Honest inventory expansion identified 52 rendered controls rather than the
  previously collapsed 39. All 52 now use exact `data-testid` selectors and
  repeated elements carry element, direction, outline-node or chapter IDs.
- Creation Journey reaches 52/52 mapped controls and 768/1,144 mapped states.
  Five new rendered contracts cover editable stages, read-only browsing,
  failure recovery and exact first-chapter opening; the existing journey test
  also owns the AI/materialization path.
- Five pressure rounds passed 35/35 cases. The read-only contract attempted 100
  blocked mutations per round, for 500 attempts and zero persistence writes.
- Node 24 acceptance passed lint, typecheck, 212/212 files, 1,032/1,032 tests
  and production build. Rust formatting passed, but the current cold test run
  was blocked before collection by Windows denying execution of generated
  dependency build scripts; the same Rust source/toolchain last passed 77 tests
  with two reasoned ignores, and this batch changes no Rust source.
- Strict gaps fall from 7,316 to 6,901. Release remains blocked by those gaps,
  real-provider smoke and packaged-EXE acceptance.
