# 112 Context pack and scene navigator selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `e12e046` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,579 unmapped items. Test mapping is 201/1,058,
  leaving 857 discovered cases unmapped.
- Control inventory has 510 declarations and 67 missing stable selectors.
- `ContextPackPreview.tsx` has two anonymous repeated declarations and 44
  unmapped states. Its existing author-facing budget, disclosure and optional-
  secret consent case is not mapped.
- `SceneNavigator.tsx` has one anonymous repeated scene declaration. Two
  existing cases for source-range navigation and editor-selection preservation
  are not mapped.

## Failure-first contracts

1. Every context-pack item checkbox exposes one stable identity and preserves
   its exact item id, priority, required state and author-secret state.
2. Every context-pack disclosure control exposes one stable identity, exact
   item id and truthful expanded state.
3. The existing context-pack case drives disclosure, collapse, optional-secret
   inclusion and disabled behavior through rendered controls.
4. Every scene navigation chip exposes one stable identity and preserves the
   exact scene id, manuscript range and current-scene state.
5. Existing navigation cases drive the rendered scene chips while preserving
   editor selection and source-range behavior.
6. Existing cases become strictly mapped without increasing discovered test or
   control inventory counts.

## Validation

- Extend existing component and inventory cases, run them red, then add only
  semantic identities and contextual attributes.
- Run AI context, manuscript and Writer Workspace impact tests under Node 24,
  plus typecheck, zero-warning lint and diff validation.
- Rebuild traceability against 9,579 aggregate gaps, 67 selector gaps and 857
  unmapped tests; report global gain separately from source-local mappings.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

Pending.
