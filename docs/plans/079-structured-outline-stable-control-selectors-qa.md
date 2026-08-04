# Structured outline stable control selectors QA

Date: 2026-08-04

## User risk

The structured outline workspace is the author-facing bridge between a generated
story direction and writable chapters/scenes. Its dynamic tree, cards, inspector,
quality checks, hierarchy preview and AI field-diff review currently contain nine
inventory declarations without stable automation metadata. Several distinct
actions also share structural hashes, which can hide untested controls from the
release ledger.

## Baseline

- `StructuredOutlineWorkspace.tsx` contributes 15 discovered controls: six
  mapped and nine missing stable selectors.
- Global inventory contains 424 controls and 9,328 derived states.
- Global stable-selector debt is 182 and strict traceability reports 10,161
  aggregate gaps.
- Existing author tests cover editing, locking, reordering, split previews,
  atomic materialization, local/AI checks and partial AI adoption, but they do
  not verify static automation handles.

## Contracts

1. Every interactive declaration in the structured outline source exposes a
   static `data-testid`, `name`, `id` or literal accessible name.
2. Dynamic author-facing labels remain intact for tree nodes, cards, lock state,
   candidate fields and progress actions.
3. Repeated controls receive semantic group handles; different actions are not
   collapsed merely to reduce inventory counts.
4. Rendered QA proves stable handles across the toolbar, root fields, tree,
   cards, ordering and node inspector.
5. Source missing-selector debt falls from nine to zero. Any newly distinguished
   declarations and states are reported honestly.
6. Existing editing, hierarchy, AI-review, quality and atomic-write behavior
   remains unchanged under focused and full regression.

## Execution

- Add inventory and rendered UI assertions before production changes.
- Annotate all intrinsic interactive declarations, including conditional and
  repeated controls, without changing visible copy or interaction behavior.
- Regenerate inventory and compare source/global control and state counts.
- Run focused outline tests, the Creation Journey impact set, QA scripts,
  frontend/Rust fixed-commit baselines and convergence recording.

## Release posture

This closes another P0 zero-to-draft automation boundary. Product release
remains fail-closed until remaining traceability, real-provider and packaging
gates are complete.

## Result

- Two intended contracts failed red: the source inventory returned all nine
  missing IDs and the author-facing workspace lacked the first toolbar handle.
- Toolbar, root/node fields, tree, cards, ordering, local/AI quality checks,
  hierarchy preview/materialization and AI field-diff review now expose stable
  semantic test handles while retaining dynamic Chinese accessible names.
- Source inventory moves from 15 controls (6 mapped / 9 missing) to 35/35
  mapped. Twenty real declarations previously collapsed by structural hashes
  are now represented independently.
- Global selector debt falls from 182 to 173. Controls rise from 424 to 444 and
  states from 9,328 to 9,768; two new contracts raise honest aggregate
  traceability debt from 10,161 to 10,568 until those states are mapped.
- Focused outline regression passed 3 files / 10 tests. Creation Journey passed
  19 files / 65 tests and QA infrastructure passed 5 files / 16 tests.
- Fixed-commit Node 24 acceptance passed lint, typecheck, 181 files / 916 tests
  and the production build. Rust collected 79, passed 77 and retained two
  reasoned ignores.
- Product commit: `fcd63dd` (`fix: stabilize structured outline controls`).
