# Story extraction actionability

Updated: 2026-08-03

## Problem

The chapter assistant passes project chapter IDs such as `chapter-abc` directly
to story extraction, while the AI and native contracts require canonical Story
Kernel IDs such as `chapter:chapter-abc`. The visible action therefore fails
before contacting AI and exposes `invalidStoryExtractionInput` to the author.

The same surface also lacks a clear successful-empty result and can leak raw
parse or persistence errors during extract, accept and reject actions.

## Contract

1. Canonicalize the chapter ID once and use it for AI input, pending facts,
   evidence, story position and visible-fact filtering.
2. Keep strict rejection of empty, oversized or unsafe manuscript content.
3. Decode bounded JSON, accept harmless response wrappers and common field
   aliases, then validate every extracted fact strictly.
4. Never display internal error identifiers. Explain whether the author should
   adjust the selection, retry AI, repair the local pending-facts file or reopen
   the project.
5. Report successful extraction even when no new grounded facts are returned.
6. Verify extract, confirm, reject, duplicate/empty results and error recovery
   through component/service tests and a real browser journey using project-style
   chapter IDs.

## Wider actionability audit

- Exercise every selection toolbar entry that is visible in the browser fixture.
- Hard-fail raw `invalid*`, `undefined`, `null`, stack and unhandled-error text.
- Retain existing strict safety gates for saves, evidence and author confirmation.

## Completed verification

- 4 focused files / 43 tests, full frontend 168 files / 701 tests, lint,
  TypeScript and production build passed.
- Real browser extraction used project ID `chapter-a11ce001`, created one
  pending fact, accepted it, reached zero pending facts and exposed no raw error.
- Full regression passed 26/26 steps from clean commit `876485c` in 590,101 ms.
- Portable and installer were archived under the source-bound `876485c9`
  release directory with SHA-256 evidence.
