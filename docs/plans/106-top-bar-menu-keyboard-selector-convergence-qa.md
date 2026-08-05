# 106 Top bar menu keyboard and selector convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `ba05034` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,787 unmapped items. Test mapping is 187/1,058,
  leaving 871 discovered cases unmapped.
- Control inventory has 498 declarations and 83 missing stable selectors.
- `TopBar.tsx` is collapsed to six declarations. Four lack stable identities,
  while mutually exclusive global, quiet-writer, planning and focus actions
  are not individually addressable.
- The existing global search/settings journey is unmapped. The native details
  menu does not focus its first item, support menu arrow/Home/End navigation,
  close on Escape with focus restoration, or dismiss on an outside action.

## Failure-first contracts

1. Every top-bar action has a distinct stable identity across global,
   quiet-writer, planning/reference and focus variants.
2. Opening More moves focus to the first enabled menu item.
3. ArrowUp/ArrowDown wrap; Home/End reach the first/last item.
4. Escape closes More and restores exact trigger focus.
5. An outside pointer action dismisses More without activating a menu item.
6. Existing search, save, focus, sidebar, assistant, AI, quick-capture,
   settings and layout actions retain their accessible Chinese names.
7. The existing global-shell journey gains a strict mapping without adding a
   discovered test case.

## Validation

- Extend the existing global-shell and inventory cases, run them red, then
  implement the smallest menu-focus and stable-control boundary.
- Run writer workspace and shell impact tests under Node 24, plus typecheck and
  zero-warning lint.
- Run frontend, Rust and QA infrastructure gates sequentially from a fixed
  product commit.
- Rebuild traceability and report inventory expansion separately from mapping
  progress against 9,787 aggregate gaps, 83 selector gaps and 871 unmapped
  tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Fixed product source: `db69fd0`.
- Global, quiet-writer, planning/reference and focus variants expose 16 stable
  identities. Strictly mapped source controls rise from 2/6 to 16/16 and source
  mapped states rise from 32/132 to 265/352.
- More focuses its first enabled item, supports wrapping arrows and Home/End,
  restores trigger focus on Escape, and dismisses on an outside pointer action.
- Five red failures converged to 5/5 focused/inventory tests, 51/51 Writer
  Workspace and shell impact tests, and 30/30 QA infrastructure tests. Fixed-
  source sequential acceptance passed 189 frontend files / 979 tests,
  production build and 77 native tests with two reasoned ignores.
- Honest inventory expansion adds 10 controls and 220 states. Global mapped
  controls rise by 14 and mapped states by 235. Strict gaps fall by 20 from
  9,787 to 9,767, selector gaps fall from 83 to 79 and unmapped tests fall from
  871 to 870.
- Deterministic execution is 100%; strict coverage is 3,228/12,995 (24.84%),
  stable selectors are 429/508 (84.45%) and test mapping is 188/1,058 (17.77%).
  Release gates remain 1/4 complete (25%), so release stays blocked by strict
  traceability, real-provider smoke and packaged-EXE acceptance.
