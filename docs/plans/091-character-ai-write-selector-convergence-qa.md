# 091 Character AI write and selector convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `d5143fc` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 10,410 unmapped items.
- Control inventory has 474 declarations and 122 missing stable selectors.
- `CharacterAiPanel.tsx` has seven inventoried declarations: three mapped and
  four missing. The two dynamic write buttons are also collapsed into one
  declaration because neither has a stable identity.
- Generation already has a synchronous guard and provider-error redaction, but
  candidate persistence exposes arbitrary `Error.message` values from snapshot,
  repository and state-store boundaries.

## Failure-first contracts

1. The action tabs, chapter selector, instruction, generation, field checkbox,
   evidence, candidate acceptance and close actions have eight distinct stable
   declaration identities with no selector gap.
2. The existing one-hundred-click generation contract keeps producing one paid
   request after selector instrumentation.
3. A candidate write rejected with a private filesystem path displays only a
   localized author-facing message and leaves the candidate retryable.
4. The explicit retry performs one new snapshot/write attempt and can finish
   without regenerating or losing the selected candidate fields.
5. Inventory generation enforces the exact eight-control set.

## Validation

- Run the modified character experience and inventory contracts red before the
  product implementation.
- Run Character AI review service/page impact and all QA infrastructure tests.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit.
- Run Rust format/tests, rebuild strict traceability and record net movement
  from 10,410 unmapped items / 122 selector gaps.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

Pending implementation and fixed-commit evidence.
