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
