# 103 Project open recovery control and clipboard convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `57bb4e8` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,822 unmapped items. Test mapping is 184/1,058,
  leaving 874 discovered cases unmapped.
- Control inventory has 492 declarations and 89 missing stable selectors.
- `ProjectOpenErrorDialog.tsx` renders seven distinct recovery actions, but the
  inventory collapses them into four declarations. Retry, read-only open and
  repair share one missing identity; one of two rendered product cases remains
  unmapped.
- Copying the redacted safe path awaits the browser clipboard without a
  single-flight guard or rejection boundary. A clipboard denial can escape as
  an unhandled Promise and gives the author no retryable feedback.

## Failure-first contracts

1. Dialog, copy path, retry, read-only open, repair, open directory,
   diagnostics and close surfaces expose distinct stable identities while
   preserving their accessible Chinese names.
2. One hundred same-frame copy actions start one clipboard write and keep the
   copy control disabled until it settles.
3. A clipboard rejection becomes localized, public-safe inline feedback and
   keeps the same copy action available for an explicit retry.
4. A successful retry announces completion without exposing private exception
   details or changing the intentionally redacted safe path.
5. Retry, read-only, directory, diagnostics, close and conditional repair
   actions remain visible, accessible and invoke their callbacks once.
6. All seven logical controls and both existing product cases gain
   conservative mappings without adding discovered test debt.

## Validation

- Extend existing component and inventory cases, run them red, then implement
  the smallest stable-control and clipboard recovery boundary.
- Run project-open dialog, store/service, app-shell and project-open experience
  impact tests under Node 24, plus typecheck and zero-warning lint.
- Run all frontend tests, production build, Rust acceptance and QA
  infrastructure from a fixed product commit.
- Rebuild traceability and record net movement from 9,822 aggregate gaps, 89
  selector gaps and 874 unmapped tests. Report honest inventory expansion
  separately from mapping progress.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

Pending execution.
