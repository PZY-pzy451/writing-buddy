# Project highlight and shared interaction Y5 implementation contract

Date: 2026-07-28
Status: Accepted

## Outcome

Complete Y5 from
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`:

- replace duplicated tree/drop/overlay/association/undo presentation with
  shared interaction primitives;
- add opt-in manuscript highlights for character, location, item, and
  foreshadowing mentions;
- standardize AI candidate, conflict, accepted, rejected, and stale visual
  states with semantic tokens and non-color labels;
- make Story Kernel schema failures field-specific and actionable;
- prevent narrow assistant cards from allowing raw JSON and generic validation
  text to dominate the review task.

The user-provided **信号塔的无声警告** screenshot is the first regression case:
`readerVisibility: "hidden"` must be reported as an invalid field that expects
a 0–1 number, rather than only showing “资源未通过完整 Schema 校验”.

## Existing boundaries reused

- Existing four-theme semantic tokens remain the only interaction palette.
- dnd-kit remains the pointer/keyboard drag runtime.
- `ProjectStructureMoveService`, `StoryDragTransaction`, and existing Undo
  receipts remain the only mutation/undo paths.
- `useModalFocus` remains the dialog focus-trap implementation.
- Monaco decorations and persisted `MentionLink` records remain the only
  manuscript-link highlight path.
- Story Kernel schemas remain authoritative; invalid AI values are diagnosed
  but never silently coerced or committed.

## Shared interaction primitives

Create one small shared interaction package under
`apps/desktop/src/features/shared/interaction`:

- `TreeRow` keeps selected, focus, drag source, valid target, invalid target,
  and conflict as independent states.
- `DropIndicator` renders the three-pixel line/dot, inside target, association,
  and invalid variants.
- `DragOverlayCard` standardizes icon, entity kind, title, optional hint, and
  viewport width bounds.
- `AssociationMenu` supplies the modal surface, focus trap, heading, close
  action, responsive bottom-sheet behavior, and footer.
- `UndoToast` supplies polite announcement, result copy, Undo, close, busy,
  and responsive placement.
- `AiCandidateFrame` supplies semantic AI/conflict/success/stale/rejected
  framing without owning domain actions.

Project-tree and Y4 association surfaces must consume these primitives. The
existing domain services and event handlers do not move into the UI package.

## Manuscript entity highlights

- Highlights are off by default.
- A compact **资料高亮** control exposes independent character, location, item,
  and foreshadowing toggles.
- Preferences are remembered per project in local browser storage; mention
  records and project files are not changed.
- Monaco decoration classes derive only from the stable resource ID prefix.
- Each entity uses a quiet background plus underline token, below selected
  text visual weight.
- Clicking a highlighted mention keeps the existing navigation behavior.
- Stale mentions are not highlighted.

## AI candidate and schema diagnostics

- Story Kernel conflicts can carry persisted structured details:
  `path`, localized `message`, expected shape, and safe actual-value preview.
- Zod issues are converted to author-facing field diagnostics. Raw provider
  values remain available only in the explicitly expanded structure view.
- The generic schema conflict remains as the group label, with a clear
  “无法确认写入” action consequence.
- Candidate cards show icons and labels for pending, conflict, accepted,
  rejected, and stale states; color is supplementary.
- Evidence is labeled and reports its character count instead of rendering an
  unexplained one-character block.
- The generation system prompt explicitly defines enumerations and scalar
  types that models commonly confuse, including `readerVisibility` as a number
  from 0 through 1.

## Accessibility and responsive rules

- Effective interactive targets are at least 44px.
- Focus uses the shared focus token and halo.
- Status and conflict meaning never rely on color alone.
- Dialogs retain focus trap and Escape behavior.
- Toasts remain `aria-live="polite"`; blocking schema failures are associated
  with the candidate through an alert region.
- Drag scale/movement and popover transitions respect reduced motion.
- At 1024px and 800px, candidate details wrap without page overflow; expanded
  structures scroll internally.

## Verification

1. TypeScript compilation before tests.
2. Focused shared-component, entity-highlight, Story Kernel diagnostic, panel,
   project-tree, and association tests.
3. Complete `pnpm acceptance`.
4. Browser visual and interaction checks for Paper, Midnight, Fog, and Focus,
   including the supplied narrow invalid-candidate case.
5. Rust format/tests to prove no native regression.
6. Fresh Tauri portable/installer outputs and isolated native smoke.

## Stop line

This Y5 gate does not perform the broad Y6 application-wide spacing, empty
state, icon, or responsive polish pass. It also does not implement Y7
performance/final acceptance, scene cross-chapter migration, cross-project
copying, schema coercion, or automatic AI repair.
