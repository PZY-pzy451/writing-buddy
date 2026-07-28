# Project association drag Y4 implementation contract

Date: 2026-07-28

## Outcome

Complete the handoff's Y4 gate without weakening the accepted Y3 project-tree
move contract:

- character to chapter/scene creates an explicit scene appearance;
- item to character records a confirmed, position-aware holder transfer;
- item to chapter/scene creates an explicit scene appearance;
- foreshadowing to chapter/scene asks for plant, reminder, or payoff;
- narrative timeline events can be reordered with a causality guard;
- plot-thread cards can move across lifecycle columns;
- every successful mutation is revision-safe and immediately undoable.

Dragging never invokes AI and never commits on release alone when the operation
needs additional meaning or a story position.

## Existing boundaries reused

- `DesktopStoryRepository` and `saveStoryResources` remain the only Story
  resource persistence path. Multi-resource changes use its atomic commit.
- `ItemStateFileStore` and `story/states/item-states.json` remain the only item
  state path and keep hash-based concurrency protection.
- Existing project-tree `MoveCommand` and manifest move logic remain isolated;
  association dragging does not overload structural moves.
- Existing Story schemas remain version 1. Scene `itemIds` is added as an
  optional field with an empty default so old projects remain readable.

## Interaction model

### Association workbench

The Story Kernel sidebar gains **关联编排**. Its source shelf groups characters,
items, and foreshadowing. The destination workspace exposes:

- chapter and scene targets for scene-level appearances/lifecycle links;
- character targets for item-holder transfers.

Pointer and keyboard sensors share the same drop registry. A valid drop opens a
light confirmation surface; it does not write immediately. Chapter targets
require choosing a concrete scene. Item transfers require an effective
narrative order. Foreshadowing requires plant/reminder/payoff.

At widths below 1100px the confirmation surface becomes a bottom sheet.

### Timeline

Narrative-order mode exposes a horizontally scrollable reorder rail with unique
event cards. Story-time mode explains why dragging is unavailable. Reordering
preserves the existing set of narrative-order slots. If the result places an
event before one of its declared predecessors, a confirmation dialog lists the
conflicts before any write.

### Plot board

Plot-thread cards are draggable between lifecycle columns. Column hover uses
valid-target semantics, successful status changes persist with expected
revision, and no-op drops do not write.

## Accessibility and state rules

- minimum effective target size: 44px;
- pointer and keyboard drag parity via dnd-kit sensors;
- Space picks up/drops, arrows move, Escape cancels;
- drag source, valid target, pending confirmation, saving, success, conflict,
  and invalid states have text/icon labels in addition to color;
- a live region announces pickup, target, confirmation, success, cancellation,
  and errors;
- visible focus rings and reduced-motion behavior are mandatory;
- Ctrl+Z invokes the most recent page-local Y4 undo outside editable controls.

## Transaction and undo rules

Story resource mutations capture the pre-write resources and the revisions
returned by the atomic commit. Undo writes the captured resources back only
when those returned revisions still match.

Item transfers capture the complete prior item-state array. Undo writes it back
through the same live `ItemStateFileStore`; an external hash change blocks the
undo instead of overwriting.

No Y4 operation changes manuscript text, scene anchors, resource IDs, file
paths, project order, or project-to-project ownership.

## Verification

1. TypeScript compilation before tests.
2. Focused Story Kernel transaction and page interaction tests.
3. Complete `pnpm acceptance`.
4. Rust tests and formatting check.
5. Browser visual checks at 1440, 1024, and 800 widths, including bottom sheet,
   focus, target size, and horizontal page overflow.
6. Production Tauri build, isolated native startup/normal close, and portable
   EXE hash.

