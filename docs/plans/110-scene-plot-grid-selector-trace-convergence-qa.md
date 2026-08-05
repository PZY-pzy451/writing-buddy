# 110 Scene Plot Grid and virtual timeline selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `d09e32a` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,636 unmapped items. Test mapping is 194/1,058,
  leaving 864 discovered cases unmapped.
- Control inventory has 510 declarations and 74 missing stable selectors.
- `ScenePlotGrid.tsx` has five controls and 110 states. Only Clear Filter has
  a stable accessible name; search, filter, scene and plot-link declarations
  have no stable identity. No source control/state is strictly mapped.
- The existing Plot Board user journey already opens the real grid, follows a
  scene/plot link and locates manuscript evidence. It should be extended rather
  than replaced with synthetic test count.
- `VirtualTimelineList.tsx` has one anonymous repeated event control. Its two
  existing UI tests are both unmapped even though they verify a bounded 10,000-
  event window and accessible Arrow navigation. This is the adjacent no-new-
  test-count opportunity to produce net test-mapping gain.

## Failure-first contracts

1. Search, repeated filter buttons, repeated scene buttons and repeated
   plot-link buttons expose four distinct stable identities.
2. Repeated controls retain explicit filter/scene/thread context without
   creating duplicate inventory declarations.
3. The existing user journey exercises visible/enabled accessible controls,
   keyboard search/filtering, pointer link selection and keyboard scene opening.
4. Clearing an empty search restores the grid without mutating Story Kernel
   resources.
5. The existing product case becomes strictly mapped without increasing the
   discovered test count.
6. The repeated virtual-timeline event control exposes one stable identity,
   while its event ID remains explicit; both existing UI cases become mapped.

## Validation

- Extend the existing Plot Board product case and inventory contract, run them
  red, then add the smallest semantic identities and contextual attributes.
- Run Plot Board, Scene Plot Grid model and related story navigation impact
  tests under Node 24, plus typecheck, zero-warning lint and diff validation.
- Rebuild inventory and traceability against 9,636 aggregate gaps, 74 selector
  gaps and 864 unmapped tests; report inventory expansion separately from real
  mapping gain.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

Pending execution.
