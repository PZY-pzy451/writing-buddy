# Story Kernel persisted candidate recovery acceptance

Date: 2026-07-31

Branch: `codex/genre-to-draft-gates-a-c`

## Problem closed

The structural-default repair protected newly generated candidates, but an
older pending item already saved with missing `unique` and `restrictions`
still reopened with its historical `invalid-schema` conflict. The author had
to discard it and pay for another AI generation even though the available
content was otherwise valid.

## Accepted behavior

- One deterministic neutral-field normalizer is shared by new AI responses
  and persisted candidate recovery.
- On reopen, an old pending `create` candidate is repaired locally only when
  applying the neutral defaults makes its complete resource valid.
- The recovery performs no AI request and does not consume another generation.
- System-owned timestamps, revision and evidence IDs are rebuilt locally; no
  author content, resource IDs, positions or references are invented.
- Only the exact historical structural-schema conflict is removed. Target,
  collision, evidence, dependency and unrelated schema conflicts are retained.
- Explicit wrong types remain blocked. An item with malformed `unique` or
  `restrictions` cannot be selected or confirmed.
- Loading a candidate never writes Story resources. The author must still
  select and confirm it, and the existing safety snapshot is still created
  before the atomic write.

## Regression coverage

- Service persistence: an old stored item missing `unique` and `restrictions`
  reopens as `unique: false` and `restrictions: []`, then confirms through the
  normal write path.
- Strict negative: an old stored item with explicit wrong field types keeps
  its `invalid-schema` conflict and has no normalized resource.
- Visible UI integration: the recovered `旧批次蓝色信封` is enabled and
  selected without invoking generation, the stale structure warning is gone,
  and confirmation creates the snapshot before committing the normalized item.

## Validation

- Focused: 3 files / 63 tests passed.
- ESLint: passed with zero warnings.
- TypeScript: passed.
- Full Vitest: 158 files / 625 tests passed.
- Production Vite build: passed.
- Cargo format: passed.
- Rust: 68 passed / 2 explicit external gates ignored.
- Tauri Release and NSIS installer: passed.
- Production portable smoke: title `Writing Buddy`, responsive process, six
  WebView2 processes and zero recording/debug ports.

## Windows delivery

Directory:

`artifacts/release/story-kernel-persisted-candidate-recovery-2026-07-31/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-portable.exe` | 8,363,008 | `55471899ab0cd8880e404adaeeaa00b52290dc6e91ea48d42656d85a75cb02e6` |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,629,090 | `e12679c67ccdcb812b2b6d28e987039ae8d1e2985bb9ae836a2bd6b784f7124e` |
