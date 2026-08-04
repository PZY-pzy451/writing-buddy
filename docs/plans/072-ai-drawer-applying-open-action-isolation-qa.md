# AI drawer applying open-action isolation QA

Date: 2026-08-04

## User risk

Closing an applying AI drawer is protected, but a direct registered-action
launch still replaces the complete drawer state. Any current or future launcher
that reaches the public Store action while a candidate write is in progress can
lose the only visible transaction evidence while the underlying write may
continue. The existing modal shortcut boundary already blocks `Alt+A`; it is a
required green control rather than part of the reproduced defect.

## Contracts

1. One hundred direct `openAiAction()` calls while applying preserve the entire
   existing action, source, Context Pack, parsed result and transaction.
2. One hundred real `Alt+A` shortcut events through `App` preserve the same
   applying transaction and rendered drawer at the existing modal boundary.
3. No replacement action starts a provider request or cancellation.
4. Normal open/reopen behavior remains available in every non-applying state.
5. Explicit internal `reset()` remains the application teardown authority.

## Execution

- Add Store pressure and rendered keyboard-path contracts before production
  changes.
- Guard `openAiAction()` synchronously at the Store boundary so shortcuts,
  menus and direct action launchers share one rule.
- Run Store/drawer/App/shortcut/session/save/error impact tests, followed by
  fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- One Store contract failed red: 100 replacement launches changed the source
  from chapter 1 to chapter 2, reset applying to idle and erased parsed output
  plus the transaction.
- The real `Alt+A` pressure path passed before the production change because the
  modal shortcut boundary already blocks workspace commands. It remains a green
  control covering 100 keyboard actions.
- `openAiAction()` now rejects applying state synchronously before incrementing
  generation identity, cancelling work or rebuilding any action context.
- The applying snapshot survives 100 direct replacement attempts with one
  original provider request and zero cancellation commands. Existing normal
  reopen, cancellation and explicit teardown behavior remains available.
- Focused Store/App regression: 2 files / 75 tests passed.
- Expanded impact regression: 10 files / 174 tests passed.
