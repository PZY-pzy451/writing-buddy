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
