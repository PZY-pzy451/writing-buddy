# Project scene movement implementation contract

Updated: 2026-07-28

## Goal

Close the remaining scene-drag gap from the project creation and drag handoff:

- show Story Kernel scenes below their owning chapter in the project tree;
- reorder scenes inside one chapter with pointer or keyboard dragging;
- move a scene before or after a scene in another chapter;
- move the scene's exact manuscript slice with its stable scene ID;
- migrate every affected scene and Mention anchor;
- migrate Story Positions that explicitly reference the moved scene;
- persist the complete mutation under one native lock and rollback boundary;
- provide one session-scoped exact-restore Undo receipt against the returned
  revisions and hashes.

This is a manuscript mutation. It is not represented as a synthetic array move
in `.writing-buddy/project.json`.

## Canonical identities and ordering

- A project chapter ID is mapped through `toStoryChapterId` before it is
  compared with `StoryScene.chapterId`.
- A scene keeps its `scene:*` ID, title, and semantic links when moved.
- Scene tree order is `(narrativeOrder, manuscriptRange.start, id)`.
- After a successful move, affected source and target scenes receive dense
  `narrativeOrder` values `0..n-1` in visible manuscript order.
- The manifest is read only for chapter ownership and file paths. Its bytes and
  `projectRevision` do not change.

## Manuscript slice contract

- `manuscriptRange` uses JavaScript/Monaco UTF-16 offsets and an exclusive end.
- The source range must be inside the current source manuscript and its exact
  slice must equal `manuscriptRange.quote`.
- Every scene range in the affected chapter or chapters must be valid,
  non-overlapping, and quote-matching before a write is planned.
- The moved payload is the exact source slice. The planner does not normalize,
  synthesize, trim, or add prose or separators.
- Same-chapter moves remove the slice and insert it at the selected scene
  boundary in the same manuscript.
- Cross-chapter moves remove the slice from the source and insert it at the
  selected scene boundary in the target.
- Text outside the moved slice remains byte-for-byte equivalent after applying
  the source and destination file's existing EOL/BOM policy.
- A drop whose computed manuscript and scene order are unchanged is rejected.

## Anchor migration

For each affected chapter, the planner derives an old-to-new segment map and:

- updates every scene's `chapterId`, `manuscriptRange.start/end/revision/quote`,
  and `narrativeOrder`;
- moves a Mention fully contained by the moved slice to the destination,
  preserving its relative offset and `sceneId`;
- shifts other active or stale Mentions after the deletion or insertion point;
- increments every rewritten Mention revision through the existing optimistic
  persistence contract;
- rejects a Mention that partially crosses the moved scene boundary;
- updates every Story Position whose `sceneId` equals the moved scene ID with
  the new `chapterId` and `narrativeOrder`;
- leaves chapter-level Story Positions without a `sceneId` unchanged.

Evidence that only stores the stable `sceneId` remains valid. A persisted
manuscript range is never relocated by fuzzy quote search during this command;
ambiguous or stale ranges block the move instead.

## Native transaction boundary

The application produces a deterministic mutation plan, but the native adapter
is the authority for persistence:

1. require the project write lock and the Story transaction mutex;
2. recheck the exact manifest SHA-256;
3. prepare source/target text writes with expected file hashes;
4. prepare Story resources and Mentions with expected revisions;
5. reject duplicate or out-of-scope targets before the first write;
6. stage every output;
7. atomically replace each target;
8. on any failure, restore every previously replaced target from captured
   bytes;
9. reread and verify all outputs before returning the fresh resource revisions,
   text hashes, and author-facing description.

Undo is a new exact-restore command built from the verified post-move result
and the pre-move bytes/resources retained by the application receipt. It is
not implemented as a reverse drag because interstitial, unlinked manuscript
text would make that lossy. Undo is rejected if any manuscript hash, Story
resource revision, Mention revision, or manifest revision has changed since
the original move.

## Failure matrix

| Condition | Public code | Persistence |
| --- | --- | --- |
| read-only project | `projectReadOnly` | no write |
| stale manifest | `sceneMoveProjectRevisionConflict` | no write |
| stale scene/position resource | `sceneMoveStoryRevisionConflict` | no write |
| stale Mention | `sceneMoveMentionRevisionConflict` | no write |
| external manuscript edit | `sceneMoveTextConflict` | no write |
| missing/invalid/overlapping scene anchor | `sceneMoveAnchorInvalid` | no write |
| Mention crosses moved boundary | `sceneMoveMentionBoundaryConflict` | no write |
| invalid target/index or no-op | `sceneMoveTargetInvalid` / `sceneMoveNoChange` | no write |
| staging failure | `sceneMoveStagingFailed` | no write |
| commit failure with successful rollback | `sceneMoveWriteFailed` | original state restored |
| rollback failure | `sceneMoveRollbackFailed` | explicit recovery error |
| verification failure | `sceneMoveVerificationFailed` | original state restored |

## Interaction contract

- Scene rows are nested beneath their chapter and use a visible/focusable
  44-pixel drag handle.
- Pointer pickup uses the existing six-pixel activation threshold.
- Space or Enter picks up/drops, arrows choose the destination, and Esc
  cancels with the same outcome as pointer use.
- Source, valid/invalid target, insertion edge, overlay, status, and Undo use
  the shared semantic interaction components.
- Read-only, search, loading, stale-plan, and write-in-progress states disable
  moving with a readable reason.
- Errors are announced and shown in local UI; color is never the only signal.
- Narrow viewports must retain zero page-level horizontal overflow.

## Validation

1. TypeScript compilation before tests.
2. Planner tests for UTF-16 text, same/cross-chapter movement, exact quote
   checks, non-scene text preservation, scene/Mention shifts, boundary
   conflicts, Story Position migration, no-op, and exact restore receipts.
3. Native tests for lock/revision/hash conflicts, combined commit, rollback,
   verification, and Undo.
4. Store and project-tree tests for loading, pointer/keyboard parity, disabled
   states, announcements, and Undo.
5. Complete `pnpm acceptance`, Rust formatting, and `cargo test`.
6. Responsive browser QA at 1440x1000, 1024x768, and 800x720.
7. Fresh Tauri package plus isolated portable startup and normal-close smoke.

## Safety

- Automated tests use only sanitized temporary projects.
- No real author manuscript or API credential is read.
- No AI request is involved.
- The legacy repository remains read-only.
