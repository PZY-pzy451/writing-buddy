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
  save-copy deduplication, but only one is strictly mapped.

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

Pending execution.
