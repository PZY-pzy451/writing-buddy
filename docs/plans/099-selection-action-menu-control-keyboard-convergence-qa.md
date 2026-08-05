# 099 Selection Action Menu control and keyboard convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `6b5ef6a` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,804 unmapped items. Test mapping is 171/1,057,
  leaving 886 discovered cases unmapped.
- Control inventory has 485 declarations and 95 missing stable selectors.
- `SelectionActionMenu.tsx` has six interactive declarations. The existing
  resource-link action, AI disclosure and generated resource actions have no
  stable selector; only one of two existing component tests is mapped.
- The contextual action popover declares menu/menuitem semantics, but opening
  it leaves focus on the disclosure and ArrowUp, ArrowDown, Home and End do not
  move focus between menu items.

## Failure-first contracts

1. All Selection Action Menu declarations retain stable identities; the
   resource-link action, AI disclosure and generated resource actions use
   durable collection-level IDs.
2. Opening the contextual AI menu moves focus to its first item.
3. ArrowUp/ArrowDown wrap through menu items; Home and End move to the first
   and last items; Escape closes and restores focus to the disclosure.
4. Pointer actions still route dialogue rewrite, five resource types, Quick
   Capture and existing-resource linking into their existing workflows.
5. Known link failures stay localized and do not expose internal identifiers.
6. Both existing component tests gain conservative mappings without adding a
   discovered test case.

## Validation

- Extend existing component and QA inventory contracts and run them red before
  implementation.
- Run Selection Action Menu and manuscript/editor impact tests after repair.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit; run Rust acceptance and QA infrastructure tests.
- Rebuild traceability and record movement from 9,804 aggregate gaps, 95
  selector gaps and 886 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Initial red execution failed 3/17 assertions: the disclosure and link action
  selectors were absent and strict inventory still reported unmapped controls.
- Stable identities now distinguish seven logical controls and map all seven,
  including generated rewrite and resource action collections. Both existing
  component tests are mapped without adding a case.
- Opening the role=menu popover focuses its first item. ArrowUp/ArrowDown wrap,
  Home/End move to boundaries and Escape closes and restores disclosure focus.
- Focused execution passed 17/17; the manuscript/editor impact set passed
  50/50; QA infrastructure passed 29/29.
- Fixed source `60078b1` passed Node 24 lint, typecheck, 188 frontend files / 978
  tests and production build. Rust passed 77/79 with two reasoned environment
  skips.
- Inventory grew from 485 controls / 10,670 states to 486 / 10,692 by exposing
  one formerly collapsed control. Net strict gaps still moved 9,804 -> 9,786,
  selector gaps 95 -> 92 and unmapped tests 886 -> 885. Product remains
  `PARTIAL`; hard release gates remain 1/4.
