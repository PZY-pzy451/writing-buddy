# Project creation entry hardening

Updated: 2026-07-28

## Goal

Make the existing safe project-creation transaction visible and usable as a
first-class **New project** feature from both the empty workspace and an open
project.

## Problem found

- The creation engine and four-step wizard already exist, but their primary
  Chinese label is “新建作品”, so a user looking for “新建项目” can reasonably
  conclude that the feature is missing.
- The project overflow button in the open-project sidebar is inert.
- Creating a project while the active manuscript has unsaved edits can switch
  workspaces after creation without an explicit leave-current-project warning.

## Scope

- Rename project-level creation and open actions to use explicit project
  terminology while retaining “作品名称” for the authored work itself.
- Turn the sidebar project overflow into an accessible project action menu
  containing New project and Open project.
- Warn before the final filesystem transaction when creating from a project
  with an unsaved active manuscript; cancellation must perform no create call.
- Keep the existing four-step wizard, six templates, preflight, staging,
  verification, atomic rename, reopen, and recent-project behavior.

## Interaction contract

- Entry points remain at least 44px and have visible focus.
- Menus close on outside click and Escape; Escape restores trigger focus.
- Project-menu items are keyboard reachable and use plain text plus Lucide
  icons.
- The open-project menu is available in Paper, Midnight, Fog, and Focus.
- At compact widths, the global create trigger remains icon-only with an
  explicit accessible name, while the sidebar menu stays within the viewport.

## Validation

1. Component tests cover empty-workspace and open-project New project entries.
2. A dirty manuscript requires explicit confirmation before creation and
   cancellation creates nothing.
3. The four-step browser fixture still creates, opens, and records the project.
4. Full `pnpm acceptance`.
5. Paper and Midnight checks at 1536×992, 1280×800, and 1024×720.
6. Fresh Tauri build and isolated native startup/close.
