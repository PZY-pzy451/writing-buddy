# Story Kernel persisted candidate recovery

Status: complete

## Goal

Polish the structural-default repair so pending candidates saved by an older
Writing Buddy build can become confirmable after upgrade without another paid
AI request.

## Contract

- Reuse one exported, deterministic neutral-field normalizer for new AI output
  and persisted candidate recovery.
- Recover only pending `create` candidates whose raw resource becomes fully
  valid after neutral defaults are applied.
- Rebuild system-owned timestamps, revision and evidence IDs locally; never
  ask AI or invent author content, IDs, positions or references.
- Remove only the exact structural-schema conflict produced by the old failed
  hydration. Preserve target, collision, evidence, dependency and other schema
  conflicts.
- Wrong explicit types and semantically incomplete resources remain blocked.
- Do not mutate project Story resources during load. The existing snapshot and
  explicit confirmation remain mandatory before any Story Kernel write.

## Verification

- Persist an old-style item candidate missing `unique` and `restrictions`,
  reopen the generation store, and prove it is normalized and confirmable.
- Confirm the recovered candidate and verify one snapshot-backed atomic write
  path remains available to the UI.
- Persist an explicitly malformed item and prove it remains blocked.
- Run focused tests, full acceptance, Rust gates, Tauri Release/NSIS and
  production portable smoke.

## Delivery

- Update acceptance evidence, progress and memory.
- Refresh Windows artifacts and hashes.
- Commit the recovery implementation and regressions.

## Outcome

- Exported and reused the deterministic structural-default normalizer.
- Recovered valid historical pending `create` candidates locally without an
  AI request while preserving the author confirmation boundary.
- Kept explicit malformed types and unrelated conflicts strictly blocked.
- Passed focused, full web, Rust, Tauri packaging and production native smoke
  gates; refreshed the portable and NSIS delivery with SHA-256 metadata.
