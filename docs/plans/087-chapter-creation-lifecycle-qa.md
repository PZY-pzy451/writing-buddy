# Chapter creation lifecycle QA

Date: 2026-08-04
Branch: `codex/full-regression-gates-a-e-v2`

## User risk

Chapter creation is the next persistence boundary after the global Create menu.
The Store checks `chapterCreateBusy` before awaiting a dirty manuscript save,
but does not reserve the operation until after that save. A same-frame burst can
therefore queue many chapter writes behind one save. The request also retains
the old project snapshot across the save without revalidating project identity.

The rendered dialog has the same asynchronous removal window for Submit and
Dismiss actions. Static inventory collapses six dialog/control declarations
into five controls and leaves two without stable selectors.

## Failure-first contracts

1. One hundred same-frame rendered Submit actions call the chapter creator once.
   A failed attempt releases the dialog guard for one explicit retry.
2. One hundred same-frame Cancel actions dismiss once and restore the exact
   opening focus.
3. One hundred direct Store creation requests behind one dirty save issue one
   native chapter transaction and produce one successful result.
4. Replacing the project while the prerequisite save is pending prevents the
   old chapter transaction and preserves the replacement project.
5. Replacing the project while the native transaction is pending prevents its
   late result from replacing or opening content in the current project.
6. Inventory discovers six distinct source controls with zero missing stable
   selectors.

## Repair boundary

- Reserve Store creation synchronously before any manuscript save or native
  request and release on every terminal outcome.
- Revalidate root, project ID and project revision after the awaited save.
- Give the mounted dialog one mutually exclusive transition guard shared by
  Submit, Cancel, Close, backdrop and Escape; release it only after a failed
  creation remains mounted.
- Add static automation metadata without changing visible copy or semantics.

## Verification

- Red: dialog, Store and inventory suites fail only at the lifecycle contracts.
- Focused green: chapter dialog, chapter Store and inventory suites.
- Impact: global Create, project open/save, writer workspace, structure tree and
  project creation.
- Fixed-commit: Node 24 lint/typecheck/all Vitest/build, Rust tests, QA plan,
  ledger and convergence recording.

## Release boundary

This cycle does not authorize release. Strict traceability, real-provider smoke
and packaged executable acceptance remain independent fail-closed gates.
