# 133 AI settings provider-action selector and trace QA

Date: 2026-08-06

## Goal

Give every author-visible AI provider action an explicit, locale-independent
business identity and convert the existing pressure/failure contracts into
isolated rendered control evidence:

- save and validate the API key;
- test the configured provider connection;
- request, confirm or cancel credential removal;
- refresh the provider model list;
- refresh the provider balance.

## Baseline

- Inventory: 526 controls, 11,572 control states and 1,085 tests.
- Strict coverage: 5,151 / 13,436 (38.34%).
- Unmapped: 122 controls, 7,177 states and 791 tests; 8,285 total strict gaps.
- Stable-selector gate: 526 / 526, but the static inventory sees only the
  localized cancel and balance buttons from the seven provider actions. Save,
  connection test, removal request, removal confirmation and model refresh are
  structurally collapsed instead of independently inventoried.
- Six existing pressure/failure tests for save, connection, model refresh,
  balance refresh and credential deletion are globally unmapped because they
  call the store directly from one broad test source.
- Release gates: 1 / 4; strict traceability, real-provider smoke and packaged
  EXE acceptance remain open.

## Failure-first contracts

1. Require a fixed `data-testid` and exact `data-ai-action` value for every
   provider action before adding those attributes to the product.
2. Drive the actions through rendered pointer/keyboard controls, not direct
   store calls, while preserving the existing 100-action single-flight checks.
3. Verify visible/enabled/disabled/loading/success/failure/retry states and make
   credential removal remain an explicit two-step destructive action.
4. Keep API keys out of React stores, local storage, logs and generated evidence.

## Implementation boundaries

- Accessible names and user-facing Chinese copy remain unchanged.
- Do not weaken, delete or title-only rewrite an existing behavior assertion.
- Move equivalent existing tests into isolated files so strict traceability
  cannot associate one broad source with unrelated controls.
- Provider calls remain deterministic fixtures; no real credential or network
  request is allowed in this incremental batch.

## Verification and evidence

1. Run red contracts before product identities exist, then the focused settings
   contracts and repeated pressure rounds after implementation.
2. Run the whole AI feature domain, fixed Node 24 acceptance and QA-script tests.
3. Regenerate inventory, traceability and dependency evidence; report denominator
   growth honestly and require missing stable selectors to stay at zero.
4. Record convergence against the product commit, update `docs/progress.md` and
   `docs/memory/2026-08-06.md`, then commit evidence separately.

## Outcome

- Product source: `3ae6b89d`; seven provider actions have exact identities and
  the AI Settings inventory gate requires all 12 independently rendered controls.
- Focused settings: 8 files / 28 tests; pressure: 10 rounds / 280 cases; AI domain:
  21 files / 147 tests. Fixed Node 24 acceptance: 211 files / 1,013 tests plus
  lint, typecheck and production build. QA: 30/30. Rust: 77 passed / 2 reasoned
  ignores.
- Inventory: 531 controls / 11,682 states / 1,092 tests. Mapped: 409 controls /
  4,503 states / 309 tests. Unmapped: 122 / 7,179 / 783. Stable selectors:
  531/531. Total strict gaps: 8,279; strict coverage: 5,279/13,558 (38.94%).
- Execution is `PASS`, product is `PARTIAL`, and release remains `BLOCKED` until
  strict traceability, real-provider smoke and packaged-EXE acceptance close.
