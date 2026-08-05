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

- Product source `cd20623` adds the stable shared selector and restores the
  exact pointer-down size when Escape cancels an active drag. Pointer capture
  and the global resize cursor are released, and later movement from the
  cancelled pointer is ignored.
- Pointer/inverse/vertical clamping, Arrow/Shift/Home/End/Enter, double-click
  reset and non-primary rejection remain covered. All four component tests are
  strictly mapped; one QA regression test was added.
- The QA audit found that `tab` matched inside `stable`, creating 89 historical
  false-positive keyboard-state mappings. English keyboard tokens now require
  word boundaries, while Chinese keyboard intent remains supported.
- Five initial failures converged to 24/24 focused, 73/73 impacted and 30/30
  QA infrastructure tests. Fixed-source acceptance passed 188 frontend files /
  979 tests, production build and 77 Rust tests with two reasoned ignores.
- Selector gaps fell from 92 to 91. On the corrected baseline, strict gaps fell
  by 12 from 9,875 to 9,863; the former published 9,786 value is not comparable
  because it included the 89 false state mappings.
- Product remains `PARTIAL`; strict traceability, real-provider smoke and
  packaged-EXE acceptance are still open release gates.
