# 100 Resize Handle control and cancel convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `073aee9` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,786 unmapped items. Test mapping is 172/1,057,
  leaving 885 discovered cases unmapped.
- Control inventory has 486 declarations and 92 missing stable selectors.
- `ResizeHandle.tsx` has one shared separator declaration without a stable
  collection identity. All four existing pointer/keyboard component tests are
  unmapped even though the control is used by the project sidebar, writing
  assistant and task dock.
- Pointer capture can be started and completed, but pressing Escape during an
  accidental drag neither cancels capture nor restores the starting size.

## Failure-first contracts

1. Every rendered resize separator exposes the shared stable identity
   `workspace-resize-handle` while retaining its instance-specific label.
2. Pointer capture, inverse horizontal/vertical layout and clamped values stay
   covered.
3. Escape during an active drag restores the exact starting value, clears the
   global resize cursor and ignores further movement from the cancelled drag.
4. Arrow steps, Shift acceleration, Home/End, Enter reset, double-click reset
   and non-primary pointer rejection stay covered.
5. All four existing component tests gain conservative mappings; one QA meta
   test guards against treating the `tab` substring in `stable` as keyboard
   intent.

## Validation

- Extend the four existing component cases and QA inventory contract, then run
  them red before implementation.
- Run shell/workspace resize and relevant component impact tests after repair.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit; run Rust acceptance and QA infrastructure tests.
- Rebuild traceability and record movement from 9,786 aggregate gaps, 92
  selector gaps and 885 unmapped tests.
- Rebase the aggregate after removing any historical false-positive keyboard
  mappings exposed by the stricter token-boundary rule; never report those as
  genuine coverage.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

Pending.
