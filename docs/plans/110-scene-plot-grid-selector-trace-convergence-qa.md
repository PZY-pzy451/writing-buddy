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

- Source `468d6b9` gives Scene Plot Grid search, filter, scene and plot-link
  declarations four stable identities plus explicit filter/scene/thread/health
  context. Virtual timeline event buttons expose `timeline-list-event` while
  retaining their exact event IDs.
- Six product-contract failures reproduced the missing identities and the focus
  loss after Clear Filter. The repaired clear action returns focus to search;
  filtering remains display-only and does not mutate Story Kernel resources.
- Focused and inventory tests passed 20/20. Plot and timeline impact passed
  23/23. Sequential fixed-source acceptance passed 189 frontend files / 979
  tests, production build, 77 native tests with two reasoned ignores and 30/30
  QA infrastructure tests.
- All 5 Scene Plot Grid controls, 25 of 110 states and 3 existing product cases
  map. The virtual timeline control, 3 of 22 states and both existing product
  cases map. No controls, states or tests were added to inventory.
- Global mapped controls rise by 7, states by 33 and tests by 2. Strict gaps
  fall from 9,636 to 9,594, selector gaps from 74 to 69 and unmapped tests from
  864 to 862.
- Strict coverage is 26.43%, stable-selector coverage is 86.47%, test mapping
  is 18.53% and release hard gates remain 1/4 complete.
