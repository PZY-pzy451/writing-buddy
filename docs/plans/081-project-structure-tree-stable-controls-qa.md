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
