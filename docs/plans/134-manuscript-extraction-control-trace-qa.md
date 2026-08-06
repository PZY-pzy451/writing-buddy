# 134 Manuscript extraction control and trace QA

Date: 2026-08-06

## Goal

Converge the author-facing manuscript extraction workflow from plan creation
through paid execution, interruption, reconciliation and candidate disposition.
Every actionable surface in the extraction center must have a durable semantic
identity, a rendered user contract and conservative global traceability.

## Baseline

- Global inventory: 531 controls / 11,682 states / 1,092 tests.
- Global mapped: 409 controls / 4,503 states / 309 tests.
- Global unmapped: 122 controls / 7,179 states / 783 tests; 8,279 strict gaps.
- Stable selectors: 531/531, but several extraction actions still rely only on
  localized accessible names and repeated collection selectors.
- Extraction page source: 19 controls / 418 states, with only 4 controls and 32
  states strictly mapped.
- Extraction page and service tests: 24 discovered, only 6 strictly mapped.

## User risks

1. Repeated or translated labels can make automation address the wrong stale
   chapter, reconciliation field or generated candidate.
2. Planning, starting, stopping and retrying must remain single-flight under
   rapid input and must not silently incur duplicate AI work.
3. Provider validation, malformed output and storage failures must remain
   localized, retryable and free of raw internal error leakage.
4. Reconciliation and candidate confirmation must never write unselected or
   malformed data into Story Kernel.
5. Destructive rejection and reversible confirmation need explicit, testable
   user feedback and persisted outcomes.

## Execution

1. Add failure-first rendered tests for durable extraction action identities and
   keyboard/focus/disabled contracts.
2. Add or refine `data-testid` and action/context attributes without changing
   accessible names.
3. Extend rendered contracts across plan/start/stop/retry, filters,
   reconciliation, evidence, defer/reject, confirmation and undo.
4. Re-run focused tests repeatedly, the extraction domain, QA infrastructure,
   fixed Node acceptance and Rust acceptance.
5. Regenerate inventory, traceability, dependency and convergence evidence;
   update canonical progress and daily memory with honest denominator changes.

## Release rule

The batch can improve coverage while release remains blocked. No release claim
is allowed until strict traceability, real-provider smoke and packaged-EXE
acceptance all pass.

## Outcome

- Source `a602742d` adds exact identities for all 26 extraction controls and
  maps all 572 generated control states plus all 15 rendered page tests.
- A failure-first offline integration test exposed structured provider errors
  being reduced to `unknown`; supported error codes are now retained while raw
  provider details remain redacted and retry remains available.
- Extraction passed 33/33 tests and 10 pressure rounds / 280 page-service test
  instances. QA infrastructure passed 30/30.
- Fixed Node 24 acceptance passed lint, typecheck, 211 files / 1,017 tests and
  production build. Rust passed 77 tests with two reasoned ignores and no
  failures or compiler warnings.
- Global mapped controls/states/tests are 431 / 5,043 / 318; unmapped counts are
  107 / 6,793 / 778. Strict gaps fell 406 to 7,873 and selector gaps remain zero.
- Release remains blocked at 1/4 hard gates until strict mapping, real-provider
  smoke and packaged-EXE acceptance are complete.
