# AI Quick Actions Gate C — editor selection actions

Updated: 2026-07-27

## Goal

Turn the selection toolbar shown in the approved reference into a real,
author-controlled workflow:

- **AI 润色** opens the writing assistant on the `polish` action;
- **精简、扩写、语病、对话、节奏** use the existing grounded
  `selection-rewrite` DeepSeek job;
- **创建人物、地点、物品、信息揭示、伏笔** open the existing Story Kernel
  generator with the selected text and exactly one preset resource type;
- generated text remains a Diff candidate with accept, edited accept, reject,
  stale protection, and Undo;
- generated Story resources remain candidates until snapshot-backed author
  confirmation.

## Reuse map

| Concern | Existing implementation to reuse |
| --- | --- |
| Selected text/range | `ChapterEditor` and the app store selection |
| Grounded context | `DeterministicContextPackBuilder` |
| DeepSeek rewrite | `SelectionRewritePanel` and fixed Rust `selection-rewrite` contract |
| Text application | `EditTransactionService` and Monaco edit/Undo path |
| Structured resources | `StoryKernelGeneratorPanel` and generation service |
| Atomic resource commit | Story Kernel transaction and safety snapshot |
| Resource linking | Existing Mention service remains available after creation |

## Implementation

1. Add a transient assistant intent to the app store. It opens the assistant
   and selects either a rewrite action or a Story Kernel resource preset.
2. Route the selection toolbar through that intent instead of only toggling the
   assistant or silently creating an empty resource.
3. Extend the grounded rewrite contract with `expand` in TypeScript and Rust.
4. Add preset/reset inputs to `StoryKernelGeneratorPanel` so selection actions
   open a single, explicit resource type without starting a billed request.
5. Improve the toolbar and assistant visual hierarchy while preserving the
   warm-paper design and existing theme tokens.

## Safety boundaries

- Clicking a toolbar action never starts a paid request automatically.
- Context remains visible before generation.
- No AI result writes without explicit author acceptance.
- Text candidates become stale when the source revision changes.
- Structured resources require a safety snapshot and atomic confirmation.
- Read-only projects keep all write and generation controls disabled.
- No full project, path, credential, or author-secret content is added.

## Verification

- Store intent tests for rewrite and resource generation.
- Selection toolbar interaction tests.
- `expand` Context Pack and Rust request validation tests.
- Story Kernel preset/reset component test.
- Existing rewrite Diff/accept/Undo/stale tests.
- Full TypeScript, Vitest, Vite, Rust, and desktop build gates.
- Responsive selection toolbar and assistant screenshots at 1536, 1280, and
  1024 with no clipped controls or page overflow.

## Completion

Completed on 2026-07-27. Durable verification is recorded in
`docs/acceptance/014-ai-quick-actions-gate-c-2026-07-27.md`.
