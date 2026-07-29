# Phase 1.2A writer experience source map

Date: 2026-07-29

Source commit: `91d2c553`

Worktree: `D:\develop_tool\writing-buddy-phase-1.2a`

Scope of this first delivery: Gate A–C only

## Method and boundary

This map was produced before changing business code. It follows the real
startup, project, editor, Story Kernel, AI, shell, and native paths rather than
the visible module names alone.

The first delivery may change only:

- Continue Writing and session restoration;
- quiet writing and focus behavior;
- per-workspace layout presets;
- top-bar and status-bar noise.

It must not add Quick Capture, Entity Peek, contextual AI resolution, chapter
organization, Writer Navigator, a new AI action, or a new Story resource type.

## 1. Startup and restoration

| Concern | Existing implementation | Current behavior / gap |
| --- | --- | --- |
| Startup shell | `apps/desktop/src/main.tsx` | Renders a static “starting local writing workspace” shell before dynamically importing React, `App`, and Monaco bootstrap. Startup failure replaces the shell with a local error view. |
| Application bootstrap | `apps/desktop/src/app/App.tsx`; `apps/desktop/src/app/store.ts` | `App` calls `bootstrap()` once. The store opens `recentProjectRoot`, or the first entry in `recentProjectRoots`. There is no explicit restoring state or Continue Writing handoff. |
| Project open | `apps/desktop/src/features/projects/application/ProjectOpenService.ts`; `apps/desktop/src/app/store.ts`; native project commands under `apps/desktop/src-tauri/src/commands.rs` | Project manifest, lock, compatibility, review, scenes, tabs, active resource, and the Story index are loaded through the existing service/bridge. Story indexing is deferred. |
| Recent projects | persisted Zustand workspace in `apps/desktop/src/app/store.ts` | Stores one active root and up to three recent roots. A moved root is treated as an open failure; no identity-based relocated-project lookup exists. |
| Project-open failures | `apps/desktop/src/features/projects/ui/ProjectOpenErrorDialog.tsx` | Structured public errors support retry, read-only open, stale-lock repair, and directory reveal. Project open does not silently migrate or overwrite. |
| Workspace persistence | Zustand `persist` in `apps/desktop/src/app/store.ts`, key `writing-buddy-next-workspace` | Persists recent roots, active/open resources, theme, accent, focus flag, inline-AI preferences, rail mode, Story view, sidebar visibility/width, assistant width, dock height, and per-document cursor views. No schema version, migration, validation, or explicit corrupt-state recovery is installed. |
| Open tabs and resource | `openResourceIds`, `activeResourceId`, `openProject()`, `openResource()` in `apps/desktop/src/app/store.ts` | Uses stable resource IDs. Missing tabs are filtered, but the state is global rather than per project. A deleted active resource safely results in no active editor. |
| Cursor and scroll | `CursorState` in `packages/domain/src/index.ts`; `DocumentSession` in `packages/project/src/index.ts`; `ChapterEditor.tsx` | Stored as `{ lineNumber, column, scrollTop }` under `projectId:resourceId`. Monaco restores position and scroll and writes changes after a 180 ms debounce. No text-anchor or paragraph fallback exists. |
| Scene | `SceneNavigator.tsx`; Story scenes restored in `openProject()` | Current scene is derived from the cursor offset and manuscript ranges. There is no persisted `activeSceneId`, so deleted/reordered scene fallback is implicit rather than a session contract. |
| Tree expansion | project tree component-local state | Not part of persisted workspace state. |
| Pane state | shell state and resize setters in `apps/desktop/src/app/store.ts` | Sidebar visibility persists, but assistant and dock visibility do not. Assistant and dock therefore reopen from defaults on a new process. |
| Focus state | `focusMode` in persisted workspace | Focus is persisted as if it were a normal layout. This can relaunch into focus mode and does not behave as a temporary overlay. |
| Close protection | close effect in `apps/desktop/src/app/App.tsx` | Browser/Tauri close is guarded only when the current `DocumentSession` is dirty. It does not flush session state, wait for saving, or represent failed/offline save state. |

### Current restoration sequence

`main.tsx shell` → `App.bootstrap()` → recent project open → manifest and
project snapshot → review/scenes → valid tabs → active resource →
`DocumentSession` → Monaco model → cursor and scroll → deferred Story index.

The existing sequence is already close to the required priority order and
should be extended, not replaced.

## 2. Manuscript editor

| Concern | Existing implementation | Current behavior / gap |
| --- | --- | --- |
| Editor technology | `@monaco-editor/react` in `apps/desktop/src/editor/ChapterEditor.tsx`; `apps/desktop/src/editor/monacoBootstrap.ts` | One Monaco model URI per stable resource ID/path. Automatic layout is enabled. |
| Document state | `DocumentSession` in `packages/project/src/index.ts` | Preserves content, original content, disk hash, EOL, BOM, dirty flag, version, and cursor state. |
| Selection / cursor | `ChapterEditor.tsx`; app store selection and `cursorOffset` | Selection and UTF-16 cursor offset feed existing AI and scene actions. Selection is runtime-only and intentionally is not restored. |
| Undo | Monaco native edit stack plus `executeEdits` / undo stops | Normal manuscript edits, inline grammar fixes, inline plot acceptance, and rewrite acceptance remain editor-undoable. Structure/story operations use separate receipts/toasts. |
| Save | `save()`, `forceSave()`, `saveAs()` in `apps/desktop/src/app/store.ts`; native atomic write | Manual save only: toolbar/header button or Ctrl/Cmd+S. There is no autosave timer. Atomic writes verify the expected disk hash. |
| Save failure | app store `error`; `ExternalConflictDialog.tsx` | Generic failures appear in a global alert toast. External hash changes have a dedicated blocking conflict dialog with reload/keep-local options. There is no unified `SaveState` type and no explicit saving/offline/failed text state. |
| Status | `apps/desktop/src/shell/StatusBar.tsx`; `apps/desktop/src/workspace/WriterHeader.tsx`; `TopBar.tsx` | Clean/dirty is repeated in three places. It does not show saving or persistent failure. |
| Focus | conditional shell rendering in `App.tsx`; `.is-focus-mode` rules in `theme/workspace.css` | Rail, sidebars, assistant, dock, tabs, and status are hidden. The full top bar remains and its persisted flag mutates normal startup behavior. Esc/F11 exit is absent. |
| Right assistant | `apps/desktop/src/assistant/AssistantPanel.tsx` | Opens by default on every new process because visibility is not persisted. It is hidden in focus, dashboard, system, and Story Studio pages. |
| Inline checks | `features/review/inline/*`; `features/story/ai-context/*` | Existing opt-in AI grammar squiggles and opt-in Tab plot expansion are already editor-native. They remain outside the Gate B/C behavior change. |

## 3. Story Kernel and StoryForge data

### Canonical model and storage

- Resource types are declared once in
  `packages/story-kernel/src/model/StoryResourceBase.ts`:
  chapter, scene, character, location, faction, item, world rule, timeline
  event, relationship, plot thread, foreshadowing, and information.
- Strict schemas live in
  `packages/story-kernel/src/schema/resourceSchemas.ts` and
  `schemaRegistry.ts`.
- Safe resource paths and optimistic, revision-checked persistence live in
  `packages/story-kernel/src/repository/StoryPaths.ts` and
  `StoryRepository.ts`.
- Atomic story/mention/manuscript mutations use the existing transaction and
  native bridge paths; trash and restore are already supported.

### Evidence, anchors, recognition, and backlinks

- `EvidenceRef` and manuscript ranges:
  `packages/story-kernel/src/model/EvidenceRef.ts`.
- Stable manuscript mention links with exact quote, UTF-16 range, revision,
  and active/stale state:
  `packages/story-kernel/src/model/MentionLink.ts`.
- Desktop persistence/rebase:
  `apps/desktop/src/features/story/manuscript/MentionService.ts`.
- Monaco decorations and entity controls:
  `apps/desktop/src/editor/ChapterEditor.tsx` and
  `features/story/manuscript/*`.
- Backlinks and evidence navigation:
  `apps/desktop/src/app/routes.tsx`,
  `features/story/shared/BacklinksPanel.tsx`, and
  `features/story/continuity/IssueEvidenceView.tsx`.
- Evidence navigation already opens the existing chapter resource and calls
  `requestEditorReveal`; it does not create a second router.

### Resource UI and creation

Character, relationship, timeline, worldbuilding/location/faction/rule,
asset/item, plot/foreshadowing, information, association, continuity, and
extraction pages already exist under `apps/desktop/src/features/story/`.
`StoryResourceRegistry.ts` and `app/routes.tsx` map resources into existing
tabs and workspace state.

Manual creation uses the existing page/repository flows. AI extraction and
generation use strict candidates, visible evidence, explicit confirmation,
schema checks, snapshot-before-write, and revision-safe repository commits.
Gate B/C must not add a duplicate resource model, repository, route, or
creation flow.

## 4. AI foundation

| Concern | Canonical implementation |
| --- | --- |
| Action Registry | `packages/ai-actions/src/action/AiActionRegistry.ts`; `createDefaultAiActionRegistry()` is used by `features/ai/drawer/aiGenerationStore.ts`. |
| Prompt Registry / structured output | `packages/ai-actions/src/prompt/PromptRegistry.ts`; strict TypeScript/Rust contracts and Zod parsers in `packages/ai` and Story AI services. |
| Context Pack | General contracts in `packages/ai-actions/src/context/*`; deterministic Story context and serialization in `packages/story-kernel/src/query/ContextPackBuilder.ts`; author-visible preview in `features/story/ai-context/ContextPackPreview.tsx`. |
| Drawer | Unified entry in `features/ai/drawer/AiGenerationDrawer.tsx`; specialized author-review drawers remain inside Story pages. |
| Diff | Monaco `DiffEditor` in `features/story/ai-context/CandidateDiffView.tsx`; field-level comparisons exist in Story AI panels. |
| Apply transaction | `packages/ai-actions/src/apply/AiApplyService.ts` plus Story-specific revision-checked services. |
| Stale | Source revisions mark the unified store and individual candidates stale before apply. |
| Snapshot | Native snapshot bridge with canonical `SnapshotReason`; AI apply creates a pre-write snapshot. |
| Undo | Manuscript edit services retain undo; structural/story actions use verified receipts, snapshot restore, or explicit undo toasts. |
| Jobs | Native AI job registry handles one active job, cancellation, retry classes, and usage; the drawer store exposes current UI state. There is no persisted general-purpose paid-job restore, which is correct for this phase. |

Gate B/C must reuse these boundaries and must not create an alternate AI
registry, chat surface, context serializer, diff engine, snapshot service, or
job store.

## 5. UI foundation

### Navigation and routes

Current primary rail modes are `works`, `search`, `references`, `review`, and
`versions`, with AI Test and Settings as secondary actions
(`shell/GlobalRail.tsx`, `app/routes.tsx`, `workspace/SystemPage.tsx`).

The required writer-facing labels can be introduced as compatibility
mappings:

- Writing → existing `works`;
- Planning → existing works/project structure and Story planning views;
- Reference → existing `references`;
- Review → existing `review`;
- History → existing `versions`.

Existing mode IDs and deep-link/resource behavior should remain valid.

### Layout, tokens, and interaction primitives

- Four-column CSS Grid shell and responsive overlays:
  `apps/desktop/src/theme/workspace.css`.
- Theme, accent, color, spacing, transition, and focus tokens:
  `theme/tokens.css`.
- Shared visual polish and reduced-motion baseline:
  `theme/visualPolish.css`.
- VS Code-style pane resizing and bounds:
  `shell/workspaceResize.ts`, resize separators, and persisted setters.
- Dialog focus restoration:
  `accessibility/useModalFocus.ts`.
- Shared empty states and interaction feedback:
  `features/shared/presentation/*` and `features/shared/interaction/*`.
- Existing modal/drawer/popover/toast examples include project open/create,
  AI generation, inline language/plot controls, external conflict, and undo
  toasts.

### Keyboard and search

Implemented global shortcuts:

- Ctrl/Cmd+B: sidebar;
- Ctrl/Cmd+Alt/Option+B: assistant;
- Ctrl/Cmd+J: dock;
- Ctrl/Cmd+S: save;
- Ctrl/Cmd+Z outside Monaco: recent structure undo.

The top search input displays “Ctrl K” but no Ctrl+K handler or command
palette exists. This phase must not implement Writer Navigator. Other requested
shortcut expansion belongs to a later Gate.

## 6. Reuse decisions for Gate B/C

Reuse:

- Zustand workspace persistence and stable project/resource IDs;
- `DocumentSession` and `documentViews`;
- existing project-open safe errors and recent-project fallback;
- Monaco model/cursor/scroll restoration;
- current pane resize bounds and CSS variables;
- existing rail mode IDs and routes;
- existing dashboard route as the Continue Writing host;
- existing scene ranges and active-resource navigation;
- current focus conditional rendering, revised into a temporary overlay.

Extend:

- a versioned, validated per-project writer session record;
- a lightweight restoration phase/status;
- project-dashboard Continue Writing metadata and action;
- per-workspace pane presets and remembered visibility;
- quiet top/header/status presentation;
- focus keyboard exit without changing the stored regular layout.

Do not create:

- a second project/session file format in the author project;
- a second router, editor model, save engine, Story repository, Context Pack,
  Action Registry, snapshot service, or Job Store;
- any Gate D+ resource, capture, peek, contextual AI, or organization module.
