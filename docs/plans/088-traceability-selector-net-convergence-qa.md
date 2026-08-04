# 088 Traceability selector net-convergence QA

## Objective

Reduce both open QA debts from the accepted baseline instead of expanding inventory without executable coverage:

- traceability `totalUnmapped`: 11,108;
- controls missing a stable selector: 134.

## Failure contracts

1. A control whose only stable selector is `data-testid` must retain the exact selector value in inventory and may map only to a same-page, same-feature test source that references that exact value and whose test title expresses the state intent.
2. Every interactive declaration in `EventInspector` must have a distinct stable selector.
3. One render of `EventInspector` may dispatch at most one save or close transition in the same frame, including 100-click pressure.
4. A rejected save must release the local guard so the author can retry without reopening the inspector.
5. Inventory and traceability regeneration must finish with both accepted debts lower than 11,108 and 134.

## Execution order

1. Add red QA-infrastructure and `EventInspector` lifecycle tests.
2. Persist exact stable-selector values and permit conservative exact selector references in traceability.
3. Add distinct event-inspector selectors and synchronous transition guards.
4. Run focused tests, timeline impact tests, QA orchestration tests, lint and typecheck.
5. Regenerate QA artifacts, prove net debt reduction, then run the supported frontend baseline and update release evidence.

## Release interpretation

This slice improves Gate C traceability and selector completeness. It does not claim Gate C complete while any strict mapping remains, and it does not substitute for real-provider or packaged-EXE acceptance.
