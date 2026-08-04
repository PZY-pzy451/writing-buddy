# Global create menu lifecycle QA

Date: 2026-08-04
Branch: `codex/full-regression-gates-a-e-v2`

## User risk

The global Create menu is the zero-to-project and project-to-content entry
point. React removal of the menu is asynchronous, so the same rendered item can
receive many same-frame activations before it unmounts. The menu also records a
new shortcut focus origin every time the open event fires, including while the
menu is already open, which can replace the real origin with a menu item that
will immediately unmount on close.

Static inventory collapses seven trigger, menu and action declarations into six
controls and leaves four without stable selectors.

## Failure-first contracts

1. One hundred same-frame Open Project actions dispatch exactly one project
   chooser request. Reopening the menu permits exactly one new request.
2. Repeating the shortcut-open event one hundred times while the menu is open
   preserves the original external focus origin. Escape restores that origin.
3. A repeated shortcut may move focus to the requested Chapter item without
   replacing the original focus origin.
4. Inventory discovers seven distinct source controls and reports zero missing
   stable selectors.
5. Arrow, Home and End navigation continue to wrap across enabled menu items;
   disabled project-only actions remain unavailable without an open writable
   project.

## Repair boundary

- Add a component-owned synchronous action guard that remains locked until the
  menu is explicitly opened again.
- Track open state synchronously so shortcut bursts do not recapture focus.
- When already open, honor the new requested focus directly without reopening
  or mutating the saved origin.
- Add static test IDs without changing role, accessible name or visible copy.

## Verification

- Red: menu and inventory suites fail only for repeated dispatch, focus origin
  and stable control contracts.
- Focused green: Global Create menu, global create request and inventory suites.
- Impact: project creation/open, chapter creation, quick capture, top bar,
  workspace shortcuts and app navigation.
- Fixed-commit: Node 24 lint/typecheck/all Vitest/build, Rust format/tests, QA
  plan, ledger and convergence recording.

## Release boundary

This cycle improves a core entry point but does not authorize release. Strict
traceability, real-provider smoke and packaged executable acceptance remain
independent fail-closed gates.

## Result

- Red reproduced four independent failures: 100 chooser dispatches, lost
  shortcut origin, ignored already-open chapter focus and incomplete control
  metadata.
- A synchronous open/action boundary now permits one transition per explicit
  menu opening. Reopen bursts retain the original external focus, while a new
  focus request can move within the already-open menu.
- Keyboard navigation wraps only across enabled actions. The seven source
  controls are now 7/7 mapped; global selector debt falls from 140 to 136.
- Focused regression passed 18/18, the adjacent creation/open/chapter/quick
  capture/workspace path passed 73/73 and QA infrastructure passed 25/25.
- Fixed-commit acceptance passed 183 frontend files / 946 tests, production
  build and Rust 77 passes with two reasoned ignores.
