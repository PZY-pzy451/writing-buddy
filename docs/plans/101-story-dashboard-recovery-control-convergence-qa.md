# 101 Story Dashboard recovery and control convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `c4fa00f` on `codex/full-regression-gates-a-e-v2`.
- Corrected strict traceability has 9,863 unmapped items. Test mapping is
  176/1,058, leaving 882 discovered cases unmapped.
- Control inventory has 486 declarations and 91 missing stable selectors.
- `StoryDashboardPage.tsx` has one generated creation-journey action without a
  stable identity, while generated next-step and recent-chapter actions are
  collapsed out of the inventory; all six existing dashboard tests are
  unmapped.
- A synchronous loader throw or rejected dashboard load Promise is not caught,
  so the author's writing home can remain busy indefinitely instead of keeping
  chapter writing and navigation available.

## Failure-first contracts

1. Generated creation-journey, next-step and recent-chapter actions expose the
   distinct stable identities `story-dashboard-creation-journey`,
   `story-dashboard-next-step` and `story-dashboard-recent-chapter` while
   retaining task/chapter-specific names.
2. Synchronous and asynchronous dashboard load failures are converted to a
   bounded, public-safe fallback without exposing raw exception details.
3. The writing home leaves its busy state, shows localized partial-data status
   and keeps chapter/navigation cards usable after the failure.
4. Loading, empty-project next step, partial failure, populated keyboard
   navigation, persisted-position continuation and planning navigation remain
   covered by the six existing product cases.
5. All five dashboard control declarations and all six existing product tests
   gain conservative mappings without adding discovered test debt.

## Validation

- Extend existing component and inventory cases, run them red, then implement
  the smallest recovery boundary.
- Run Story Dashboard, app shell and writing-workspace impact tests under Node
  24, plus typecheck and zero-warning lint.
- Run all frontend tests, production build, Rust acceptance and QA
  infrastructure from a fixed product commit.
- Rebuild traceability and record movement from 9,863 aggregate gaps, 91
  selector gaps and 882 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source `2fc51eb` catches both synchronous loader throws and rejected
  Promises. The writing home exits its busy state, shows localized public-safe
  partial-data status and keeps chapter, planning and review navigation usable.
- Creation journey, next step and recent chapter actions now have distinct
  stable identities. Inventory expands from two collapsed declarations to five
  real controls; all five are stable and strictly mapped.
- Three initial failures converged to 21/21 focused, 59/59 impacted and 30/30
  QA infrastructure tests. Fixed-source acceptance passed 188 frontend files /
  979 tests, production build and 77 Rust tests with two reasoned ignores.
- All six existing Dashboard cases gain strict mappings without adding tests.
  The honest expansion adds 3 controls and 66 states, while valid mappings grow
  by 75; strict coverage rises from 21.03% to 21.51%.
- Aggregate gaps fall by 6 from 9,863 to 9,857, selector gaps fall from 91 to
  90 and unmapped tests fall from 882 to 876.
- Product remains `PARTIAL`; strict traceability, real-provider smoke and
  packaged-EXE acceptance remain open release gates.
