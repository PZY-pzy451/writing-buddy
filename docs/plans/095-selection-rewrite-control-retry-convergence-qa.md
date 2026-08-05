# 095 Selection rewrite control and retry convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `14ca53a1` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 10,086 unmapped items. Test mapping is 156/1,057,
  leaving 901 discovered cases unmapped.
- Control inventory has 482 declarations and 106 missing stable selectors.
- `SelectionRewritePanel.tsx` has five inventoried declarations: two mapped
  and three missing. All seven existing component tests are unmapped.
- Candidate acceptance displays an unexpected snapshot/persistence exception
  verbatim, so a private path can escape into the author-facing alert.

## Failure-first contracts

1. Generate, accept-all and editable-draft controls gain stable identities;
   the source inventory has five mapped declarations and zero selector gaps.
2. One hundred same-frame Generate actions start one provider request. One
   hundred Stop actions issue one cancellation while cancellation is pending.
3. Wrapped valid output reaches one candidate; malformed output remains
   localized and performs zero manuscript or snapshot writes.
4. The draft is keyboard focusable and editable. Acceptance occurs only after
   an explicit author action and stale candidates remain disabled.
5. An unknown snapshot/persistence failure exposes no private path, preserves
   the same candidate and succeeds on explicit retry without regeneration.
6. All seven existing component cases receive conservative control/state
   mappings without adding a new discovered test case.

## Validation

- Run the modified component and inventory contracts red before implementation.
- Run selection rewrite, inline draft, continuation, AI core and QA impact.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit.
- Run Rust tests, rebuild traceability and record movement from 10,086 aggregate
  gaps / 106 selector gaps / 901 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.
