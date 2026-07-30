# Phase 1.2B Gate E — Expand outlines into writable scenes

## Scope

Gate E advances a confirmed structured story outline through three author-controlled
preview steps:

1. story beats → volume projections;
2. one volume → chapter projections;
3. one chapter → scene projections;
4. one explicit final confirmation → canonical project chapters, manuscript scene
   anchors, and canonical `StoryScene` resources.

Gate F editor layout work is explicitly out of scope.

## Canonical data boundary

- `WritingProject.volumes[].chapters[]` remains the only canonical volume/chapter
  hierarchy used by the project tree and manuscript editor.
- `StoryScene` remains the only canonical scene record.
- Creation Journey `StoryOutlineNode` records are planning projections. Volume,
  chapter, and scene projections use `type`, `parentId`, and `order`; after
  materialization they carry only the matching canonical `resourceId`.
- No second manuscript chapter store, scene store, DeepSeek runtime, or project tree
  is introduced.
- The existing legacy `chapters` proposal field and
  `materialize_creation_journey` command remain for older Creation Journey routes.
  The genre-to-draft path uses hierarchy projections and a new native transaction.

## Transaction

The final apply path is:

`Preview → Validate Revision → Check Locked → Create Snapshot → Atomic Apply → Update Tree → Show Undo`

The native command validates:

- project manifest revision;
- Creation Journey content hash;
- project ID;
- hierarchy parentage and ordering;
- non-empty titles and bounded structured fields;
- no locked hierarchy node without a canonical resource ID is overwritten;
- no canonical ID is supplied by the renderer for a new node;
- generated chapter and scene IDs are unique;
- generated manuscript ranges are valid and non-overlapping.

After validation it prepares all outputs before the first write:

- updated project manifest;
- one Markdown manuscript per new chapter;
- one Story Kernel scene JSON resource per scene;
- updated Creation Journey state with canonical IDs.

It then writes them as one rollback-capable transaction and verifies the final
manifest, journey, manuscripts, and scene resources. Any failure restores all
previous bytes and removes only files created by this transaction.

## Projection shape

`CreationJourneyState.outline` is extended without changing schema version 2:

- story beat: no hierarchy parent, no canonical resource ID;
- volume: no hierarchy parent, optional canonical volume ID;
- chapter: parent is a volume projection, optional canonical chapter ID;
- scene: parent is a chapter projection, optional canonical StoryScene ID.

`StoryOutlineNode.resourceId` is optional. Existing version-2 files therefore remain
readable. Validation counts story beats independently from the bounded hierarchy so
the original 5–8 beat invariant remains intact.

## AI operations

The existing `creation-journey` job and provider are extended with three strict
operations:

- `expand-to-volumes`;
- `expand-volume-to-chapters`;
- `expand-chapter-to-scenes`.

Each request carries only the selected story/parent projection and the minimum
locked-decision context. It excludes project IDs, paths, credentials, full
manuscripts, and author secrets. Each response is strict JSON and may receive at
most one repair attempt through the existing runtime.

## Preview and conflicts

Every split returns local preview data and a deterministic conflict report before
changing Creation Journey state. The preview shows:

- planned create count;
- locked children that will be preserved;
- existing children that will be preserved;
- duplicate-title or invalid-parent conflicts.

Confirmation merges only new, non-conflicting projections. Locked children are
never mutated or removed. A conflict blocks confirmation until the author changes
the candidate or target.

## UI

- One enabled primary action is shown for the selected level:
  - story summary → split into volumes;
  - volume → split into chapters;
  - chapter → generate scenes;
  - materialized scene → start writing.
- Candidate generation never writes canonical files.
- A separate confirmation is required to accept a split preview.
- Final materialization has its own explicit review dialog and count summary.
- Controls meet the existing 44 px hit-target rule, have keyboard focus states,
  preserve the warm-paper visual language, and stack without horizontal overflow at
  1024×720.

## TDD sequence

1. Model tests for hierarchy validation, preview conflicts, lock preservation, and
   canonical-ID projection.
2. AI contract tests for all three operations, target matching, strict output, one
   repair boundary, and privacy rejection.
3. UI tests proving preview-before-change, explicit confirmation, one primary
   action, conflict blocking, and accessible progress/error states.
4. Store/bridge tests proving snapshot precedes the native transaction and project
   tree state updates from the returned canonical manifest.
5. Rust tests for success, stale revisions, locked nodes, malformed hierarchy,
   valid scene anchors, and rollback.
6. Full frontend, lint, typecheck, Rust, real Tauri smoke acceptance, portable EXE,
   and NSIS installer.

## Acceptance

- A fresh genre outline can be split into volumes, chapters, and scenes without an
  unconfirmed canonical write.
- Final confirmation creates the canonical hierarchy, chapter files, and
  `StoryScene` resources in one rollback-safe native transaction.
- The project tree updates immediately from the returned manifest.
- The first chapter opens at the first generated scene anchor.
- Locked projections survive all split operations.
- Stale revisions and title/parent conflicts never partially write.
- A snapshot exists before apply and the UI exposes the existing version restore
  path as Undo.
