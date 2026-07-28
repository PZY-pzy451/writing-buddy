# Project creation, drag, and visual source map

Updated: 2026-07-28

## Scope

This source map records the existing implementation before Phase 1.1Y. The
first implementation slice is limited to Y0–Y2: visual tokens, project
creation entry points, the guided wizard, templates, preflight, and verified
staging creation. Dragging remains a later reviewed slice.

## Existing project-open path

```text
TopBar / ProjectSidebar
→ useAppStore.chooseProject
→ desktopBridge.chooseProject
→ Rust choose_project (native folder picker)
→ useAppStore.openProject
→ ProjectOpenService
→ desktopBridge.openProject
→ Rust open_project
→ migration::open_project
→ current-manifest validation / early-project compatibility reader
→ process lock
→ ProjectSnapshot
→ Zustand workspace state
```

Real files:

- `apps/desktop/src/shell/TopBar.tsx`
- `apps/desktop/src/workspace/ProjectSidebar.tsx`
- `apps/desktop/src/app/store.ts`
- `apps/desktop/src/features/projects/application/ProjectOpenService.ts`
- `apps/desktop/src/platform/bridge.ts`
- `apps/desktop/src-tauri/src/commands/mod.rs`
- `apps/desktop/src-tauri/src/migration/mod.rs`
- `apps/desktop/src-tauri/src/process_lock/mod.rs`

## Existing data and persistence

| Concern | Current source | Reuse decision |
|---|---|---|
| Current project schema | `.writing-buddy/project.json` | Reuse unchanged for volume/chapter identity and ordering |
| Early project compatibility | root `project.json` plus discovered volume folders | Keep read-only migration behavior |
| Recent project | Zustand `recentProjectRoot` | Extend compatibly to the three-entry `recentProjectRoots` list |
| Theme/accent | Zustand local storage | Keep global fallback and add optional per-project workspace preferences |
| Text edits and undo | `DocumentSession`, `EditHistory` | Reuse; project-structure undo is deferred to Y3 |
| Story resources | existing `DesktopStoryRepository` and Rust story storage | Reuse; templates create directories only, not a parallel repository |
| Versions/snapshots | existing Rust snapshot commands | Reuse after project open |
| Atomic file writes | `filesystem::write_bytes_atomic` | Reuse for staged files |
| Project open errors | `ProjectOpenService` and `ProjectOpenErrorDialog` | Reuse after creation and for restart |

## Existing visual path

- Global layout and component styles:
  `apps/desktop/src/theme/workspace.css`
- Theme values:
  `apps/desktop/src/theme/tokens.css`
- Product shell:
  `apps/desktop/src/app/App.tsx`
- Global header and navigation:
  `apps/desktop/src/shell/TopBar.tsx`,
  `apps/desktop/src/shell/GlobalRail.tsx`
- Empty project state:
  `apps/desktop/src/workspace/ProjectSidebar.tsx` plus the generic canvas
  empty message in `App.tsx`
- Modal focus trap:
  `apps/desktop/src/accessibility/useModalFocus.ts`

## Confirmed gaps

1. No application-level project creation service or Rust creation command.
2. No template registry.
3. No no-project welcome workspace; the center shows an editor-oriented empty
   message and the assistant may still occupy space.
4. No global create menu.
5. No project creation wizard, field-level validation, review, or preflight.
6. No same-parent staging, verification, and atomic directory rename.
7. Only one recent root is persisted.
8. Theme and accent are global, not restored from the project.
9. Highlight states are expressed through mixed legacy variables rather than
   the semantic token matrix from the visual handoff.
10. No drag library is installed. Y3 must either add an accessible sortable
    library or implement pointer and keyboard sensors behind domain commands.

## Error and feedback path

- Project open failures are converted in Rust to redacted
  `PublicProjectOpenError` values.
- The application store exposes the error dialog and a general toast.
- Creation adds its own typed preflight codes but reuses the same general
  privacy rule: no manuscript, API key, full username path, or staging content
  is included in diagnostics.

## Y0–Y2 architecture

```text
Create entry / Welcome
→ CreateProjectWizard
→ ProjectTemplateRegistry
→ ProjectCreationService
→ DesktopBridge preflight/create
→ Rust validate request
→ same-parent unique staging directory
→ write manifest/preferences/selected structure
→ migration::open_project(staging) verification
→ atomic rename to target
→ existing useAppStore.openProject
→ open first chapter when present
```

The browser bridge supplies a deterministic in-memory equivalent for component
and visual acceptance. It does not weaken the native path.

## Deferred Y3–Y7 work

- Domain drag payload, target, rule registry, and revisioned move command.
- Pointer and keyboard sortable UI.
- Cross-volume/chapter movement and undo.
- Confirmed association drops.
- Drag auto-scroll, overlay, insertion indicator, and status announcements.
- Full highlight screenshot matrix across all drag states.

