# 111 AI context and manuscript highlight selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `92ba260` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,594 unmapped items. Test mapping is 196/1,058,
  leaving 862 discovered cases unmapped.
- Control inventory has 510 declarations and 69 missing stable selectors.
- `ContextPreview.tsx` has one anonymous repeated checkbox declaration and 22
  unmapped states. Its three existing UI cases are unmapped even though they
  verify missing-project guidance, required context locking, explicit author-
  secret consent and current-resource privacy.
- `EntityHighlightControls.tsx` has one anonymous repeated checkbox declaration
  and 22 unmapped states. Its three existing cases are unmapped even though they
  verify supported kinds, disabled defaults, independent toggling and per-
  project persistence.

## Failure-first contracts

1. Every repeated AI context record checkbox exposes one stable identity while
   retaining its exact record key, required state and author-secret state.
2. Empty context explicitly proves the repeated controls are absent; eligible
   context proves required controls remain disabled and optional secrets remain
   author-controlled.
3. Every repeated manuscript highlight checkbox exposes one stable identity
   while retaining its exact highlight kind.
4. The existing highlight interaction and persistence cases drive the rendered
   control rather than only testing detached helpers.
5. Existing cases become strictly mapped without increasing discovered test or
   inventory counts.

## Validation

- Extend existing component and inventory cases, run them red, then add only
  semantic identities and contextual attributes.
- Run AI context, manuscript and Writer Workspace impact tests under Node 24,
  plus typecheck, zero-warning lint and diff validation.
- Rebuild traceability against 9,594 aggregate gaps, 69 selector gaps and 862
  unmapped tests; report global gain separately from source-local mappings.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Source `921ecba` gives repeated AI context records the stable identity
  `ai-context-record-toggle` plus exact key, kind, required and author-secret
  context. Repeated highlight controls expose `entity-highlight-kind-toggle`
  plus exact highlight kind.
- Five failure-first contracts reproduced both anonymous declarations. They
  converged to 21/21 focused/inventory and 57/57 AI context, manuscript and
  Writer Workspace impact tests.
- Empty context verifies no toggle is rendered. Required records remain locked,
  optional secrets remain explicit author consent, and current-resource context
  does not claim project metadata is sent. Highlight persistence is now driven
  through the rendered controls in the existing test.
- The Context Preview control, 2 of 22 states and 2 product cases map. The
  highlight control, 6 of 22 states and all 3 product cases map. No controls,
  states or tests were added to inventory.
- Sequential fixed-source acceptance passed 189 frontend files / 979 tests,
  production build, 77 native tests with two reasoned ignores and 30/30 QA
  infrastructure tests.
- Global mapped controls rise by 2, states by 8 and tests by 5. Strict gaps fall
  from 9,594 to 9,579, selector gaps from 69 to 67 and unmapped tests from 862
  to 857. Strict coverage is 26.55%, stable-selector coverage is 86.86%, test
  mapping is 19.00% and release hard gates remain 1/4 complete.
