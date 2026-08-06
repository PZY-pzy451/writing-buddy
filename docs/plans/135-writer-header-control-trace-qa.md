# 135 Writer Header control and trace QA

Date: 2026-08-06

## Goal

Converge the author-facing chapter header across status, continuation,
organization, export, chapter navigation, density and save actions. Reuse the
existing end-to-end user tests, but give those tests explicit ownership of the
writing editor instead of leaving them incorrectly assigned to the global shell.

## Baseline

- Global inventory: 538 controls / 11,836 states / 1,096 tests.
- Global mapped: 431 controls / 5,043 states / 318 tests.
- Global unmapped: 107 controls / 6,793 states / 778 tests; 7,873 strict gaps.
- Stable selectors: 538/538, but repeated status and density options do not carry
  an instance value and inventory reports several ID-backed header controls as
  accessible-name strategies.
- Writer Header: 12 controls / 264 states, with zero strict mappings.
- Seven existing rendered Writer Header tests are globally unmapped because
  their source file is classified as the global shell.

## User risks

1. Repeated status and density options can only be addressed by array position.
2. Saving, status changes, organization and export must stay single-flight when
   the author repeats an action while persistence is pending.
3. Dirty-manuscript failures must not navigate, update status or export.
4. Keyboard focus, disabled and read-only states must remain visible to authors
   and automation without relying on translated copy.
5. QA must not claim global-shell coverage for tests whose actual subject is the
   chapter header.

## Execution

1. Add a failure-first inventory contract for exact header selectors and repeated
   option context.
2. Add explicit writing-editor ownership to the seven existing header tests.
3. Strengthen rendered assertions for keyboard/focus, disabled, loading,
   repeat/deduplication, offline failure, persistence and restart behavior.
4. Run focused tests repeatedly, writing impact tests, QA infrastructure, fixed
   Node acceptance and Rust acceptance.
5. Regenerate inventory, traceability, dependency and convergence evidence;
   update canonical progress and daily memory.

## Release rule

This batch may reduce strict gaps while release remains blocked. No release claim
is allowed until strict traceability, real-provider smoke and packaged-EXE
acceptance all pass.

## Outcome

- Added exact instance context to repeated status and density controls and
  required the complete 12-control selector contract.
- Reassigned seven existing end-to-end tests to the writing editor and expanded
  their user-state coverage through restart, permission, cancellation and hidden
  failure behavior.
- Fixed Enter/Space activation for Writer Header `summary` menus; busy chapter
  status still rejects activation.
- Passed 24/24 workspace tests, 70/70 pressure instances, 30/30 QA tests,
  Node 24 lint/typecheck/build and 1,017/1,017 frontend tests, plus 77/77 Rust
  tests with two reasoned ignores.
- Writer Header reaches 12/12 controls, 240/264 states and 7/7 tests mapped.
  Global strict gaps fall from 7,873 to 7,566; release remains blocked at 1/4
  hard gates pending strict mapping, real-provider smoke and packaged EXE.
