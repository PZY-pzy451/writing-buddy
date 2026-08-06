# 132 AI diagnostics orphan-control trace QA

Date: 2026-08-06

## Goal

Convert four real but completely unmapped AI diagnostic controls into stable,
behavior-backed release evidence without inflating coverage through title-only
tests:

- open AI settings from an unconfigured playground;
- reveal and reliably re-hide the DeepSeek API key;
- clear a completed or output-limited playground result;
- reject an AI drawer preview without applying or writing it.

Inventory regeneration after separating the clear action may reveal structurally
identical controls that were previously collapsed by the static identity hash.
Any such control must be retained, assigned its own business identity and tested;
it must not be removed merely to preserve the old denominator. This applies to
the newly separated copy action and the start/stop generation pair.

## Baseline

- Inventory: 523 controls, 11,506 control states and 1,064 tests.
- Strict coverage: 5,029 / 13,346 (37.68%).
- Unmapped: 126 controls, 7,204 states and 792 tests; 8,317 total strict gaps.
- Stable selectors: 523 / 523, but all four targets still use localized visible
  text as their selector value.
- Each target is currently 0 / 22 state rows mapped, for 88 target gaps.
- Release gates: 1 / 4; release remains blocked by strict traceability,
  real-provider smoke and packaged-EXE acceptance.

## Failure-first contracts

1. Add rendered tests that require a fixed type selector and exact action identity
   for every target control; run them before the product attributes exist.
2. Exercise pointer and keyboard activation, focus transitions, visible/hidden and
   enabled/disabled states, and repeat actions where the control can be invoked.
3. Pressure 100 rapid clear/reject/reveal or navigation actions and assert a
   deterministic terminal state with no duplicate write or leaked secret.
4. Extend the existing output-limit case so it clears partial output while
   retaining the author prompt, converting an already-unmapped runtime case into
   traceable evidence.

## Implementation boundaries

- Add stable `data-testid` values and exact `data-ai-action` identity only.
- Keep accessible names unchanged for users and assistive technology.
- Do not persist, log or expose the API key outside the controlled press window.
- Rejecting a candidate must only mark the preview transaction rejected; it must
  never invoke an apply/write path.
- Clearing a terminal result must preserve the prompt and must stay unavailable
  while generation is active.

## Verification and evidence

1. Run the focused rendered contracts, then repeat them in pressure rounds.
2. Regenerate inventory and traceability; require zero selector gaps and measure
   actual net mapped controls, states and tests.
3. Run the fixed Node 24 acceptance gate, Rust gate and QA-infrastructure tests.
4. Record convergence against the product commit, update canonical progress and
   daily memory, then commit generated evidence separately.
