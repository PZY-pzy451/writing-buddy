# AI drawer Context Pack freeze QA

Date: 2026-08-04

## User risk

The generic AI drawer exposes optional Context Pack records. Once generation
starts, the provider request has already captured one exact pack, but the Store
and rendered checkboxes still allow the author to change it. The drawer can then
show a different context from what the AI actually received. Changing context
after a preview also leaves the old candidate actionable even though it was
generated from the previous pack.

## Contracts

1. Optional Context Pack records are immutable during context validation,
   queueing, connection, streaming, output validation and candidate application.
2. One hundred attempted toggles in each active state do not change the request
   pack or its token estimate.
3. Rendered optional checkboxes are disabled while generation is active.
4. Provider output is always validated against the same Context Pack snapshot
   used to build the request.
5. Changing Context Pack after preview invalidates and clears the old output,
   parsed candidate, transaction, usage and terminal job identity.
6. After that explicit change, the author can generate a fresh preview from the
   newly selected context.

## Execution

- Add Store state-matrix, pressure, preview-invalidation and rendered-control
  contracts before changing behavior.
- Make the Store authoritative: ignore active-state toggles and invalidate a
  preview atomically when its context changes.
- Expose a disabled contract on the drawer Context Preview and bind it to the
  existing active-state calculation.
- Run drawer, context, App, AI, session and save impact tests followed by full
  Node 24 and Rust acceptance.
- Keep product status `PARTIAL` while traceability, real-provider smoke and
  packaging gates remain open.

## Result

- Seven initial red instances proved all five generation states mutated the
  Store, the rendered streaming checkbox stayed enabled and a Context Pack
  change left the old preview actionable. A follow-up state audit found the
  rendered applying state was also unlocked.
- Store toggles are now rejected across all request/application states. The
  Context Preview exposes a disabled contract that covers the five generation
  states plus applying without incorrectly enabling Stop for an apply operation.
- Changing optional context after preview atomically clears raw/parsed output,
  preview transaction, usage and terminal job identity, then permits a fresh
  request from the newly selected pack.
- Focused Store/drawer/context suites pass 41/41 and the ten-file impact set
  passes 137/137. Full Node 24 acceptance passes 179 files / 871 tests plus
  lint, typecheck and production build. Rust collects 79, passes 77 and retains
  two reasoned ignores.
- Execution is `PASS`; product remains `PARTIAL` pending traceability,
  real-provider smoke and release-package evidence.
