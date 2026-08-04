# Project structure tree stable controls QA

Date: 2026-08-04

## User risk

The project structure tree is the author's persistent navigation and ordering
surface. Its six volume, chapter and scene open/expand/drag declarations have
dynamic accessible names but no static automation metadata. Regression tooling
can therefore miss one entity level or confuse navigation with destructive
reordering while still reporting the broader project journey green.

## Baseline

- `ProjectStructureTree.tsx` contributes six discovered controls, all six
  missing stable selectors.
- Global inventory contains 452 controls and 9,944 derived states.
- Global stable-selector debt is 167 and strict traceability reports 10,708
  aggregate gaps.
- Existing tests cover scene opening, dirty-draft drag protection, filtered
  reordering, persisted moves, toast undo and `Ctrl+Z`, but do not require a
  static handle for every volume/chapter/scene navigation and drag operation.

## Contracts

1. Volume toggle and drag, chapter open and drag, and scene open and drag each
   expose a distinct static test handle.
2. Dynamic author-facing accessible names, expansion state, keyboard drag
   instructions and disabled reasons remain unchanged.
3. A rendered tree assertion identifies all six operations before interacting
   with project persistence.
4. Source missing-selector debt falls from six to zero without hiding or
   merging controls in inventory.
5. Existing open, reorder, failure, undo, search and dirty-draft behavior stays
   green across the projects impact set.
6. Fixed-commit frontend/Rust discovery and convergence ledgers reconcile.

## Execution

- Add inventory and rendered six-operation assertions before production edits.
- Add static metadata only; do not replace visible Chinese copy or dynamic
  accessible feedback.
- Run the tree and structure-move focus set, projects feature impact set, QA
  scripts, fixed-commit frontend/Rust baselines and convergence recording.

## Release posture

This closes a central author navigation and ordering automation boundary.
Product release remains fail-closed until remaining traceability,
real-provider and packaging gates are complete.

## Result

- Two intended contracts failed red: inventory returned all six missing source
  IDs and the rendered tree lacked the volume-toggle handle.
- Source inventory moved from six controls (0 mapped / 6 missing) to 6/6
  mapped. Global controls and states remain truthful at 452 and 9,944 while
  global selector debt falls from 167 to 161.
- The two new contracts increase explicit strict traceability debt from 10,708
  to 10,710. The release gate remains fail-closed rather than hiding the new
  unmapped tests.
- The rendered/inventory focus set passed 2 files / 8 tests. The complete
  projects feature set passed 12 files / 65 tests with no React warnings, and
  QA infrastructure passed 5 files / 18 tests.
- Fixed-commit Node 24 acceptance passed lint, typecheck, production build and
  181 files / 920 tests. Rust collected 79, passed 77 and retained two reasoned
  ignores.
- Product commit: `4ab100b` (`fix: stabilize project structure tree controls`).
