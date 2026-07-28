# AI generation reliability and handoff audit contract

Date: 2026-07-28
Status: Accepted

## Outcome

Resolve the generic **AI 生成失败。** state shown by the user and publish an
evidence-backed implementation audit for:

- `Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`;
- `Writing_Buddy_StoryForge_AI_Quick_Actions_Handoff_v1.0`.

The result must distinguish implemented, partially implemented, deferred, and
human/provider-gated work. Existing acceptance notes are evidence, not proof
that every source-document checkbox was completed.

## Observed failure

The native AI command rejects with a structured `PublicAiError` object.
`StoryKernelGeneratorPanel.defaultRunGeneration` currently preserves
`Error` instances but replaces any non-`Error` rejection with the fixed text
**AI 生成失败。**. Tauri invoke rejections are plain structured objects, so
authentication, balance, model, network, timeout, rate-limit, and provider
failures can all lose their real message at this boundary.

The same fallback pattern also exists in the shared grounded JSON runner and
selection rewrite path. The repository already has a `normalizeAiError`
implementation, but it is coupled to the Zustand AI store instead of being a
shared error-boundary utility.

## Reliability changes

1. Extract shared AI error normalization and recovery guidance.
2. Preserve native `code`, localized message, retryability, and HTTP status.
3. Render a structured, non-color-only error card in the Story Kernel panel.
4. Provide an explicit retry action for retryable/unknown failures.
5. Provide a direct **检查 AI 设置** action for configuration, key, balance,
   secret-store, model, and invalid-request failures.
6. Keep the failed instruction, selection, and target types unchanged.
7. Never retry a paid request silently.
8. Keep cancellation visually distinct from failure.
9. Add browser QA fixtures for authentication, rate-limit, and unknown native
   rejection shapes.

## Structured-output repair boundary

The AI quick-actions design requests one validation-error repair attempt.
This increment will expose that remaining gap in the audit and will not add an
automatic paid repair request. A future implementation must show the additional
request and cost before sending it, preserve the original raw output, and still
block all writes until the repaired result passes the authoritative schema.

## Handoff audit baseline

### Project creation, drag, highlight, and visual handoff

| Gate | Status | Evidence / gap |
| --- | --- | --- |
| A Source Map and semantic tokens | implemented | Plans 010–011 and Y0–Y2 acceptance |
| B project creation | implemented | Six templates, wizard, native staging/verify/rename |
| C structure dragging | partial | Volume/chapter reorder and cross-volume move implemented; scene reorder/cross-chapter migration not implemented |
| D association dragging | implemented | Character/item/foreshadowing, timeline, plot lifecycle and Undo |
| E shared/highlight components | partial | Tasks 14–15 implemented; broad Task 16 application polish remains Y6 |
| F final hardening | partial | Component-level accessibility and regression gates exist; full contrast/performance/memory/final matrix remains Y7 |

Additional source-design gaps: person-group/world-category drag orchestration,
scene drag, and the complete application-wide empty-state/icon/spacing pass.

### StoryForge AI quick-actions handoff

| Area | Status | Evidence / gap |
| --- | --- | --- |
| Action/Prompt/Context/Preview foundations | implemented | Gates A–B acceptance |
| Editor rewrite, continuation, outline | implemented | Gates C/C2 acceptance |
| Character and relationship actions | implemented | Gate D acceptance |
| World and item actions | implemented | Gate E acceptance |
| Timeline, plot, and foreshadowing actions | implemented | Gate F acceptance |
| Batch extraction and AI consistency review | implemented | Gate G acceptance |
| Failure normalization and recovery UX | partial | Structured native errors can collapse to generic text |
| Schema repair retry | partial | Field diagnostics exist; no explicit validation-error repair request |
| Real provider quality/cost validation | external gate | Requires the user's DeepSeek key and selected real chapter |

## Verification

1. TypeScript compilation before tests.
2. Shared error-normalizer tests for object, `Error`, string code, and unknown
   rejections.
3. Story Kernel component tests for authentication, retryable, cancellation,
   settings navigation, and retry.
4. Focused AI runner regression tests.
5. Complete `pnpm acceptance`.
6. Browser visual checks at 1440 and 1024 in Paper and Midnight.
7. Rust format/tests and fresh Tauri portable build.
8. Durable acceptance report, audit matrix, screenshot evidence, and hashes.

## Stop line

- Do not inspect or expose the user's API key.
- Do not send a real paid request without an explicit user action.
- Do not claim the two handoffs are fully implemented while partial and
  external gates remain.
- Do not implement cross-chapter scene movement without the manuscript-anchor
  migration contract.
