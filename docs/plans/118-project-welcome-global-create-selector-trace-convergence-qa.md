# 118 Project Welcome and Global Create selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `cb40359` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,126 unmapped items. Test mapping is 221/1,058,
  leaving 837 discovered cases unmapped.
- Control inventory has 510 declarations and 52 missing stable selectors.
- `ProjectWelcome.tsx` has 3 inventoried declarations, 1 stable identity, 1
  strictly mapped control and 17/66 mapped states. Its repeated secondary start
  routes and repeated recent-project cards are anonymous.
- `GlobalCreateMenu.tsx` has 7 stable declarations, 5 strictly mapped controls
  and 59/154 mapped states. Four of its eight exact product cases remain
  unmapped despite exercising visible menu relocation, repeated chooser
  deduplication, contextual local routing and accessible planning priorities.

## Failure-first contracts

1. Outline, manuscript and blank welcome routes share one stable composite
   identity plus an exact route value.
2. Recent project cards share one stable identity plus the exact project root.
3. Existing welcome cases drive both identities without adding a discovered
   test or changing author-visible labels.
4. Moving an already-open shortcut menu makes the requested chapter action
   visible and focused, then restores the original focus on Escape.
5. One hundred repeated Open Project actions issue one chooser request, close
   the menu and allow one later explicit retry.
6. Contextual creation routes locally to the author assistant without starting
   a paid AI generation request.
7. Planning mode exposes the prioritized structure and plot actions with
   stable accessible names.
8. No control, state or test is added solely to improve percentages.

## Validation

- Extend existing welcome cases first and capture the two absent identities as
  the red baseline; add only semantic identity/context attributes.
- Strengthen the four existing Global Create titles and assertions with the
  unique visible, repeat/deduplication, offline and accessibility states they
  already prove; do not loosen traceability matching.
- Run project creation/open/menu, quick capture, chapter creation and Writer
  Workspace impact tests under Node 24, plus typecheck, zero-warning lint and
  diff checks.
- Rebuild traceability against 9,126 aggregate gaps, 52 selector gaps and 837
  unmapped tests; report mapped-control/state/test gains separately.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source: `9d7e5f0`.
- Two failure-first assertions reproduced the anonymous recent-project and
  repeated start-route controls. The corrected focused set passed 20/20 cases;
  the wider product impact set passed 96/96 and QA contracts passed 20/20.
- Project Welcome expands honestly from 3 controls / 66 states to 4 controls /
  88 states because previously collapsed start/open declarations are now
  distinct. All 4 controls are stable and mapped; mapped states rise from 17
  to 68.
- Global Create remains 7/7 stable and 5/7 control-mapped. All 8 exact product
  cases now map; mapped states rise from 59 to 74 through explicit visible,
  repeat/deduplication, offline and accessible-name contracts.
- Global inventory becomes 511 controls / 11,242 states / 1,058 tests. Mapped
  controls rise by 3, states by 66 and tests by 4; strict gaps fall by 50 to
  9,076, selector gaps by 2 to 50 and unmapped tests by 4 to 833.
- Fixed-source sequential gates passed 189 frontend files / 979 tests plus
  production build, 77 Rust tests with two reasoned ignores, and 30/30 QA
  infrastructure tests. Runtime and static frontend inventories both equal
  979.
- Strict coverage is 3,988/13,064 (30.53%), selector coverage is 461/511
  (90.22%) and test mapping is 225/1,058 (21.27%). Release remains 1/4 hard
  gates complete pending strict traceability, real-provider smoke and packaged
  EXE acceptance.
