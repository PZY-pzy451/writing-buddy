# 090 Story Association persistence convergence QA

Date: 2026-08-04

## Baseline

- Source baseline: `b3f1cf3` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 10,418 unmapped items.
- Control inventory has 472 declarations and 126 missing stable selectors.
- `StoryAssociationPage.tsx` owns four of those missing selectors: the
  draggable source, chapter toggle, foreshadowing action and confirmation
  write control.
- Confirmation relies on rendered `saving` state, so same-frame clicks can
  enter the persistence callback more than once.
- Data reload has neither same-project single-flight deduplication nor
  latest-project result isolation. Raw loader errors can also expose local
  paths without an actionable retry.

## Failure-first contracts

1. Every interactive association declaration has a stable selector; the four
   previously missing declarations have distinct, explicit values.
2. One hundred same-frame confirmation clicks call the persistence boundary
   once, expose pending feedback, prevent cancellation while saving and allow
   one explicit retry after failure.
3. One hundred same-frame load retries share one loader request and raw loader
   details are replaced with localized, actionable feedback.
4. When project B opens before project A finishes loading, A's late success or
   failure cannot replace B's data or error state.
5. Inventory generation enforces the exact selector set so future UI changes
   cannot silently recreate the debt.

## Validation

- Run the new component and inventory contracts red before implementation.
- Run the association feature impact set and QA infrastructure suites.
- Run Node 24 lint, typecheck, all frontend tests and production build.
- Run Rust format/tests, rebuild the traceability artifacts and record the net
  movement from 10,418 unmapped items / 126 missing selectors.
- Keep the release decision blocked until strict traceability, real-provider
  smoke and packaged-EXE acceptance are complete.

## Result

- Five of nineteen failure-first contracts failed on the old implementation:
  four selectors were absent, 100 confirmations multiplied persistence calls,
  loader errors exposed private paths without retry and an old project's late
  result replaced the active project.
- Source `9b41b04` maps all 9 association declarations. One hundred confirm or
  retry actions produce one write/load, cancellation is locked while saving,
  failures remain retryable and old project results are ignored.
- The first full baseline found one global visual-contract regression in the
  retry button's low-opacity disabled state. Semantic text/background colors
  replaced opacity and the focused visual contract passed 9/9.
- Focused contracts passed 19/19, association impact passed 8/8 and QA
  infrastructure passed 28/28.
- Fixed-commit Node 24 acceptance passed lint, typecheck, 188 files / 970 tests
  and production build. Rust collected 79, passed 77 and retained two reasoned
  ignores.
- Stable-selector debt fell from 126 to 122. Aggregate strict gaps fell from
  10,418 to 10,410 while six new frontend tests and 44 newly represented states
  were added.
