# AI Quick Actions Gate C2 — continuation and scene planning

Updated: 2026-07-27

## Goal

Complete the two remaining Gate C tasks from the original handoff:

1. author-controlled continuation with **继续本段、完成场景、三种走向**;
2. grounded **目标、场景细纲、正文反向提取、情绪节拍** candidates.

## Runtime boundaries

- Reuse the existing DeepSeek provider, credentials, SSE runtime,
  cancellation, usage accounting, and one-active-job rule.
- Add explicit `manuscript-continuation` and `scene-plan-generation` request
  purposes to the existing TypeScript/Rust boundary.
- Requests contain only an author-visible instruction, a bounded manuscript
  excerpt, and explicitly selected grounded Context Pack records.
- Scene context is included only when the cursor is inside an existing
  StoryScene.
- Clicking an entry never starts a paid request automatically.

## Continuation contract

- The chapter header exposes an **AI 续写** menu.
- Modes:
  - `continue-paragraph`: one continuation candidate;
  - `finish-scene`: one candidate that resolves the current scene;
  - `three-directions`: exactly three titled alternatives.
- Candidates appear in the writing assistant and are never inserted
  automatically.
- Insertion occurs at the captured cursor offset, validates the manuscript
  revision and local anchor, and participates in Monaco Undo.
- Generation supports cancellation; stale candidates cannot be inserted.

## Scene planning contract

- The writing assistant gains a **细纲** tab.
- Modes:
  - generate the current scene/chapter-segment goal;
  - generate conflict, turn, and outcome outline fields;
  - extract those fields from the current scene manuscript;
  - generate emotion-beat candidates.
- Planning applies to the current StoryScene. This avoids rewriting
  `project.yaml` and keeps structured planning in the existing Story Kernel.
- `emotionBeats` is an optional backward-compatible StoryScene field.
- Each returned field is independently selectable.
- Apply validates manuscript revision, manuscript excerpt, and StoryScene
  revision, creates a safety snapshot, then uses the existing repository save.

## UI/UX

- Preserve the warm-paper visual language and Lucide icon set.
- All interactive targets are at least 44px.
- Use visible selected, loading, stale, accepted, error, and disabled states.
- Avoid layout shifts and preserve responsive assistant scrolling at
  1536/1280/1024.
- Continue to respect the existing global focus ring and reduced-motion rule.

## Verification

- TypeScript request builder/response parser tests.
- Rust request-purpose validation tests.
- Continuation stale/insert/Undo service tests.
- Continuation panel candidate and explicit insert component tests.
- Scene-plan parser, field selection, revision conflict, snapshot, and atomic
  save tests.
- Full `pnpm acceptance`, Rust formatting/tests, responsive screenshots,
  isolated Tauri build, and normal-close smoke.
