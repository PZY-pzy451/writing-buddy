# 115 Inline plot expansion and Story Kernel trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `c73b39dc` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,450 unmapped items. Test mapping is 208/1,058,
  leaving 850 discovered cases unmapped.
- Control inventory has 510 declarations and 59 missing stable selectors.
- `InlinePlotExpansionControl.tsx` has an anonymous popover trigger and enable
  switch. Its two existing product cases map, but only 2/4 controls have stable
  identities.
- `StoryKernelGeneratorPanel.tsx` has 9/9 stable and mapped controls, but 14 of
  its 22 exact product cases remain globally unmapped. Existing cases already
  prove successful snapshot retry, hidden rejected actions, visual isolation of
  malformed candidates and usable valid relationship candidates.

## Failure-first contracts

1. The Tab expansion popover trigger exposes one stable identity while keeping
   its Tab/Escape shortcut disclosure and explicit-preview behavior.
2. The Tab expansion enable switch exposes a distinct stable identity and keeps
   read-only blocking intact.
3. A rejected safety snapshot remains pending, retries successfully and writes
   exactly once without leaking the raw native error.
4. A rejected candidate removes its Reject action after one storage update,
   even under one hundred same-frame actions.
5. A malformed candidate is visually isolated while valid candidates remain
   reviewable and unwritten until author confirmation.
6. Valid relationship candidates remain enabled and confirmable when one
   unselected malformed relationship is quarantined.
7. Existing cases become strictly traceable without adding controls, states or
   discovered tests.

## Validation

- Extend existing component cases first and capture missing Tab-control
  identities as the red baseline, then add only semantic identities.
- Strengthen existing Story Kernel assertions and titles with the exact state
  each case already proves; do not loosen traceability matching.
- Run inline plot, Story Kernel generation/store/schema and Writer Workspace
  impact tests under Node 24, plus typecheck, zero-warning lint and diff checks.
- Rebuild traceability against 9,450 aggregate gaps, 59 selector gaps and 850
  unmapped tests; report mapped-control/state/test gains separately.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Source `e104ca94` gives the Tab expansion popover trigger and enable switch
  distinct stable identities while preserving Tab/Escape disclosure, explicit
  preview acceptance and read-only blocking.
- Existing Story Kernel cases now carry the exact state evidence they already
  exercise: successful snapshot retry, hidden rejected actions, visual
  quarantine, enabled valid relationship candidates and unchanged-request
  restart after rate limiting.
- Two failure-first contracts converged to 24/24 focused, 84/84 inline plot,
  Story Kernel and Writer Workspace impact, and 20/20 inventory/trace tests.
- Inline plot rises from 2/4 to 4/4 stable and strictly mapped controls, with
  mapped states rising from 20 to 33. Story Kernel exact mapped cases rise from
  8/22 to 13/22 and mapped states from 124 to 157.
- Sequential fixed-source acceptance passed 189 frontend files / 979 tests,
  production build, 77 native tests with two reasoned ignores and 30/30 QA
  infrastructure tests.
- Global mapped controls rise by 2, states by 49 and tests by 4. Strict gaps
  fall from 9,450 to 9,395, selector gaps from 59 to 57 and unmapped tests from
  850 to 846. Strict coverage is 27.96%, stable-selector coverage is 88.82%,
  test mapping is 20.04% and release hard gates remain 1/4 complete.
