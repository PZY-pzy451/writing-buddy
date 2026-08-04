# Writer header save and navigation QA

Date: 2026-08-04

## User risk

The writer header is the persistent author boundary for chapter status,
continuation, organization, export, navigation, layout and explicit save. Its
twelve source-level operation declarations currently collapse into five
inventory controls with no stable selector. More importantly, chapter status
acquires its busy lock only after awaiting a dirty-manuscript save. A burst of
status choices can therefore enter the same persistence boundary together and
issue repeated native status writes. The adjacent `整理本章` action always
navigates to extraction after awaiting save, even when the manuscript remains
dirty because the write failed.

## Baseline

- `WriterHeader.tsx` contributes five discovered controls, all five missing
  stable selectors, while exposing twelve source-level author operations.
- Global inventory contains 458 controls and 10,076 derived states.
- Global stable-selector debt is 150 and strict traceability reports 10,828
  aggregate gaps.
- Existing writer-workspace tests cover one successful status update, one
  failed pre-status save and export failure, but not same-frame status pressure,
  failed-save organization navigation or stable handles for the full header.

## Contracts

1. Chapter status trigger/option, more-actions trigger, three continuation
   actions, organization, export, previous/next chapter, density option and
   explicit save expose twelve distinct stable source handles while preserving
   accessible names.
2. One hundred same-frame status choices after a dirty manuscript create one
   manuscript save and one native chapter-status write.
3. The chapter-status busy state is acquired before the first awaited save and
   released on save failure, native failure or success.
4. `整理本章` opens extraction only after a dirty manuscript becomes clean; a
   failed save keeps the author in the current writing view with the draft
   dirty and retryable.
5. Existing continuation, export, chapter navigation, read-only and density
   behavior remains unchanged.
6. Writer workspace, save/export and fixed-commit acceptance suites reconcile
   before convergence is recorded.

## Execution

- Add inventory, stable metadata, pressure and failed-navigation contracts
  before production edits.
- Move the chapter-status guard before dirty-save work and preserve every
  existing localized failure branch.
- Revalidate the current session after `整理本章` attempts a save and stop the
  navigation when persistence is not clean.
- Run focused writer-header tests, workspace/save/export impact tests, QA
  scripts, fixed-commit frontend/Rust baselines and convergence recording.

## Release posture

This closes a persistent top-level author navigation and status-write boundary.
Product release remains fail-closed until remaining traceability,
real-provider and packaging gates are complete.

## Result

- Four intended contracts failed red: inventory could not distinguish twelve
  operations; stable metadata was absent; 100 dirty status choices issued 100
  native writes; and a failed save still navigated away from the editor.
- The header now exposes 12/12 stable source controls. Chapter status acquires
  its store-owned lock before awaiting save, so one hundred choices produce one
  manuscript write and one native status write. `整理本章` revalidates project,
  resource, session dirty state and save state before navigation.
- Global controls moved from 458 to 461 and states from 10,076 to 10,142 while
  selector debt fell from 150 to 145. Newly explicit controls, states and tests
  raise honest strict traceability debt from 10,828 to 10,901.
- Focused regression passed 2 files / 34 tests. App, save, export and publish
  impact passed 8 files / 95 tests. Ten existing workspace React warnings and
  one adjacent close-protection warning were eliminated; the final impact run
  emitted no stderr. QA infrastructure passed 5 files / 21 tests.
- Fixed-commit Node 24 acceptance passed lint, typecheck, production build and
  183 files / 934 tests. Rust collected 79, passed 77 and retained two reasoned
  ignores.
- Product commit: `5b1417f` (`fix: harden writer header transitions`).
