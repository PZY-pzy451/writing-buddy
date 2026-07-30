# Phase 1.2B Genre-to-Draft Source Map

Date: 2026-07-30

Scope: Gate A source map and architecture freeze

Worktree: `D:\develop_tool\writing-buddy-genre-to-draft`

Branch: `codex/genre-to-draft-gates-a-c`

Baseline commit: `01a440af73a764abc14e45f388b2a2f098e0bca1`

## Stop line

This delivery implements Gate A, Gate B, and Gate C only. It stops before
Gate D. Gate A changes documentation only; the implementation starts only
after the two required Gate A documents are committed.

The legacy Code-OSS workspace at `D:\develop_tool\writing-buddy` is an
inspection-only reference. All changes belong to this isolated Tauri
worktree.

## Verified baseline

The unmodified baseline passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`: 135 files, 507 tests
- `pnpm build`
- `cargo fmt --check`
- `cargo test`: 60 passed, 2 external-fixture gates ignored by design
- `pnpm tauri:build` with one Cargo build job and the existing shared target
- release executable responsive startup, normal close, and exit code 0

The frontend build reports the existing large Monaco chunk warning. It is not
a functional blocker for this slice.

## Existing-system map

| Concern | Current source | Reuse decision | Missing work for Gate B/C |
| --- | --- | --- | --- |
| New-project entry | `apps/desktop/src/features/projects/ui/ProjectCreationWizard.tsx` | Extend the current wizard and creation service; do not add a second launcher | Add the primary genre route, quick/deep controls, draft restore, and open the existing journey |
| Project creation | `apps/desktop/src/features/projects/application/ProjectCreationService.ts` | Reuse the current project/first-volume transaction | Genre start creates no phantom chapter and opens the journey |
| Project domain | `packages/domain/src/index.ts` | `WritingProject.volumes[].chapters[]` remains canonical | No competing planning-chapter entity |
| Journey domain | `apps/desktop/src/features/creation-journey/CreationJourneyModel.ts` | Extend strict schema version 2 compatibly | Add optional genre input, outline root, and richer story-beat fields |
| Journey persistence | `apps/desktop/src/features/creation-journey/CreationJourneyStore.ts` | Reuse project-owned `.writing-buddy/creation/journey.json`, revision, and expected-hash protection | Persist genre drafts and generated outline through the same serialized save path |
| Journey UI | `apps/desktop/src/features/creation-journey/CreationJourneyPage.tsx` and `CreationJourneySidebar.tsx` | Keep one author journey and its existing route | Add focused genre input and structured-outline workspaces rather than a new product shell |
| Outline actions | `CreationJourneyModel.ts` reducers and `CreationJourneyPage.tsx` persistence boundary | Reuse edit, reorder, lock, impact, stale, and autosave semantics | Add root editing, rich node inspector, keyboard/DnD move, and one-level structural undo |
| Chapter materialization | current journey chapter proposals plus native transaction | Reuse later; do not invoke during Gate A-C | Gate D+ will project planning nodes into canonical chapters atomically |
| Project tree | `ProjectStructureTree.tsx`, `ProjectStructureDrag.ts`, `ProjectStructureMoveService.ts`, `packages/project/src/ProjectStructureMove.ts` | Reuse interaction language and revision-safe move principles | Do not mirror outline nodes into the project tree before materialization |
| Editor | `apps/desktop/src/editor/ChapterEditor.tsx` | Existing Monaco editor remains canonical manuscript surface | No editor implementation in Gate A-C |
| Scene model | `packages/story-kernel/src/model/Scene.ts` | `StoryScene.chapterId` and `manuscriptRange` remain canonical | Future scene planning nodes become projections of these IDs after materialization |
| Scene movement | `SceneNavigator.tsx`, `SceneService.ts`, `ProjectSceneMoveService.ts`, `SceneMoveTransaction.ts` | Reuse atomic scene semantics in later gates | No competing scene body/order store |
| StoryForge data | `features/story/characters`, `worldbuilding`, `timeline`, `plots`, `assets`, `continuity` | Existing Story Kernel resources remain canonical | Gate B may suggest future resources, but must not create them silently |
| AI runtime | `packages/ai/src/index.ts`, `apps/desktop/src-tauri/src/ai/mod.rs`, `apps/desktop/src/platform/bridge.ts` | Extend the existing `creation-journey` job | Add one bounded `generate-from-genre` operation and matching TS/Rust/browser-fixture contracts |
| AI action registry | `packages/ai-actions/src/action/AiActionRegistry.ts`, `PromptRegistry.ts` | Register one action in the existing registry | Add `outline.generateFromGenre`; do not add a second runtime or drawer |
| AI context | `AiContextBuilder.ts`, `features/ai/context/ContextPreview.tsx`, `features/story/ai-context/ContextPackPreview.tsx` | Reuse disclosure and grounding conventions | Add a genre-specific preview showing included fields and explicit exclusions |
| AI review/apply | `AiOutputValidator`, `AiApplyService`, `AiPreviewTransaction` in `packages/ai-actions` | Preserve validate-before-apply and explicit author confirmation | Never write partial or malformed output |
| Assistant surfaces | `apps/desktop/src/assistant/AssistantPanel.tsx` and StoryForge AI panels | Existing drawer/panels remain authoritative | Genre generation stays inside the journey, not a duplicate assistant |
| Session restore | `apps/desktop/src/app/writerSession.ts` and store tests | Reuse current project/workspace restore | Journey file supplies outline/order/lock restoration |
| Resizing | `apps/desktop/src/shell/ResizeHandle.tsx` and shell layout | Reuse the existing accessible splitter component | Gate C local panes use bounded/responsive sizing without introducing another shell |

## Canonical Chapter and Scene design

The planning model must never become a second manuscript system.

1. `WritingProject.volumes[].chapters[]` is the only canonical chapter list.
2. A materialized planning chapter stores the canonical `chapterId` as its
   resource reference; it does not copy manuscript text, status, or position.
3. `StoryScene` is the only canonical scene record. Its `chapterId` and
   `manuscriptRange` bind it to the canonical manuscript.
4. Before materialization, Gate C nodes are story beats, not chapters or
   scenes. They may carry a stable planning ID and author metadata only.
5. Future chapter/scene generation must happen in one revision-safe native
   transaction, after explicit confirmation.
6. Moving a materialized chapter or scene must call the existing project or
   Story Kernel move service. The outline may display the result but cannot
   own a second order.

This preserves the invariant:

`planning projection -> canonical resource ID -> editor/Story Kernel source`

and explicitly rejects:

`planning copy <-> project-tree copy <-> editor copy`.

## Gate B data and AI contract

### Persisted author draft

Extend the current schema-version-2 journey document with an optional
`genreInput` object:

- genre
- premise
- story scale
- ending preference
- optional audience, tone, themes, constraints, and inspiration
- quick/deep mode
- updated timestamp

The persisted draft may retain its owning project identity through the
surrounding journey document. The outbound AI request must not contain
`projectId`, root paths, file paths, credentials, API keys, manuscript files,
or unrelated Story Kernel records.

### AI operation

- Existing job type: `creation-journey`
- New operation: `generate-from-genre`
- Existing action registry ID: `outline.generateFromGenre`
- One explicit click starts one job
- Synchronous request admission prevents repeated-click duplicates
- Cancel stops the job but preserves the saved form draft
- No AI call occurs merely because a field changed

### Strict response

The response is strict JSON and contains:

- editable outline-root fields
- 5-8 ordered story-beat nodes
- each node's title, summary, goal, conflict, outcome, hook, and optional POV
- bounded suggestions for later canonical resources
- bounded warnings

Unknown keys, unsafe strings, invalid counts, duplicate IDs, invalid order,
or structurally incomplete nodes fail before state mutation. A response may
receive exactly one repair request using the same bounded author input. A
second failure returns an actionable structure error, retains the draft, and
creates no outline. There is no infinite retry and no misleading “check AI
settings” message for a valid connection that returned malformed JSON.

## Gate C state extension

Extend the same journey document with an optional `outlineRoot` and richer
optional fields on the existing `StoryOutlineNode`. Keep schema version 2 so
older saved projects remain valid; all new fields are optional at the
persistence boundary and normalized when the genre workspace is opened.

The existing centralized `locks.outlineNodeIds` remains the only lock source.
A node must not gain a second persisted `locked` boolean. Root/node edits,
reorder, delete, restore, and AI replacement all honor the centralized locks.

The store keeps its current expected-hash and serialized write behavior.
Structural commands capture one restorable snapshot for Undo. Persistence is
immediate for structure and lock changes and debounced for text input.

## Gate B implementation map

Expected production changes:

- `ProjectCreationWizard.tsx` and its tests
- app/store routing for a preferred creation-journey start route
- `CreationJourneyModel.ts` and strict model tests
- a focused genre-to-outline application service and tests
- a genre input/context preview UI and experience tests
- `packages/ai` request/response schemas and prompt parity tests
- `packages/ai-actions` registry/prompt entries and tests
- Tauri AI validator and browser fixture parity
- Tauri journey-state parser for optional genre/outline fields

Gate B commits only the input, explicit generation, strict validation,
cancel/retry recovery, and resulting editable outline draft. Three-pane
reordering/locking belongs to Gate C.

## Gate C implementation map

Expected production changes:

- structured-outline workspace components within `creation-journey`
- left tree, center beat cards, right selected-node inspector
- root and node editing
- pointer and keyboard reorder with semantic feedback
- lock/unlock, delete, and one-step Undo
- autosave and reopen restoration tests
- compact/responsive presentation tests

The workspace consumes the Gate B draft from the existing journey store. It
does not create chapters, scenes, manuscripts, Story Kernel resources, or a
new project tree.

## Test and evidence strategy

For each gate:

1. Add a focused failing test.
2. Run the focused test and record the expected failure.
3. Implement the smallest compatible change.
4. Run TypeScript compilation before tests.
5. Run focused tests, then the complete suite.
6. Run lint/build and Rust parity checks in proportion to the change.
7. Commit the gate independently using the exact requested message.

After Gate C, run the real Tauri desktop and capture 1536x992, 1280x800, and
1024x720 evidence. The silent fresh-project journey must create a project,
select `都市悬疑`, enter a premise, generate, disclose generation basis, edit
the root, move two nodes, lock one, edit another, close/reopen, and verify
outline text, order, and lock state.

## Known non-blockers

- The installed `ui-ux-pro-max` skill references a missing search helper.
  Its documented 44 px target, keyboard, focus, contrast, responsive, motion,
  and SVG-icon rules are applied directly.
- The PRPM CLI required by the optional self-improving package search is not
  installed. No unverified package is installed or recommended.
- The existing Monaco production chunk warning remains outside this slice.
