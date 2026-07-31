# Phase 1.2F — Task-to-Action Closure

Status: complete

Date: 2026-07-31

## Product outcome

Phase 1.2E made the next task visible. Phase 1.2F makes that task directly
executable without asking the author to reconstruct context on another page.

## Gate A — Check inbox

- `检查` opens a project-level task overview even when no chapter is active.
- Existing open issues identify the next affected chapter.
- With no issue yet, the current or first chapter is offered as the bounded
  inspection target.
- Opening the target stays inside Check; running a rule or AI review remains a
  separate explicit author action.
- At most one enabled primary action is shown for the current state.

## Gate B — Contextual global create

- Remove permanently disabled future placeholders from the global New menu.
- Keep project/open, chapter and quick-capture actions.
- Route scene, character, world, item, plot/foreshadowing and timeline intents
  to their existing planning or Story Library workspace.
- Open the existing contextual assistant for entity creation; do not invoke AI
  automatically and do not write any Story resource before confirmation.
- Reorder contextual create actions by the author's current primary workspace.

## Compatibility and safety

- No project, Story Kernel or review schema migration.
- The contextual intent is ephemeral and is not persisted.
- Read-only projects cannot start create intents.
- Existing routes, direct page buttons, keyboard shortcuts and AI confirmation
  transactions remain unchanged.

## Verification

- Store/menu tests cover all intent-to-workspace mappings and contextual order.
- Experience tests cover global New → contextual assistant with zero AI call.
- Review tests cover no-active-chapter → next task → chapter context.
- Responsive browser acceptance covers Check and the global New menu at desktop
  and compact widths with no page overflow or clipped controls.
- Run full self-test, Cargo gates, Tauri Release/NSIS and native portable smoke.

## Outcome

- Check now opens a project task inbox and can load the next affected or first
  chapter without leaving the page.
- The global New menu routes six contextual author intents into existing
  planning and Story Library workflows; five entity intents open the matching
  assistant without starting generation.
- Focused regressions, the complete 633-test frontend suite, Rust tests,
  responsive Edge/CDP acceptance, Tauri Release/NSIS and portable smoke all
  passed.
- Acceptance: `docs/acceptance/063-phase-1.2f-task-to-action-closure-2026-07-31.md`.
