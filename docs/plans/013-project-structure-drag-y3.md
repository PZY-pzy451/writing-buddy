# Project structure drag Y3 implementation contract

Updated: 2026-07-28

## Goal

Implement the Y3 structure-moving slice of
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`:

- reorder volumes before or after another volume;
- reorder chapters within a volume;
- move chapters into another volume;
- support pointer and keyboard dragging with equivalent outcomes;
- persist `.writing-buddy/project.json` array order atomically;
- reject stale project revisions without partial writes;
- verify the persisted project through the canonical project reader;
- provide one session-scoped inverse move through a six-second Undo action.

## Canonical model

- `.writing-buddy/project.json` array order is the visible project-tree order.
- Moving a chapter changes only its array position. The stable chapter ID and
  Markdown file path never change.
- `projectRevision` is the SHA-256 of the exact manifest bytes read from disk.
- Every `MoveCommand` carries its expected revision, source container/index,
  destination container/index, entity type, and stable entity ID.
- The native adapter holds the project write lock, checks the revision, writes
  atomically, reopens the project, and restores the old manifest if
  verification fails.
- Undo is a new inverse command against the revision returned by the completed
  write. It is not a second client-side source of ordering truth.

## Interaction contract

- A dedicated handle appears on row hover and keyboard focus.
- Pointer pickup starts after a six-pixel movement threshold.
- Space or Enter picks up and drops; arrows choose a target; Esc cancels.
- The drag source, valid target, invalid target, insertion edge, overlay, and
  current destination use the semantic highlight tokens introduced in Y0.
- A valid insertion edge is a three-pixel line with a leading dot.
- The overlay stays inside the viewport.
- Search mode and read-only mode disable reordering with an explicit reason.
- Success is announced and shown in a compact toast with Undo. Ctrl+Z invokes
  the same inverse command when focus is outside an editable surface.
- dnd-kit auto-scroll remains enabled for scrollable structure trees.

## Typed boundaries

- `DragPayload` and `DropTarget` describe interaction intent.
- `DropRuleRegistry` owns allowed and rejected combinations.
- `MoveCommand` is the only structure mutation accepted by the application and
  native ports.
- `ProjectStructureMoveResult` returns the verified project, fresh revision,
  inverse command, and author-facing description.

## Non-goals and safety stop

- Y4 resource association dragging is not included.
- Scene cross-chapter movement is not simulated as array sorting. The current
  chapter schema stores one scene metadata object while Story Kernel scenes
  carry manuscript evidence/position anchors. Moving those safely requires a
  separate manuscript-anchor migration plan.
- No real author project is used for automated acceptance.
- No chapter file is renamed or moved.

## Validation

Run in order:

1. TypeScript compilation and focused drop-rule/service/store/UI tests.
2. Rust persistence, reopen, inverse-command, stale-revision, and no-rename
   tests against temporary sanitized projects.
3. Full `pnpm acceptance`.
4. `cargo fmt --check` and complete `cargo test`.
5. Browser pointer and keyboard acceptance at 1440×1000, 1024×768, and
   800×720, including search-disabled behavior and zero page overflow.
6. Fresh Tauri build and isolated portable native startup/normal-close smoke.

## Stop condition

Record accepted Y3 evidence and produce the portable EXE and installer. Do not
begin Y4 association dragging without a separate continuation request.

