# 098 Entity Peek control and keyboard convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `3b07931` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,841 unmapped items. Test mapping is 169/1,057,
  leaving 888 discovered cases unmapped.
- Control inventory has 485 declarations and 98 missing stable selectors.
- `EntityPeekCard.tsx` has five interactive declarations. The dialog, generated
  overlap candidates and generated manuscript backlinks have no stable
  selector; both existing component tests are unmapped.
- The overlap chooser declares listbox/option semantics but ArrowUp, ArrowDown,
  Home and End do not move focus between candidates.

## Failure-first contracts

1. All five Entity Peek declarations retain stable identities; dialog,
   candidates and backlinks use collection-level test IDs.
2. Opening the card focuses the dialog. Root Enter opens full details and
   Escape closes without requiring pointer input.
3. Overlapping references require explicit author choice. Pointer works, and
   ArrowUp/ArrowDown/Home/End move option focus before native Enter selection.
4. Expanding backlinks and selecting one invokes the exact manuscript jump.
5. Both existing component tests gain conservative mappings without adding a
   discovered test case.

## Validation

- Extend the existing component and QA inventory contracts and run them red
  before implementation.
- Run Entity Peek, mention/highlight, manuscript and QA infrastructure impact
  tests after repair.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit; run the Rust acceptance suite.
- Rebuild traceability and record movement from 9,841 aggregate gaps, 98
  selector gaps and 888 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Red baseline failed 3/17 assertions: the dialog and generated candidate
  selectors were absent, and strict inventory still reported unmapped Entity
  Peek declarations.
- Added stable identities to the dialog, generated overlap candidates and
  generated backlinks. All 5/5 controls and both existing component cases are
  strictly mapped.
- Added ArrowUp, ArrowDown, Home and End candidate focus movement. Pointer and
  native Enter selection, initial dialog focus, root Enter, Escape and exact
  backlink jumps are verified.
- Focused execution passed 17/17; the manuscript impact set passed 38/38; QA
  infrastructure passed 29/29.
- Fixed source `509151b` passed Node 24 lint, typecheck, 188 frontend files / 978
  tests and production build. Rust passed 77/79 with two reasoned environment
  skips.
- Strict gaps moved 9,841 -> 9,804, selector gaps 98 -> 95 and unmapped tests
  888 -> 886. Product remains `PARTIAL`; hard release gates remain 1/4.
