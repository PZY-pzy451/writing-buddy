# 114 Inline language and chapter creation selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `f326730d` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,516 unmapped items. Test mapping is 206/1,058,
  leaving 852 discovered cases unmapped.
- Control inventory has 510 declarations and 61 missing stable selectors.
- `InlineLanguageCheckControl.tsx` has an anonymous popover trigger and an
  anonymous enable switch. Its two existing product cases are already mapped,
  but neither anonymous control can be targeted independently.
- `ChapterCreationDialog.tsx` already exposes six stable identities. Its two
  author-facing pressure/focus cases pass but are globally unmapped because the
  tests locate submit and cancel by positional role queries instead of the
  declared control identities.

## Failure-first contracts

1. The inline language popover trigger exposes a stable identity and continues
   to open the explicit, non-writing review flow.
2. The inline language enable switch exposes a distinct stable identity and
   preserves its checked state and setup/recovery semantics.
3. Chapter creation tests address the dialog, title, volume, close, cancel and
   submit controls through their declared stable identities rather than DOM
   order.
4. One hundred same-frame chapter submissions dispatch exactly once; a failed
   creation releases the guard for one explicit retry.
5. One hundred same-frame dismissals close exactly once and restore the exact
   opening focus.
6. Existing cases become strictly traceable without adding controls, states or
   discovered tests.

## Validation

- Extend the existing product cases first and capture the missing inline
  identities as the red baseline, then add only semantic identities.
- Run inline review, chapter creation, project creation and Writer Workspace
  impact tests under Node 24, plus typecheck, zero-warning lint and diff checks.
- Rebuild traceability against 9,516 aggregate gaps, 61 selector gaps and 852
  unmapped tests; report mapped-control/state/test gains separately.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Source `f00835fe` gives the inline language popover trigger and enable switch
  distinct stable identities without changing review or write behavior.
- Chapter creation cases address all six declared controls directly. One
  hundred same-frame submissions create once and release for retry after a
  rejected creation; one hundred dismissals close once and restore focus.
- Two failure-first contracts converged to 4/4 focused and 60/60 inline,
  project-creation and Writer Workspace impact tests. Inventory/trace contracts
  passed 20/20.
- Inline language rises from 2/4 to 4/4 stable identities and from 1/4 to 3/4
  strictly mapped controls. Chapter creation rises from 1/6 to 6/6 strictly
  mapped controls; both existing component cases gain global mappings.
- Sequential fixed-source acceptance passed 189 frontend files / 979 tests,
  production build, 77 native tests with two reasoned ignores and 30/30 QA
  infrastructure tests.
- Global mapped controls rise by 7, states by 57 and tests by 2. Strict gaps
  fall from 9,516 to 9,450, selector gaps from 61 to 59 and unmapped tests from
  852 to 850. Strict coverage is 27.54%, stable-selector coverage is 88.43%,
  test mapping is 19.66% and release hard gates remain 1/4 complete.
