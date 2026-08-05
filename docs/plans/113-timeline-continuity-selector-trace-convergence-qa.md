# 113 Timeline reorder and continuity review selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `de201c0` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,549 unmapped items. Test mapping is 203/1,058,
  leaving 855 discovered cases unmapped.
- Control inventory has 510 declarations and 64 missing stable selectors.
- `TimelineReorderRail.tsx` has two anonymous repeated controls, 44 unmapped
  states and two helper-only cases that do not exercise the rendered rail.
- `ContinuityReviewPage.tsx` has one anonymous repeated issue control. Its
  evidence and resolution case is globally unmapped, while none of the page's
  three inventoried controls have source-local state mappings.

## Failure-first contracts

1. Every timeline drag handle exposes one stable identity plus exact event id
   and narrative order while honoring the disabled state.
2. Every timeline event selector exposes one stable identity plus exact event
   id and narrative order, and selection does not mutate chronological fields.
3. Existing reorder-preview cases also drive rendered selection and disabled
   controls without increasing test inventory.
4. Every continuity issue row exposes one stable identity plus exact issue id,
   severity, status, source layers and AI provenance.
5. The existing continuity case drives severity filtering, evidence opening,
   resolution persistence and reopening through rendered controls.
6. Existing cases become strictly mapped without adding controls, states or
   discovered tests.

## Validation

- Extend existing component/helper and inventory cases, run them red, then add
  only semantic identities and contextual attributes.
- Run timeline, continuity and Writer Workspace impact tests under Node 24,
  plus typecheck, zero-warning lint and diff validation.
- Rebuild traceability against 9,549 aggregate gaps, 64 selector gaps and 855
  unmapped tests; report global gain separately from source-local mappings.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Source `d6465ff` gives repeated timeline drag handles and event selectors
  stable identities plus exact event id and narrative order. Existing helper
  cases now drive rendered selection and disabled controls.
- Repeated continuity issues expose stable identity plus exact issue id,
  severity, status, source layers and AI provenance. The existing case drives
  filtering, evidence opening, resolution persistence and reopening.
- Four failure-first contracts converged to 19/19 focused/inventory and 54/54
  timeline, continuity and Writer Workspace impact tests.
- Both timeline controls, 6 of 44 states and both product cases map. All three
  Continuity Review controls, 15 of 66 states and both product cases map.
- Sequential fixed-source acceptance passed 189 frontend files / 979 tests,
  production build, 77 native tests with two reasoned ignores and 30/30 QA
  infrastructure tests.
- Global mapped controls rise by 5, states by 25 and tests by 3. Strict gaps
  fall from 9,549 to 9,516, selector gaps from 64 to 61 and unmapped tests from
  855 to 852. Strict coverage is 27.03%, stable-selector coverage is 88.04%,
  test mapping is 19.47% and release hard gates remain 1/4 complete.
