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

Pending execution.
