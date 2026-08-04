# QA inventory composite-control boundary

Date: 2026-08-04

## User risk

The control inventory treats every JSX tag with an event-like prop as a
rendered control. This incorrectly inventories React component boundaries such
as `DndContext`, `ContextPackPreview`, `ResizeHandle` and `TextField`, even
though their rendered DOM controls are already discovered inside the component
implementation. The duplicates inflate selector and state debt and make the
release-readiness percentage misleading.

## Baseline

- 16 PascalCase composite declarations are recorded as controls.
- All 16 are reported as missing stable selectors.
- Those declarations create 352 synthetic state rows.
- Current inventory reports 424 controls, 9,328 states, 212 missing selectors
  and 10,159 aggregate traceability gaps.

## Contracts

1. Control inventory contains only intrinsic rendered JSX elements, never
   PascalCase React component boundaries.
2. Native controls and lowercase intrinsic elements with interaction handlers
   remain inventoried.
3. Removing composite duplicates does not change frontend or Rust test
   discovery.
4. Inventory, traceability and dependency reports reconcile after regeneration.
5. The strict gate remains fail-closed for the genuine remaining selector and
   mapping gaps.

## Execution

- Add an integration contract that regenerates inventory and rejects every
  PascalCase control type.
- Restrict custom-interaction discovery to intrinsic JSX tags.
- Regenerate the full QA plan and record the exact debt reduction.
- Run QA-script tests, fixed-commit frontend/Rust baselines and convergence
  recording.

## Release posture

This repairs measurement accuracy; it does not by itself authorize release.
Real-provider, packaging and remaining strict traceability gates stay open.

## Result

Pending fixed-commit baselines and convergence recording.
