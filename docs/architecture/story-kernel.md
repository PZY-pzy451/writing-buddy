# Story Kernel architecture

Story Kernel is the framework-independent source of truth for structured story
facts. It lives in `packages/story-kernel` and must not import React, Monaco,
Tauri, Node filesystem APIs or an AI provider.

## Domain model

```text
Manuscript
├─ Volume
├─ Chapter
├─ Scene
└─ TextAnchor

Entity
├─ Character
├─ Location
├─ Faction
├─ Item
└─ WorldRule

Narrative
├─ TimelineEvent
├─ Relationship
├─ PlotThread
├─ Foreshadowing
└─ StoryInformation

State
├─ CharacterState
├─ ItemState
├─ LocationState
├─ RelationshipState
└─ KnowledgeState

Evidence
├─ ResourceId
├─ SceneId
├─ TextRange
└─ RevisionId
```

Every canonical resource has a strict type-specific schema, stable typed ID,
`schemaVersion`, timestamps and revision. Unknown fields are rejected in
formal v1 files so an older writer cannot silently discard future data.

## Storage boundaries

```text
<project>/
├─ chapters/**/*.md                 canonical manuscript
├─ references/**                    compatible author resources
├─ story/**/*.json                  canonical Story Kernel resources
└─ .writing-buddy/
   ├─ project.json                  canonical project metadata
   ├─ review/**                     author review decisions
   ├─ ai/pending-facts/**           unconfirmed AI candidates
   ├─ cache/story-index-v1.json     rebuildable derived index
   └─ runtime/**                    process-local locks/state
```

React receives only typed bridge operations. Rust owns safe path resolution,
canonicalization, locking, atomic writes, snapshots, archive verification and
credential-backed AI transport.

## Read and write path

1. The UI requests a typed resource through `StoryRepository`.
2. The desktop bridge invokes a fixed Tauri command; no arbitrary UI path is
   accepted.
3. Rust resolves the resource through the project root and rejects traversal,
   symlink escape and invalid resource IDs.
4. JSON is validated against the strict Story Kernel schema.
5. A write verifies the expected revision, writes an atomic replacement and
   returns the committed revision.
6. Story Index updates incrementally. If its version or source fingerprint is
   invalid, it rebuilds from canonical data.

Multi-resource changes use a transaction contract so related facts are
validated before the first canonical write. Deleted formal resources move to
recoverable Trash instead of disappearing immediately.

## Story position and evidence

Story time and narrative order are deliberately separate. `StoryPosition`
always contains chapter and narrative order, and may add scene and story time.
Dynamic state resolution chooses facts effective at the requested narrative
position and exposes confirmed, pending and conflicting alternatives.

Evidence links a fact back to a scene, manuscript range and revision. Mention
anchors rebase after nearby edits when possible and become visibly stale when
their quote can no longer be proven. Backlinks are derived from canonical IDs.

## Consistency engines

Pure deterministic rules cover:

- simultaneous character presence at different locations;
- predecessor inversion and insufficient travel time;
- unique items with overlapping holders or transfers;
- negative item quantity;
- plot/foreshadowing lifecycle risk;
- premature information reveal.

The desktop continuity service merges these findings with text rules and
optional AI suggestions. Stable IDs deduplicate findings. AI-only findings
cannot exceed warning severity and never apply changes without confirmation.

## AI trust boundary

`ContextPackBuilder` creates a deterministic P0-P6 package with required
selection/instruction items, bounded optional context and visible token
estimates. Author-secret items default to excluded. DeepSeek receives only the
serialized included items.

A generated rewrite is bound to resource ID, source revision and exact text
range. Acceptance fails if the source is stale. A confirmed replacement is
recorded through the existing edit transaction and supports exact Undo.
Extracted facts remain outside `story/` until the author supplies evidence,
position and explicit confirmation.

Direct Story Kernel generation uses the same trust boundary at resource scale.
DeepSeek may propose complete characters, scenes, locations, factions, items,
world rules, timeline events, relationships, plot threads, foreshadowing and
information records, but it cannot supply system metadata or storage paths.
The application hydrates timestamps and revisions, validates every strict
schema and cross-resource reference, and persists the result under
`.writing-buddy/ai/story-kernel-generation/` as a pending batch. Only an
author-selected, conflict-free batch can enter `story/`; confirmation first
creates a safety snapshot and then performs one optimistic, create-safe
repository transaction.

## Versioning and recovery

The v0-to-v1 migration is a three-step contract:

1. **stage** a pure validated v1 candidate and exact original payload;
2. **commit** only the validated candidate;
3. **rollback** to the byte-equivalent JSON value if the migration is rejected.

Snapshots and `.wbbackup` archives include canonical author data and pending
facts but exclude derived caches, runtime state and incomplete AI jobs. Restore
verifies hashes and safe relative paths, prepares a pre-restore snapshot,
atomically restores files, clears derived caches and invalidates the Story
Index before reopen.
