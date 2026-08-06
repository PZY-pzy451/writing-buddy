# 136 Task Dock control, filter and trace QA

Date: 2026-08-06

## Goal

Converge the author-facing Task Dock across issue filters, tabs, review actions,
Quick Capture disposition and close behavior. Every repeated control must expose
its concrete tab, filter, issue or capture identity without relying on localized
copy or array position.

## Baseline

- Global inventory: 538 controls / 11,836 states / 1,096 tests.
- Global mapped: 444 controls / 5,333 states / 322 tests.
- Global unmapped: 94 controls / 6,503 states / 774 tests; 7,566 strict gaps.
- Stable selectors: 538/538, but Task Dock exposes only 8 collapsed controls.
- Task Dock: 8 controls / 176 states; 1 control / 19 states mapped.
- The visible `严重与警告` and `已忽略` buttons do not change the issue list.
- The existing Quick Capture inbox journey is assigned to the global shell and
  remains unmapped even though it exercises Task Dock disposition.

## User risks

1. Authors cannot filter a long review list despite visible filter controls.
2. Automation cannot distinguish repeated tabs, filters or capture actions by
   their instance identity.
3. Accept, ignore and restore actions can regress without direct rendered tests.
4. Busy Quick Capture operations must disable every competing action.
5. Closing the dock must remain keyboard accessible and preserve author state.
6. Read-only projects must reject issue and inbox mutations while keeping
   filtering, navigation, source jumps and closing available.

## Execution

1. Add failure-first inventory and rendered contracts for the exact Task Dock
   selector/context set.
2. Implement functional issue filtering and stable control identities.
3. Exercise issue lifecycle, keyboard/focus, disabled/busy and Quick Capture
   actions from the user surface.
4. Enforce read-only permission in both the rendered controls and the store
   boundary, then prove all Task Dock controls have an explicit permission path.
5. Reassign the existing inbox journey to Review ownership and run pressure.
6. Run fixed Node 24 and Rust gates, regenerate trace evidence, update canonical
   progress and commit product plus evidence separately.

## Release rule

This batch may reduce strict gaps while release remains blocked. No release claim
is allowed until strict traceability, real-provider smoke and packaged-EXE
acceptance all pass.

## Outcome

- Completed against source `718ddfb`; all 12 Task Dock controls have stable
  selectors and all 264 generated control states are strictly mapped.
- Fixed inert issue filters, same-frame duplicate acceptance, and read-only
  mutation exposure in both the rendered controls and Store status boundary.
- Focused journeys passed 16/16, QA scripts 31/31 and ten pressure rounds passed
  50/50 cases, including 1,000 repeated accept events.
- Fixed Node 24 acceptance passed 211 files / 1,022 tests plus lint, typecheck and
  build. Rust passed 77 with two reasoned ignores.
- Global strict gaps fell from 7,566 to 7,395 and strict coverage reached
  6,425/13,820 (46.49%). Release remains blocked at 1/4 hard gates.
