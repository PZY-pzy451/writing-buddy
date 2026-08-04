# Save retry lifecycle QA

Date: 2026-08-04

## User risk

An author can press Save or Retry repeatedly before the UI renders its busy
state. The store must treat those calls as one intent. If the native write
fails, callers waiting on that same write must not become hidden automatic
retries. Otherwise one failed click burst can produce many write attempts,
misleading recovery state and unnecessary disk/provider pressure.

## Contracts

1. One hundred same-tick save calls produce one native write when that write
   fails, including non-retryable failures.
2. A failed operation keeps the manuscript dirty and exposes its truthful
   recovery state; it never retries without a new author action.
3. A later explicit retry starts exactly one new write and can return the
   document to clean.
4. If the author edits while a successful write is in flight and presses Save,
   all duplicate calls coalesce into at most one follow-up write for the newer
   content.
5. The same waiting rule applies while an explicit force-save is active.

## Execution

- Add red store integration tests for retryable and non-retryable failure
  pressure, explicit recovery and successful queued edits.
- Repair the store-owned single-flight/queue boundary without relying on React
  render timing.
- Run the focused save suite, the writer-session/workspace impact set, frontend
  acceptance and the complete regression inventory.
- Record machine evidence and keep release/product status truthful when real
  provider, packaging or strict traceability gates are not run.

## Result

- Red baseline: retryable and non-retryable 100-call bursts each performed 100
  native writes; a same-ID late receipt changed another project's disk baseline.
- Repaired focused suite: 38/38; ten-file impact set: 93/93.
- Full frontend: 178 files / 829 tests, lint, typecheck and production build.
- Native: 79 collected, 77 passed and two ignored with existing reasons.
- Ledger: 908 cases, 906 passes and two reasoned skips.
- Execution: `PASS`. Product/release: `PARTIAL` / blocked by 10,069 traceability
  gaps, 221 missing stable selectors, unrun real-provider smoke and packaging.
