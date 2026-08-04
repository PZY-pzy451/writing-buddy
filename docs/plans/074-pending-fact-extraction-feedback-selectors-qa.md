# Pending fact extraction feedback and stable controls QA

Date: 2026-08-04

## User risk

The pending-fact extraction action has a synchronous reentrancy guard, but the
button remains visibly enabled until the provider reports its first lifecycle
event. Preference lookup, provider validation or a slow request start can
therefore look like a missed click and encourage repeated actions. The same
panel has four source declarations without stable selector metadata, weakening
regression coverage for the exact workflow that previously exposed
`invalidStoryExtractionInput`.

## Contracts

1. The first click immediately disables the extraction action and publishes a
   busy accessible name before the provider emits any state event.
2. One hundred clicks during a held preflight still start exactly one
   extraction request and the action remains visibly busy.
3. Completion or failure releases the visible busy state and preserves the
   existing localized, retryable outcome.
4. Extraction, pending-fact title, statement and narrative-order declarations
   retain their author-facing labels while exposing stable static metadata.
5. The source-specific missing selector count falls from four to zero, and the
   global count falls exactly from 216 to 212 without changing extraction or
   confirmation persistence semantics.

## Execution

- Add the rendered preflight and selector contracts before production changes.
- Hold the extraction Promise open so the test observes the interval before any
  AI lifecycle callback.
- Keep the ref guard as the synchronous authority and add rendered busy state
  for author feedback.
- Run panel/service/parser and Story Kernel confirmation impact tests, inventory,
  then fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Two rendered contracts failed red. A held preflight Promise left the extract
  button enabled with its idle name, and all three fact-editing declarations
  lacked their planned stable names.
- Extraction now publishes a rendered busy state synchronously with the ref
  guard. One hundred clicks during provider preflight start one request, show
  `正在提取 · 0 字符` and keep the action disabled until completion or failure.
- Extraction, title, statement and narrative-order controls now expose static
  selector metadata without replacing their author-facing labels.
- The source now has five mapped controls and zero unmapped controls. Global
  missing stable selectors fell exactly from 216 to 212; control and derived
  state counts remain 424 and 9,328.
- Focused panel regression: 1 file / 6 tests passed.
- Panel/service/parser impact regression: 3 files / 43 tests passed, including
  invalid-input localization, malformed-response quarantine, single-flight
  extraction and author-confirmed persistence.
- The first fixed-commit baseline correctly stopped at typecheck because the
  held preflight fixture inferred `Promise<unknown>`. Commit `b25fe6a` made the
  test contract explicitly `Promise<string>`; the repeated typecheck passed.
- Final fixed-commit Node 24 acceptance passed lint, typecheck, production build
  and 180 files / 906 tests. Rust collected 79 tests, passed 77, failed zero and
  retained two reasoned ignores.
- Execution is `PASS`. Product status remains `PARTIAL` because strict
  traceability has 10,154 open mappings, 212 declarations still lack stable
  selectors, and real-provider smoke plus release packaging remain unrun.
