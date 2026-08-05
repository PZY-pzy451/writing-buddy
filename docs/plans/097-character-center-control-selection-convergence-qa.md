# 097 Character center control and selection convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `33310b9` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,960 unmapped items. Test mapping is 166/1,057,
  leaving 891 discovered cases unmapped.
- Control inventory has 485 declarations and 101 missing stable selectors.
- `CharacterCenterPage.tsx` has six interactive declarations. Its generated
  role filters, virtualized character rows and generated detail tabs have no
  stable selector; three of nine existing component tests are unmapped.
- Reselecting the already active character while its form is dirty opens a
  discard confirmation even though the author did not request navigation.

## Failure-first contracts

1. All six Character Center declarations retain distinct stable identities;
   role filters, character rows and detail tabs use collection-level test IDs.
2. The role filter collection is exposed as a named accessibility group.
3. Reselecting the active character is a no-op: it preserves the dirty draft
   and does not ask the author to discard it.
4. Selecting another character still requires explicit discard confirmation
   and preserves the original draft when the author refuses.
5. The persisted-revision, provider-retry and candidate-write-retry tests map
   to truthful repeat, restart and enabled-state dimensions without adding a
   discovered test case.

## Validation

- Extend the existing Character Center and QA inventory contracts and run them
  red before implementation.
- Run Character Center, Character Editor, Character AI and QA infrastructure
  tests after repair.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit; run the Rust acceptance suite.
- Rebuild traceability and record movement from 9,960 aggregate gaps, 101
  selector gaps and 891 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

Pending.
