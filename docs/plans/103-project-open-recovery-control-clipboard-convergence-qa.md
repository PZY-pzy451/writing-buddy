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

- Fixed product source: `9e42b79`.
- The inventory now exposes all seven recovery actions independently. All seven
  have stable identities, all seven are strictly mapped and both existing
  product cases are mapped without adding discovered test debt.
- Safe-path copying is single-flight: 100 same-frame author actions start one
  clipboard write. Clipboard denial becomes localized, public-safe feedback;
  the author can retry explicitly and receives a success status.
- Three failure-first assertions converged to 17/17 focused tests, 49/49 impact
  tests and 30/30 QA infrastructure tests. Fixed-source sequential acceptance
  passed 188 frontend files / 979 tests, production build and 77 native tests
  with two reasoned ignores.
- The first concurrent gate attempt ended when ESLint received Windows exit
  `3221226505`. It is recorded as infrastructure resource contention and is not
  used as product evidence; the isolated sequential rerun passed completely.
- Honest inventory expansion adds 3 controls and 66 states. The seven source
  controls contribute 77 mapped states and global mapped states rise by 73.
  Strict gaps fall by 10 from 9,822 to 9,812, selector gaps fall from 89 to 88
  and unmapped tests fall from 874 to 873.
- Deterministic execution is 100%; strict coverage is 2,884/12,696 (22.72%),
  stable selectors are 407/495 (82.22%) and test mapping is 185/1,058
  (17.49%). Release gates remain 1/4 complete (25%), so release stays blocked
  by strict traceability, real-provider smoke and packaged-EXE acceptance.
