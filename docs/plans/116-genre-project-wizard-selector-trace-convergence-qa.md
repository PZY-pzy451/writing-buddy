# 116 Genre start and project wizard selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `7b5d3dec` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,395 unmapped items. Test mapping is 212/1,058,
  leaving 846 discovered cases unmapped.
- Control inventory has 510 declarations and 57 missing stable selectors.
- `GenreToOutlineStart.tsx` has 10 inventoried declarations, 8 stable
  identities, 5 strictly mapped controls and 47/220 mapped states. Its More
  control and composite scale/tone option declaration are anonymous.
- `ProjectCreationWizard.tsx` has 20 stable declarations, 16 strictly mapped
  controls and 128/440 mapped states. Only 5 of its 12 exact product cases map;
  existing cases already prove repeated-submit deduplication, complete-project
  persistence, enabled start routes and truthful Word-import disclosure.

## Failure-first contracts

1. The genre More control exposes one stable identity and preserves its exact
   expanded/collapsed state.
2. Scale and tone choices expose one composite stable identity plus exact kind
   and value context without collapsing the author-visible option names.
3. One hundred same-tick final submissions remain deduplicated, create once and
   hide the completed wizard.
4. The five-step manuscript journey persists imported content, appearance and
   the newly opened first chapter.
5. Genre remains the selected default while the other truthful start routes
   remain enabled.
6. Word-outline preview visually discloses format limitations before import.
7. Existing cases become strictly traceable without adding discovered tests.

## Validation

- Extend existing genre cases first and capture the two absent stable
  identities as the red baseline, then add only semantic identity/context.
- Strengthen existing wizard assertions and titles with the exact state each
  case already proves; do not loosen traceability matching.
- Run creation journey, project wizard, global create and Writer Workspace
  impact tests under Node 24, plus typecheck, zero-warning lint and diff checks.
- Rebuild traceability against 9,395 aggregate gaps, 57 selector gaps and 846
  unmapped tests; report mapped-control/state/test gains separately.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.
