# Story Kernel structural defaults acceptance

Date: 2026-07-31

Branch: `codex/genre-to-draft-gates-a-c`

## Reported regression

An otherwise valid generated item such as `蓝色信封` could omit the required
Story Kernel fields `unique` and `restrictions`. The UI then displayed the
candidate with `需要处理`, disabled confirmation, and diagnostics stating
that both fields were missing.

## Accepted behavior

- Missing or null item `unique` becomes `false`, matching the conservative
  default already used by the established item AI extraction workflow.
- Missing or null item `restrictions` becomes `[]`.
- Explicit `true`/`false` and explicit restriction lists are preserved.
- Wrong explicit types such as `"yes"` or `{}` remain blocked; the repair does
  not coerce malformed values.
- Missing scene and timeline-event reference arrays that safely mean “no
  references supplied” become empty arrays.
- IDs, story positions, semantic text, references and forbidden system fields
  are never invented or relaxed.
- TypeScript and native Rust prompt copies now explicitly require the item
  defaults instead of relying only on downstream normalization.

The normalization happens before candidate staging. Therefore the candidate's
normalized structure is complete, its checkbox is enabled, and the existing
snapshot-before-confirm atomic write path remains unchanged.

## Regression coverage

- AI parser: repairs omitted item-only fields, preserves explicit semantics,
  and supplies neutral scene/timeline arrays.
- Story Kernel service: stages and confirms the repaired item, then reopens it
  with `unique: false` and `restrictions: []`.
- Negative service case: explicitly malformed item fields remain an
  `invalid-schema` conflict.
- UI integration: the screenshot-equivalent `蓝色信封` candidate is enabled,
  shows no field-structure warning, creates a safety snapshot, confirms, and
  writes the normalized resource.

## Validation

- Focused: 3 files / 60 tests passed.
- ESLint: passed with zero warnings.
- TypeScript: passed.
- Full Vitest: 158 files / 622 tests passed.
- Production Vite build: passed.
- Cargo format: passed.
- Rust: 68 passed / 2 explicit external gates ignored.
- Tauri Release and NSIS installer: passed.
- Production portable smoke: title `Writing Buddy`, responsive process, six
  WebView2 processes, zero recording/debug ports, normal close requested.

## Windows delivery

Directory:

`artifacts/release/story-kernel-structural-repair-2026-07-31/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-portable.exe` | 8,363,008 | `d767ff7e5feae8669bcc163cf81783553997343038765d80178b551b9172ce0b` |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,629,158 | `f2a3137d9335de78cd38f83262d8809c7cf5a78855384bb88ab95801bcff0c19` |
