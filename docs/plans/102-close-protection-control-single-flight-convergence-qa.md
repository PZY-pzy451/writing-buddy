# 102 Close protection control and single-flight convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `5ed03d4` on `codex/full-regression-gates-a-e-v2`.
- Corrected strict traceability has 9,857 unmapped items. Test mapping is
  182/1,058, leaving 876 discovered cases unmapped.
- Control inventory has 489 declarations and 90 missing stable selectors.
- `CloseProtectionDialog.tsx` renders six distinct author actions, but the
  inventory collapses them into three declarations because five actions have
  no stable identity. One collapsed declaration is missing a selector.
- The three existing rendered tests cover cancel/discard, in-flight save and
  save-copy deduplication, but none maps strictly to the rendered close-
  protection control declarations.

## Failure-first contracts

1. Dialog, icon cancel, continue writing, resolve conflict, save copy,
   discard and save-and-exit paths expose distinct stable identities without
   changing their accessible names.
2. Continue writing and icon cancel never exit; discard remains an explicit
   destructive action and exits once.
3. An in-flight save disables save-and-exit, then exits exactly once when the
   store becomes clean.
4. One hundred same-frame save-and-exit actions perform one atomic manuscript
   write and exit once; one hundred save-copy actions continue to open one
   native save-copy dialog and exit once.
5. The resolve-conflict path closes the protection dialog without discarding
   or exiting, so the author can return to conflict resolution.
6. All logical controls and all three existing product cases gain conservative
   mappings without adding discovered test debt.

## Validation

- Extend existing component and inventory cases, run them red, then add the
  smallest stable-control and safety changes required.
- Run close-protection, save-store, app-shell and writing-workspace impact
  tests under Node 24, plus typecheck and zero-warning lint.
- Run all frontend tests, production build, Rust acceptance and QA
  infrastructure from a fixed product commit.
- Rebuild traceability and record net movement from 9,857 aggregate gaps, 90
  selector gaps and 876 unmapped tests. Report any honest inventory expansion
  separately from mapping progress.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source `0627c1f` gives all six author actions distinct stable
  identities while preserving their Chinese accessible names. The dialog root
  also has a stable identity for user-journey automation.
- Cancel, continue writing and resolve-conflict dismiss without exit. Explicit
  discard exits once. One hundred same-frame save-and-exit clicks perform one
  atomic manuscript write and exit once; one hundred save-copy clicks retain
  the existing one-native-dialog/one-exit guarantee.
- Four failure-first assertions converged to 18/18 focused tests, 79/79 save,
  app, workspace and conflict impact tests, and 30/30 QA infrastructure tests.
- Fixed-source Node 24 acceptance passed lint, typecheck, 188 frontend files /
  979 tests and production build. Rust collected 79, passed 77 and retained
  two reasoned ignores.
- The inventory honestly expands from 3 collapsed declarations to 6 controls
  and adds 66 states. All 6 controls, 91 source states and all 3 existing
  product cases are now strictly mapped without adding a test.
- Global mapped states rise by 96. Aggregate gaps fall by 35 from 9,857 to
  9,822, selector gaps fall from 90 to 89 and unmapped tests fall from 876 to
  874. Product remains `PARTIAL`; strict traceability, real-provider smoke and
  packaged-EXE acceptance remain open release gates.
