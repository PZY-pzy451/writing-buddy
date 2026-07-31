# AI-generated manuscript response repair

Status: complete
Updated: 2026-07-31
Branch: `codex/genre-to-draft-gates-a-c`

## Problem

Manuscript continuation and inline Tab plot expansion share one strict response
parser, while selection rewrite has a second equally strict parser. A provider
response that preserves the requested manuscript text but adds a Markdown JSON
fence, a known `result`/`data` wrapper, or common equivalent field names is
rejected before it can become an author-reviewed inline draft. The raw
validation failure is then exposed as a generation failure, and no text can
reach the explicit write flow.

## Outcome

- Decode one bounded structured response, including a single surrounding JSON
  code fence.
- Unwrap only known transport envelopes and normalize only explicit equivalent
  candidate fields.
- Preserve the exact candidate-count contract: one normal continuation or
  exactly three directions.
- Keep malformed or empty manuscript content blocked before draft creation.
- Show a localized response-structure error instead of raw schema output.
- Reuse the repair in assistant continuation, selection rewrite and inline Tab
  plot expansion.
- Preserve author review, transient inline drafts, safety snapshots, stale
  anchors, autosave, Undo and atomic Story Kernel writes.

## Safe repair boundary

The repair may:

- unwrap `result`, `data`, a top-level candidate array, or one candidate object;
- map `direction`/`name` to `title`, `text`/`manuscript`/`continuation` to
  `content`, `rewrite`/`rewrittenText` to `suggestion`, and
  `reason`/`explanation` to `rationale`;
- join an explicit array of manuscript paragraphs with blank lines;
- add a neutral UI title or missing-rationale warning when manuscript content
  itself is present.

It must not infer, rewrite, extend or silently save manuscript prose. Unknown
objects, empty content, excessive output and the wrong candidate count remain
hard failures.

## Verification

- Parser tests for canonical output, fenced/wrapped output, common equivalent
  fields, neutral metadata fallback and unsafe malformed structures.
- Assistant component tests for a repaired inline draft and localized failure
  with zero manuscript writes.
- Selection rewrite component tests for the same repaired/blocked boundaries.
- Inline Tab expansion tests proving the shared parser accepts repaired output.
- Complete TypeScript, ESLint, Vitest, production build and native Rust gates.

## Result

Completed on 2026-07-31. Continuation, selection rewrite, inline Tab expansion
and Story Kernel transport envelopes now accept the bounded equivalent shapes
listed above. Malformed prose candidates remain blocked before draft creation,
and component tests prove zero snapshot or manuscript-write calls on those
paths. Focused regression, complete frontend, native Rust, Release/NSIS and
portable startup/normal-close gates passed.
