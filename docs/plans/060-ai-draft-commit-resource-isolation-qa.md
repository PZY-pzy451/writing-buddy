# AI draft commit resource-isolation QA

Date: 2026-08-04

## User risk

An AI temporary draft is generated for one exact manuscript. Project copies can
share a project ID, chapter ID, path, revision and content. If the author changes
project or chapter while save, snapshot or final persistence is pending, the old
candidate must never remain actionable, edit the new session or roll old content
back into the new project.

## Contracts

1. Candidate identity includes project root, project ID, resource ID, path and
   Monaco model URI in addition to revision and anchored content.
2. Same-ID/same-content chapters in another project root are stale.
3. Same-project resources with a changed path or model are stale.
4. Save and snapshot completion revalidate the exact candidate identity and the
   currently mounted Monaco model before executing edits.
5. A failed commit rolls back store content only while the original project,
   resource, path and model remain active.
6. Repeated Apply actions remain single-flight and failures leave the candidate
   visible and retryable.

## Execution

- Add a behavior-preserving identity API refactor, then record cross-project,
  path and model collision failures against the old predicate.
- Use the repaired predicate at candidate visibility and every asynchronous
  commit boundary.
- Run candidate/card/editor/save/session impact tests, complete Node 24
  acceptance and Rust acceptance.
- Keep product status `PARTIAL` while strict traceability, real-provider and
  packaging gates remain open.

## Result

- Four red identity cases reproduced project-root, project-ID, resource-path and
  Monaco-model collisions.
- The repaired focused suite passed 11/11 and the ten-file impact set passed
  98/98.
- Node 24 acceptance passed 179 files / 842 tests with lint, typecheck and the
  production build. Rust collected 79 tests, passed 77 and retained two reasoned
  ignores.
- Runtime and static discovery reconcile at 842 / 842. The aggregate ledger is
  921 cases with 919 passes and two reasoned skips.
- Product source is `711b35d`; strict product status remains `PARTIAL` because
  traceability, real-provider smoke and packaging remain open.
