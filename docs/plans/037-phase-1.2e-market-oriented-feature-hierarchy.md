# Phase 1.2E — Market-Oriented Feature Hierarchy

Status: complete

Date: 2026-07-31

## Product outcome

Writing Buddy presents one continuous author journey instead of a flat set of
modules:

`开始故事 → 规划故事 → 写正文 → 管理长期信息 → 检查并完成`

This phase changes information architecture, entry points and visual priority.
It does not replace the existing project, Story Kernel, review, snapshot or AI
write paths.

## Gate A — capability inventory

| Value layer | Existing capability | Phase treatment |
| --- | --- | --- |
| Acquisition | Genre brief, structured outline, hierarchy materialization, first-scene draft | Make the default new-project path and keep one primary action |
| Daily use | Session restore, chapter/scene tree, editor, contextual AI, save state, snapshots | Give writing and the current task the highest visual weight |
| Long-term retention | Characters, relationships, locations, world rules, items, timeline, plots, foreshadowing, knowledge, continuity | Consolidate under Story Library and surface current relevance first |
| Trust and completion | Local storage, save recovery, versions, backups, undo, review | Keep History and Check visible but quiet until relevant |
| Low-frequency professional | AI playground, settings, extraction administration | Preserve compatible routes behind More or contextual entry points |
| Deferred | Community, rankings, cover generation, character chat, maps, family tree, realtime collaboration, automatic publishing | Do not add in Phase 1.2E |

## Gates B–F contract

### Five primary destinations

- `写作`: dashboard, chapter/scene tree and manuscript.
- `规划`: story structure, plot threads, foreshadowing and structure checks.
- `故事库`: current relevance, characters, relationships, world, items,
  events and knowledge boundaries.
- `检查`: chapter and book-level review tasks.
- `历史`: versions, snapshots, recovery and export history entry points.

Search, New, Quick Capture, task state and Settings remain global actions.
AI is contextual; the diagnostic playground remains reachable from More for
route compatibility but is not a primary product destination.

### Progressive presentation

- No project: only the start flow is actionable.
- Project without chapters: planning is recommended; long-term tools are quiet.
- Chapters without prose: scene planning and starting the draft are recommended.
- Prose exists: writing, Story Library and Check receive normal prominence.
- Existing routes and stored workspace modes continue to parse and open.

### Writer surface

- The left sidebar contains only volume, chapter and scene structure.
- The narrow right rail contains exactly `细纲`, `资料`, `AI`, `检查`.
- Only one right-side tool can be open at a time.
- Contextual AI candidates remain temporary until explicit author confirmation.

### Home surfaces

- New-project home asks how the author wants to begin. `根据题材生成大纲` is
  the only primary action; importing and blank work remain available.
- Existing-project home leads with resume, current task, the next recommended
  action and bounded pending work. It does not lead with module counts.

## Compatibility boundary

- Do not delete `RailMode` values for search, settings or the AI playground.
- Do not remove Story Kernel resource routes or editors.
- Do not migrate project files or Story Kernel schemas.
- Do not perform AI generation, snapshot creation or project writes merely by
  navigating.

## Verification

- Pure stage-model tests cover no-project, outline, structure and draft states.
- Navigation tests prove exactly five primary destinations and no primary AI or
  Settings item.
- Planning and Story Library tests prove separate, keyboard-usable navigation.
- Welcome and dashboard tests prove one primary next action and task-led copy.
- Writer rail test proves the four contextual tools and single-active behavior.
- Run TypeScript, focused Vitest, self-test plan/full, Cargo format/tests, Tauri
  Release/NSIS and a production portable smoke before delivery.

## Outcome

- The primary rail now contains exactly five author destinations: `写作`,
  `规划`, `故事库`, `检查`, `历史`.
- New and existing project homes are task-led. The empty home has one primary
  genre-to-outline action and three truthful secondary starts; the existing
  home leads with resume, current chapter, next task, review and recent work.
- Planning and Story Library have separate navigation and keyboard contracts.
  Long-form library tools are visually quiet during early project stages.
- The manuscript sidebar is structure-only and the right writer rail contains
  exactly `细纲`, `资料`, `AI`, `检查`.
- Settings, Quick Capture and AI diagnostics remain available from More, while
  generation stays contextual and author-confirmed.
- Complete acceptance passed on 2026-07-31. Evidence is recorded in
  `docs/acceptance/062-phase-1.2e-market-oriented-feature-hierarchy-2026-07-31.md`.
