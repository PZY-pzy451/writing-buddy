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

Pending.
