# 137 Status Bar control, permission and trace QA

Date: 2026-08-06

## Goal

Converge the always-visible author Status Bar across quick capture, inbox and
Task Dock entry points. Each action must have a locale-independent identity and
must expose the correct enabled, hidden, keyboard, focus and read-only behavior.

## Baseline

- Global inventory: 542 controls / 11,924 states / 1,101 tests.
- Global mapped: 455 controls / 5,587 states / 325 tests.
- Global unmapped: 87 controls / 6,337 states / 776 tests; 7,395 strict gaps.
- Stable selector gaps: 0, but all three Status Bar actions still rely on
  localized accessible-name selectors rather than exact action identities.
- Status Bar: 3 controls / 66 states; 0 controls / 0 states strictly mapped.
- The read-only quick-capture action appears enabled and only reports an error
  after activation instead of communicating the permission boundary up front.

## User risks

1. Locale or copy changes can silently break automation for all three global
   author shortcuts.
2. Read-only authors receive a misleading enabled write action.
3. No-session disabled behavior and focus-mode hiding can regress unnoticed.
4. Pointer, keyboard, cancellation and focus restoration are not owned by a
   dedicated Status Bar journey.

## Execution

1. Add failure-first rendered tests and inventory contracts for the three exact
   action identities.
2. Disable quick capture when no writable session exists while preserving inbox
   browsing and Task Dock navigation in read-only mode.
3. Exercise counts, pointer routing, keyboard cancellation, focus restoration
   and focus-mode visibility from the author surface.
4. Run focused tests, pressure rounds, QA infrastructure and fixed Node/Rust
   release gates.
5. Regenerate trace evidence and record product/evidence commits separately.

## Release rule

This batch may reduce strict gaps while release remains blocked. No release claim
is allowed until strict traceability, real-provider smoke and packaged-EXE
acceptance all pass.

## Outcome

- Product source `148d8c3` gives all three Status Bar actions exact
  `data-testid` identities and disables quick capture for read-only projects
  while preserving inbox and Task Dock navigation.
- Six rendered user journeys cover no-session, writable, read-only, offline,
  focus-mode, pointer, keyboard, cancellation, focus restoration, repeated
  request and restart-persistence behavior. Ten Status Bar pressure rounds pass
  60/60 cases and collapse 1,000 rapid requests to ten dialogs.
- The first complete run exposed a neighboring three-direction continuation
  test hitting its generic five-second ceiling only under full-suite contention.
  Source `54ce0bb` retains the eventual visible-state assertion with an explicit
  integration timeout; that case then passed 20/20 pressure executions.
- Fixed Node 24.14.0 acceptance passes lint, typecheck, 212/212 files,
  1,028/1,028 frontend tests and production build. Rust passes 77 tests with
  two reasoned ignores and zero failures.
- Status Bar reaches 3/3 mapped controls, 57/66 mapped states and 6/6 owned
  tests. The remaining nine generic loading/failure/undo state dimensions do not
  apply to these synchronous shell actions and remain honest gaps pending
  reasoned N/A support.
- Global mapping reaches 458 controls / 5,664 states / 330 tests. Strict gaps
  fall from 7,395 to 7,316 and stable selectors remain complete at 542/542.
  Release remains blocked by strict trace completion, real-provider smoke and
  packaged-EXE acceptance.
