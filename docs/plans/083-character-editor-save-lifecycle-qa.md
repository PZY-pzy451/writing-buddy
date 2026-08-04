# Character editor save lifecycle QA

Date: 2026-08-04

## User risk

Characters are one of the most frequently generated and manually corrected
Story Kernel resources. The editor exposes eleven author operations, while the
control inventory currently collapses them into five declarations with no
stable selector. Its submit path relies on React's delayed `saving` prop, so a
same-frame click burst can multiply writes. A failed persistence attempt is
also converted into a page-level raw error and resolved to the editor as if it
succeeded, which removes the editable dossier, clears dirty state and prevents
an in-place retry. After a successful save, the editor remains mounted with the
old resource revision and can issue a stale second write.

## Baseline

- `CharacterEditor.tsx` contributes five discovered controls, all five missing
  stable selectors, despite eleven distinct form operations.
- Global inventory contains 454 controls and 9,988 derived states.
- Global stable-selector debt is 155 and strict traceability reports 10,749
  aggregate gaps.
- Existing character tests cover a normal single save but not same-frame
  pressure, failed-save recovery, redaction or a second save.

## Contracts

1. Form, title, role, pronouns, occupation, summary, goals, desires, fears,
   speech style and save each expose a distinct stable handle and accessible
   name.
2. One hundred same-frame form submissions start exactly one persistence call.
3. A failed save keeps the editor and draft visible, keeps the resource dirty,
   shows localized/redacted feedback and releases one explicit retry.
4. Dirty state clears only after persistence succeeds.
5. A subsequent edit submits the repository-returned revision instead of the
   stale pre-save revision.
6. Character, Story Kernel, inventory and fixed-commit acceptance suites must
   reconcile before convergence is recorded.

## Execution

- Add inventory, rendered metadata, pressure, failure/retry and consecutive-
  save tests before production edits.
- Add static control metadata and a synchronous editor-owned submit guard.
- Keep save failures local to the editable dossier, preserve dirty state and
  remount the draft when the persisted resource revision changes.
- Run focused character tests, Story Kernel impact tests, QA scripts,
  fixed-commit frontend/Rust baselines and convergence recording.

## Release posture

This closes a high-frequency Story Kernel character correction boundary.
Product release remains fail-closed until remaining traceability,
real-provider and packaging gates are complete.
