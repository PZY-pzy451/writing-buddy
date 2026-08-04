# Story Kernel stable control selectors QA

Date: 2026-08-04

## User risk

The Story Kernel candidate workflow already exposes useful dynamic labels, but
five source declarations have no static selector in the QA inventory. Automated
regression, keyboard/accessibility audits and failure reproduction cannot
reliably distinguish instruction, resource type, generate/cancel, candidate
selection and structure-inspection controls on the screen most responsible for
schema quarantine and snapshot confirmation.

## Contracts

1. Instruction and resource-type controls retain their author-facing labels and
   expose stable static selector metadata.
2. Generate and cancel remain distinct controls in both idle and streaming
   states.
3. Candidate selection keeps its title-specific accessible name while exposing
   a stable grouped form name.
4. Structure expansion keeps its `查看结构` / `收起结构` state label while
   exposing one stable automation selector.
5. The source-specific missing selector count falls from five to zero, and the
   global count falls exactly from 221 to 216 without changing write behavior.

## Execution

- Add rendered semantic contracts before source changes and retain existing
  generation/cancellation/candidate-write pressure tests.
- Add static `aria-label`, `name` or `data-testid` attributes according to each
  control's user semantics; do not replace dynamic accessible names.
- Run Story Kernel panel/service/mutation/error impact tests, inventory, then
  fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until the remaining
strict traceability, real-provider smoke and packaging gates are closed.

## Result

- Two rendered contracts failed red: the instruction/generation/candidate
  workflow lacked its planned stable metadata, and the live cancel button had no
  selector distinct from Generate.
- Instruction, resource types, Generate, Cancel, candidate selection and
  structure expansion now expose static selector metadata without replacing
  their author-facing accessible names.
- The Story Kernel source now has 9 mapped controls and zero unmapped controls.
  Global missing stable selectors fell exactly from 221 to 216. Generate and
  Cancel are now separately inventoried, so controls rose from 423 to 424 and
  derived states from 9,306 to 9,328.
- Focused panel regression: 1 file / 22 tests passed.
- Schema/service/diagnostic/fixture impact regression: 5 files / 93 tests
  passed, including malformed candidate quarantine and atomic confirmation.
- Fixed-commit Node 24 acceptance passed lint, typecheck, production build and
  180 files / 904 tests. Rust collected 79 tests, passed 77, failed zero and
  retained two reasoned ignores.
- Execution is `PASS`. Product status remains `PARTIAL` because strict
  traceability still has 10,152 open mappings, 216 declarations still lack
  stable selectors, and real-provider smoke plus release packaging remain
  unrun.
