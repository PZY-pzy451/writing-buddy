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
