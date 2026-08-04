# AI drawer stale-context isolation QA

Date: 2026-08-04

## User risk

The global AI quick-action drawer can outlive a chapter or project switch. A
copied project may have the same project ID, resource ID and revision. If the
drawer validates only the revision, old context and delayed stream output can
appear in the replacement project and remain available for review or retry.

## Contracts

1. Drawer source identity includes project root, project ID, resource ID,
   resource path, Monaco model URI and revision.
2. A preview becomes stale when any source-identity field changes, including a
   same-revision project switch.
3. A validating or streaming request becomes stale on source change, receives
   at most one cancellation request and ignores every delayed event.
4. A stale drawer cannot start another request from its old context. Opening a
   fresh action is the explicit retry boundary.
5. Repeated stale notifications remain idempotent and never cancel or mutate a
   newer job.

## Execution

- First introduce the structured identity API while preserving revision-only
  behavior, then record the cross-project/path/model and in-flight failures.
- Repair stale detection and cancellation in the store; wire the application
  to every source-identity scalar so equal revisions cannot suppress the check.
- Run store, drawer, app, session, save and AI impact tests followed by complete
  Node 24 and Rust acceptance.
- Keep product status `PARTIAL` while traceability, real-provider smoke and
  packaging gates remain open.
