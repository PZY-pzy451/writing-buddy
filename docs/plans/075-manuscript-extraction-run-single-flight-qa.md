# Manuscript extraction run single-flight QA

Date: 2026-08-04

## User risk

The manuscript extraction center renders its run button disabled after
`busyAction` changes, but the handler and `ManuscriptExtractionRunner` have no
synchronous active-run lock. Repeated Start actions in one render frame can
therefore enter the runner many times before React commits the disabled state,
causing concurrent ledger reads/writes, confusing failures and potentially
more than one paid AI request.

## Contracts

1. One hundred rendered Start actions in the same frame invoke the page runner
   exactly once and immediately expose the existing disabled run status.
2. One hundred direct calls on one runner instance share a single active
   Promise, execute one chapter processor and finish with no rejected callers.
3. UI state is not the authority: bypassing the disabled button still cannot
   create another run while one is active.
4. Completion or failure releases both guards so one explicit later resume can
   run normally.
5. Existing Stop single-flight, completed-chapter preservation and explicit
   resume behavior remain unchanged.

## Execution

- Add rendered and service pressure contracts before production changes.
- Hold the first run/processor open so all 100 attempts overlap deterministically.
- Add a synchronous page guard and a runner-owned shared active Promise.
- Run page/service plus AI generation, Story Kernel staging and cancellation
  impact tests, then fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Two pressure contracts failed red. One hundred same-frame Start actions
  invoked the page runner 100 times; one hundred direct runner calls returned
  100 independent Promises and produced 99 `staleWrite` rejections.
- The page now owns a synchronous run guard, and the runner owns one shared
  active Promise independent of rendered state. One hundred calls execute one
  processor, all callers receive the same successful result, and a later
  explicit call receives a new Promise.
- Existing Stop, completed-chapter preservation, stale-source handling and
  explicit failed-chapter resume contracts remain green.
- Focused page/service regression: 2 files / 15 tests passed.
- Page/service/AI-runner/Story-Kernel-staging/cancellation impact regression:
  5 files / 48 tests passed.
- Inventory discovers 987 total cases, including 908 frontend cases, 97
  parameterized instances and zero unresolved declarations. This change does
  not alter the existing 212 stable-selector gaps.
- Fixed-commit Node 24 acceptance passed lint, typecheck, production build and
  180 files / 908 tests. Rust collected 79 tests, passed 77, failed zero and
  retained two reasoned ignores.
- Execution is `PASS`. Product status remains `PARTIAL` because strict
  traceability has 10,156 open mappings, 212 declarations still lack stable
  selectors, and real-provider smoke plus release packaging remain unrun.
