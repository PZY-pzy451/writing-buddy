# 119 Review Center selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `0e4e42f` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,076 unmapped items. Test mapping is 225/1,058,
  leaving 833 discovered cases unmapped.
- Control inventory has 511 declarations and 50 missing stable selectors.
- `ReviewPage.tsx` has 5 inventoried declarations / 110 states, but only 2
  stable identities and no strictly mapped control or state. Its composite
  review-mode tabs, publish-checklist toggle and repeated checklist actions are
  anonymous.
- All 10 exact `ReviewExperience.test.tsx` cases remain unmapped despite
  exercising local review, AI review, publish checks, saving, navigation,
  confirmation, cancellation and retry.

## Failure-first contracts

1. Manual and AI review tabs share one stable identity plus exact mode context.
2. The publish checklist disclosure has one stable identity and retains its
   accessible expanded/collapsed name.
3. Repeated publish-check actions share one stable identity plus exact check and
   action-type context.
4. Local review proves successful offline execution without a paid AI request.
5. Checklist disclosure proves visible and accessible behavior before routing.
6. Saving, issue navigation, delivery confirmation and revocation are driven
   through the rendered composite action identities.
7. AI review proves the rendered AI mode and successful streamed result while
   retaining author confirmation.
8. No control, state or test is added solely to improve percentages.

## Validation

- Extend existing Review Experience cases first and preserve the absent
  identities as a red baseline; add only semantic identity/context attributes.
- Add the Review Center declarations to the existing inventory contract without
  adding a discovered QA test.
- Run review, save, export, history, AI and Writer Workspace impact tests under
  Node 24, plus typecheck, zero-warning lint and diff checks.
- Rebuild traceability against 9,076 aggregate gaps, 50 selector gaps and 833
  unmapped tests; report mapped-control/state/test gains separately.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source: `7dffe30`.
- Six failure-first assertions reproduced the anonymous review-mode,
  publish-toggle and repeated publish-action identities. The corrected focused
  set passed 10/10; the wider review/save/export/writer impact set passed
  111/111 and QA contracts passed 20/20.
- Review Center remains 5 controls / 110 states while stable identities rise
  from 2 to 5. Strictly mapped controls rise from 0 to 3, states from 0 to 54
  and exact Review Experience cases from 0/10 to 9/10.
- Local review explicitly proves offline execution without a paid request.
  Existing cases also prove keyboard focus/Enter navigation, accessible
  disclosure, exact action context, save persistence, streamed AI success,
  delivery persistence/undo, cancellation deduplication and retry.
- Global inventory remains 511 controls / 11,242 states / 1,058 tests. Mapped
  features rise by 1, controls by 3, states by 54 and tests by 9; strict gaps
  fall by 67 to 9,009, selector gaps by 3 to 47 and unmapped tests by 9 to 824.
- Fixed-source sequential gates passed 189 frontend files / 979 tests plus
  production build, 77 Rust tests with two reasoned ignores, and 30/30 QA
  infrastructure tests. Runtime and static frontend inventories both equal
  979.
- Strict coverage is 4,055/13,064 (31.04%), selector coverage is 464/511
  (90.80%) and test mapping is 234/1,058 (22.12%). Release remains 1/4 hard
  gates complete pending strict traceability, real-provider smoke and packaged
  EXE acceptance.
