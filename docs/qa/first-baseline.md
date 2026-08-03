# Gates A-E first baseline

- Date: 2026-08-03
- Source: `12cd45e`
- Overall status: `PARTIAL`
- Foundation status: `PASS`
Strict traceability: `REGRESSION_INCOMPLETE`

This is the first baseline for the regression foundation only. It is not a full
release regression result. Gate F, real DeepSeek, browser release journeys,
packaging and broad product repair are outside this round.

## Inventory and traceability

| Measure | Inventory | Mapped | Gap |
| --- | ---: | ---: | ---: |
| Domains | 12 | 12 | 0 |
| Features | 151 | 13 | 138 |
| Pages | 24 | 13 | 11 |
| Workspaces | 5 | 5 inventoried | mapping assessed through pages |
| Controls | 430 | 66 | 364 |
| Control states | 9,460 | 421 | 9,039 |
| Shortcuts | 23 | 18 | 5 |
| Native actions | 55 | 1 | 54 |
| Static test IDs | 746 | 82 control-state mapped | 664 |

The aggregate hierarchy gap is 10,275. There are no `NOT_APPLICABLE` rows yet;
no blank item has been hidden as N/A. The control scanner also reports 223
declarations without a stable semantic selector. Strict validation exits 1 as
required.

Runtime collection found 716 Vitest cases and 79 Rust cases, while the static
inventory contains 667 frontend plus 79 Rust IDs. The 49 additional Vitest
cases are an explicit static-discovery gap, not silently counted as mapped.

## Actual execution

- Supported Node 24.14.0: ESLint, TypeScript, 171 Vitest files / 716 tests and
  the production Vite build passed with zero engine warnings.
- Rust 1.97.1: formatting passed; Cargo collected 79 tests, passed 77 and
  ignored two explicitly scoped external performance/recovery cases.
- Deterministic fixtures: 24 AI scenarios and eight project scenarios passed
  focused isolation/reset/failure contracts; no real provider call occurred.
- Runtime executed passes: 793. Reasoned scoped skips: 2. Runtime failures: 0
  in the accepted baseline.

The first orchestrated attempt failed on one trailing blank line and a Cargo
101. The blank line was fixed. Cargo then passed standalone and in the complete
rerun; the 101 did not reproduce. The generic orchestrator also resolved nested
pnpm to unsupported Node 25, so its frontend result is diagnostic only. The
Node-24-pinned acceptance is the primary frontend evidence.

## Dependency and cache state

- Dependency graph: 732 nodes / 1,259 static-import edges.
- Initial plan before execution: 746 forced reruns, zero cache hits.
- Current same-commit FAST plan: 744 `CACHED_PASS`, two
  `SKIPPED_WITH_REASON`, zero `STALE`, zero forced reruns.
- Every case fingerprints source, transitive dependencies, fixtures, mock
  provider, schemas, environment, build configuration, test implementation and
  expected behavior.

## Known warnings and stop line

- Monaco's production chunk remains above 3,000 kB; optimization is outside
  Gates A-E.
- The static test parser must be extended to close the 49-case runtime gap.
- Semantic selectors and explicit regression IDs are the largest traceability
  debt; the conservative mapper intentionally refuses to infer coverage from
  file proximity alone.

Stop here. Do not claim full regression or release readiness and do not start
Gate F without new direction.
