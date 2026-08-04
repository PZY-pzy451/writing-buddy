# Project creation wizard stable controls QA

Date: 2026-08-04

## User risk

The new-project wizard is the first persistence boundary in a from-zero author
journey. Six discovered controls lack stable automation metadata and multiple
step, template, start-route, appearance and submit actions are collapsed into
shared structural declarations. A test may therefore pass one visible option
while silently omitting another control that creates or imports a project.

## Baseline

- `ProjectCreationWizard.tsx` contributes 12 discovered controls: six mapped
  and six missing stable selectors.
- Global inventory contains 444 controls and 9,768 derived states.
- Global stable-selector debt is 173 and strict traceability reports 10,568
  aggregate gaps.
- Existing integration tests cover validation, imports, dirty-draft protection,
  keyboard navigation, one hundred same-tick submissions, atomic failure and
  explicit retry, but they do not verify static handles across all five steps.

## Contracts

1. Every form, field, selector, option, disclosure and action in the project
   wizard exposes a static semantic test handle or literal accessible name.
2. Repeated step/template/start/resource/theme/accent/mode controls remain
   individually understandable through their existing author-facing names.
3. A rendered author test traverses all five steps and verifies stable handles
   at each stage before any project is written.
4. Source missing-selector debt falls from six to zero; newly distinguished
   declarations and states remain visible in strict traceability.
5. Existing single-flight browse/import/create, dirty-draft confirmation,
   import safety and retry behavior remains unchanged.
6. Fixed-commit frontend/Rust discovery and convergence ledgers reconcile.

## Execution

- Add inventory and five-step rendered assertions before production changes.
- Annotate every intrinsic control without replacing visible Chinese copy or
  dynamic progress feedback.
- Run the wizard suite, project creation/open/save impact set, QA scripts,
  fixed-commit frontend/Rust baselines and convergence recording.

## Release posture

This closes a P0 first-use and persistence automation boundary. Product release
remains fail-closed until remaining traceability, real-provider and packaging
gates are complete.

## Result

- Two intended contracts failed red: the rendered five-step form lacked its
  stable root handle and inventory reported all six missing source selectors.
- Source inventory moved from 12 controls (6 mapped / 6 missing) to 20/20
  mapped. Eight previously collapsed declarations are now independently
  visible; global controls moved from 444 to 452 and states from 9,768 to 9,944.
- Global selector debt fell from 173 to 167. One new rendered contract and the
  newly exposed controls/states raised honest strict traceability debt from
  10,568 to 10,708; the fail-closed release gate remains intact.
- The rendered and inventory focus set passed 2 files / 16 tests. The complete
  projects feature set passed 12 files / 64 tests, and wrapping the mounted
  Zustand reset in `act` removed six React cleanup warnings.
- QA infrastructure passed 5 files / 17 tests. Fixed-commit Node 24 acceptance
  passed lint, typecheck, production build and 181 files / 918 tests. Rust
  collected 79, passed 77 and retained two reasoned ignores.
- Product commit: `e2b36d8` (`fix: stabilize project creation controls`).
