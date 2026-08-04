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

## Result

- Red run: 6/20 focused contracts failed for missing selector metadata,
  missing selector-aware mapping and Event Inspector lifecycle gaps.
- Green run: focused 20/20, timeline 15/15 and QA infrastructure 26/26.
- Event Inspector source controls moved from 6 (2 mapped / 4 missing) to 7/7
  mapped; 100 save or close actions now dispatch once and failed saves remain
  visible and retryable.
- Stable-selector debt fell from 134 to 130. Traceability debt fell from 11,108
  to 10,489 even after adding one control, 22 states and six discovered tests.
- Fixed-commit acceptance passed 186 frontend files / 958 tests, production
  build, and Rust 77 passes with two reasoned ignores.
- Release remains blocked at 1/4 complete gates: strict traceability is 13.64%
  complete in aggregate, and real-provider plus package acceptance have not run.
