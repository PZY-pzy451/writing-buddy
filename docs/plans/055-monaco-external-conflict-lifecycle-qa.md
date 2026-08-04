# Monaco external-conflict lifecycle QA

## Objective

Protect the author's active manuscript when disk verification, explicit
overwrite, resource switching and conflict-dialog actions overlap. Close the
highest-risk behavioral boundaries of P0 feature `FEATURE-01-03` without
weakening atomic-write or external-change detection.

## Red contracts

1. One hundred same-tick disk-verification triggers perform one read and expose
   at most one conflict for the active chapter.
2. A delayed verification result from an old chapter cannot replace or attach a
   conflict to the author's newer chapter selection.
3. A delayed pre-save disk read cannot reopen a stale conflict after a newer
   successful save on the same chapter.
4. One hundred explicit-overwrite actions perform one native write; failure
   releases the action for a later explicit retry.
5. Text entered while overwrite is in flight remains dirty and a second
   explicit overwrite writes the latest payload after the first completes.
6. Cancelling or failing `另存为` keeps the conflict dialog and both versions
   available; only a successful copy may dismiss it.

## Repair boundaries

- Keep disk verification single-flight per active resource, with at most one
  latest-resource follow-up.
- Validate project, resource, path and baseline disk hash after every async read
  before applying conflict, reload or offline state.
- Make force overwrite single-flight while retaining latest-edit queueing and
  retry after failure.
- Do not infer that a cancelled save-copy resolved the original conflict.
- Preserve current atomic write requests, dirty tracking and localized errors.

## Verification

- Focused red/green store and dialog suites.
- Impacted save, project-open, workspace and editor tests.
- Node 24 lint, typecheck, complete Vitest run and production build.
- Cargo regression baseline and machine-readable inventory/ledger convergence.
- Live browser check of conflict-dialog truthfulness where the fixture exposes a
  safe external-change setup; otherwise record the deterministic boundary and
  do not add a hidden production backdoor.

## Release conclusion

Execution may be `PASS` when all selected checks pass. Product/release remains
`PARTIAL` while strict control/state traceability, real-provider smoke and
release packaging remain incomplete.

## Result

- The red baseline failed 8 of 35 focused tests: five store lifecycle contracts
  and three conflict-dialog truthfulness contracts.
- The repaired focused run passed 35/35; the six-file impact run passed 70/70.
- Node 24 acceptance passed 176 files / 815 tests, lint, typecheck and production
  build. Cargo collected 79 tests, passed 77 and retained two reasoned ignores.
- In-app browser control was attempted only after the deterministic UI contracts.
  Its runtime failed during initialization before any page operation, so the
  live conflict journey is recorded as blocked test infrastructure rather than
  as a product pass. No hidden conflict-production hook was introduced.
