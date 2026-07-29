# Phase 1.2A Gate E: Contextual AI and chapter organization

Status: complete
Updated: 2026-07-29

## Goal

Show only the AI actions relevant to the author's immediate writing context,
and let the author explicitly organize a finished chapter through the existing
grounded extraction pipeline without interrupting drafting or adding another
AI capability.

## Existing systems to reuse

- Selection Rewrite already supports polish, concise, expand, grammar,
  dialogue, and pacing with Context Pack preview, strict response parsing,
  source-revision stale checks, editable Diff, snapshot-backed apply, and
  exact Undo.
- Manuscript Continuation already supports continue paragraph, finish scene,
  and three directions with grounded context and author acceptance.
- `manuscript.organize` is already registered in the AI Action Registry.
- `ManuscriptExtractionRunStore`, `ManuscriptExtractionRunner`,
  `StoryKernelGenerationStore`, and `StoryKernelGenerationService` already
  provide project-persisted runs, bounded per-chapter jobs, stop/resume,
  exact Evidence, conflict validation, create/update transactions, and
  snapshot-before-confirm.
- The existing extraction page, task dock, Story routes, Quick Capture inbox,
  Story Repository, version snapshots, and source reveal requests remain
  canonical.

No new AI action ID, provider, Prompt, response schema, Story resource type,
candidate store, router, editor model, or background process is introduced.

## Contextual action resolver

Define a pure `WriterUiContext` and resolver for existing operations:

```ts
interface WriterUiContext {
  workspace: 'writing' | 'planning' | 'reference' | 'review' | 'history';
  hasProject: boolean;
  activeResourceType?: string;
  selectionText?: string;
  cursorAtParagraphEnd: boolean;
  chapterHasDraft: boolean;
  chapterHasPendingExtraction: boolean;
}
```

The resolver returns primary and secondary presentation groups. It never
changes AI availability, invokes AI, or invents an action.

- No selection in a writable chapter: continue paragraph, three directions,
  and finish scene.
- Ordinary prose selection: polish, concise, expand, pacing; grammar and
  dialogue remain under More.
- Conservatively detected dialogue selection: dialogue, polish, concise,
  pacing; expand and grammar remain under More.
- Non-writing workspaces or non-chapter resources do not surface manuscript
  actions.

Dialogue detection is transparent and local. Ambiguous text falls back to
ordinary prose; no hidden AI classification request is allowed.

## Writing-surface behavior

- The selection toolbar replaces its single hard-coded polish action with a
  compact contextual menu of at most four primary operations and a More group.
- The assistant uses the same resolver, so it does not display six equal-
  weight rewrite controls at once.
- Existing request intents and panels remain the execution path.
- Focus returns to the editor when the contextual popover closes.
- The chapter More menu gains one explicit **整理本章** entry. It opens the
  existing extraction center scoped to the current chapter; it never starts a
  paid job automatically.

## Chapter organization behavior

The existing extraction center is refined rather than replaced:

- a chapter-originated entry defaults to current-chapter scope;
- planning remains local and displays the token estimate before any AI call;
- candidates are grouped by Story type with pending/resolved/conflict counts;
- exact Evidence has an explicit **查看正文依据** action;
- every pending candidate can be rejected or copied into Quick Capture for
  later handling;
- low-confidence candidates are never selected automatically;
- batches whose manuscript hash changed are visibly stale and cannot be
  confirmed until the author refreshes/re-runs them;
- selected confirmation still creates one canonical
  `beforeDestructiveOperation` snapshot per source batch;
- the last confirmation returns an in-memory revision-guarded undo receipt.
  Undo restores updated resources, moves newly created resources to recoverable
  Trash, and marks the affected candidates rejected. Concurrent resource
  changes abort before mutation.

Application restart never resumes a paid job. Completed chapters and pending
candidates continue to use their existing project-side ledgers.

## Accessibility and responsive contract

The installed `ui-ux-pro-max` package lacks its referenced search script, so
its verifiable rules are applied directly:

- one primary action per card/section and at most four visible contextual
  actions;
- 44 px effective controls, visible focus, semantic menu/group/status states;
- loading controls disable repeat submission and errors appear beside the
  affected workflow;
- 150–300 ms opacity/transform transitions with reduced-motion override;
- no page-level overflow at 1536×992, 1280×800, or 1024×720.

## Test-first gates

1. Resolver tests fail before the module exists and prove prose/dialogue/no-
   selection/workspace grouping, deterministic order, and the four-action cap.
2. Selection-toolbar and assistant tests fail before contextual rendering and
   prove existing intents are dispatched without introducing an action.
3. Extraction tests fail before current-chapter entry, type grouping, Evidence
   jump, reject/defer, stale blocking, and low-confidence behavior.
4. Confirmation-receipt tests fail before revision-guarded create/update undo,
   recoverable Trash, candidate state update, and concurrent-change refusal.
5. Full self-test, production build, Cargo format/tests, real responsive
   interaction, fresh Tauri Release/NSIS, and native launch/close pass before
   the exact Gate E commit.

## Stop line

Stop after contextual presentation, chapter organization, Evidence/Stale,
snapshot/undo, acceptance evidence, and the exact commit:

`feat: make ai assistance contextual and non disruptive`

Writer Navigator, save-state redesign, new AI actions, and new Story resource
types remain out of scope until a new user direction authorizes Gate F.

## Completion evidence

- Contextual selection and assistant presentation reuse the existing rewrite
  and continuation actions with at most four primary actions.
- The chapter More menu opens the existing extraction center in current-
  chapter scope without starting AI.
- Candidate grouping, exact Evidence, reject, defer, stale-source blocking,
  snapshot confirmation, and revision-guarded undo are complete.
- Gate E targeted tests pass at 6 files / 26 tests. Complete acceptance passes
  at 120 files / 427 tests, plus 53 Rust tests with 2 explicit external gates
  ignored.
- Responsive browser evidence, fresh Release/NSIS artifacts, and native
  launch/normal-close acceptance are recorded in
  `docs/acceptance/040-phase-1.2a-gate-e-contextual-ai-chapter-organization-2026-07-29.md`.
