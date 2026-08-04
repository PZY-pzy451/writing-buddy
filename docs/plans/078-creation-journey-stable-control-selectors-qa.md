# Creation Journey stable control selectors QA

Date: 2026-08-04

## User risk

The zero-to-draft Creation Journey is the main first-use and promotional path,
but its page has the largest remaining source-specific selector debt. Fourteen
inventory controls lack stable metadata across stage navigation, author
guidance, idea editing, direction selection, outline ordering and chapter
confirmation. Dynamic labels remain useful to authors, but they do not give QA
a static handle for repeated cards, changing lock states or drag targets.

## Baseline

- The page contributes 14 of 196 missing stable selectors.
- Global inventory contains 408 controls and 8,976 derived states.
- Strict traceability reports 9,792 aggregate gaps.
- The complete user journey is already covered, but it does not assert stable
  automation metadata at each generated stage.

## Contracts

1. Every interactive declaration in `CreationJourneyPage.tsx` exposes a static
   `data-testid`, `name`, `id` or literal accessible name.
2. Repeated stage/card fields use semantic group names; distinct fields never
   share a misleading selector solely to reduce inventory counts.
3. Dynamic author-facing labels, keyboard names, lock state and drag behavior
   remain unchanged.
4. The existing ideas-to-three-chapters journey asserts stable controls in the
   ideas, direction, outline and chapter stages.
5. Source missing-selector debt falls from 14 to zero and global debt from 196
   to 182; any newly distinguished controls remain fully mapped.
6. Fixed-commit frontend/Rust discovery and convergence ledgers reconcile.

## Execution

- Add inventory and rendered journey assertions before production changes.
- Add semantic static metadata to all currently collapsed/missing declarations.
- Regenerate inventory and inspect control/state changes rather than assuming a
  lower raw count is more accurate.
- Run the Creation Journey impact set, QA scripts, fixed-commit frontend/Rust
  baselines and convergence recording.

## Release posture

This closes one P0 first-use automation boundary. Product release remains
blocked until genuine traceability, real-provider and packaging gates close.

## Result

- Two intended contracts failed red: inventory returned all 14 missing control
  IDs and the full user journey could not find a stage-navigation anchor.
- Stage navigation, guidance, idea fields, direction cards, outline drag targets
  and chapter fields now expose stable semantic group names or test IDs without
  changing their dynamic author-facing labels.
- The page moves from 22 controls (8 mapped / 14 missing) to 38 controls, all
  mapped. The 16-control increase is intentional: distinct fields and actions
  that previously shared one structural hash are now represented separately.
- Global selector debt falls from 196 to 182. Controls rise from 408 to 424 and
  states from 8,976 to 9,328; with one new test, honest traceability debt rises
  from 9,792 to 10,161 because the newly visible controls/states still require
  explicit behavior mappings.
- A brittle assertion that assumed three outline nodes was replaced by a card/
  field consistency invariant. The impact run also exposed an unwrapped Store
  reset in test cleanup; wrapping it in `act` removes the React stderr warning.
- Creation Journey impact regression passed 19 files / 64 tests. QA-script
  regression passed 17/17. Fixed-commit acceptance passed lint, typecheck,
  production build and 181 files / 914 frontend tests. Rust collected 79,
  passed 77 and retained two reasoned ignores.
- Product commit: `bf0069bb181e7b2a16e8ba5fdbc9268fa51efe72`.
