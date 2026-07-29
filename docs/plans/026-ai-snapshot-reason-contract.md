# AI snapshot reason contract repair

Updated: 2026-07-29

## Problem

AI Story Kernel, character, item, worldbuilding, relationship, timeline, plot,
scene-plan, extraction, and preview-apply flows pass feature-specific strings
such as `ai-character-review` as the snapshot `reason`. The native snapshot
command and `@writing-buddy/version` accept only the canonical
`SnapshotReason` values, so the command rejects the request with
`invalidSnapshotReason` before any candidate can be confirmed.

The candidate is still pending and its Story Kernel structure has not reached
the write transaction; the raw native error makes this look like a generated
data-structure failure.

## Repair contract

- All AI confirmation flows use the canonical
  `beforeDestructiveOperation` reason.
- The human-readable snapshot label retains the feature and candidate context,
  such as `AI 人物 · 林越` or `AI Story Kernel 生成前`.
- `DesktopBridge.createSnapshot` accepts `SnapshotReason`, not arbitrary
  strings, so future invalid call sites fail TypeScript validation before
  reaching Rust.
- The Rust allowlist and version manifest schema remain unchanged. Ad-hoc AI
  values must not be added as a second reason taxonomy.
- The snapshot must finish before the Story Kernel write begins. A snapshot
  failure leaves candidates pending and performs no resource write.
- The direct Story Kernel panel translates a native snapshot-reason mismatch
  into a clear author-facing recovery message and states that the candidate
  has not been written.

## Acceptance

- Direct character generation calls snapshot with
  `beforeDestructiveOperation`, then commits the valid character candidate.
- Character and every other AI review entry use the same canonical reason.
- A rejected snapshot prevents confirmation and keeps repository writes at
  zero.
- `invalidSnapshotReason` is not shown as raw UI copy.
- TypeScript, tests, production build, Rust tests, browser acceptance, Tauri
  packaging, and isolated native close all pass.
