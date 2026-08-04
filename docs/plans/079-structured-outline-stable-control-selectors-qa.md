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
