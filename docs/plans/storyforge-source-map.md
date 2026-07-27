# StoryForge source map

Updated: 2026-07-27  
Frozen baseline: `7e658a284920b0e61d42da39a0addaa39bd6b11d`

This map is the path authority for StoryForge work. The implementation plan's
suggested paths are used only when they match the repository. Later gates must
extend the current dependency chain instead of creating a second application
shell, router, project repository, editor, review system, or Tauri bridge.

## Runtime map

| Concern | Current source | Current responsibility |
| --- | --- | --- |
| App shell | `apps/desktop/src/app/App.tsx` | Composes TopBar, GlobalRail, project pane, workspace, assistant, task dock, status bar, loading/error overlays and external-conflict dialog. |
| Routing/navigation | `apps/desktop/src/app/store.ts`, `apps/desktop/src/shell/GlobalRail.tsx`, `apps/desktop/src/workspace/SystemPage.tsx` | There is no React Router. `RailMode` and `activeMode` select system/workspace views. |
| Persistent workspace state | `apps/desktop/src/app/store.ts` | Zustand persist stores the recent project root, active/open resources, editor views, theme and layout dimensions. |
| Project selection/open | `apps/desktop/src/app/store.ts`, `apps/desktop/src/platform/bridge.ts`, `apps/desktop/src-tauri/src/commands/mod.rs`, `apps/desktop/src-tauri/src/migration/mod.rs` | Native folder selection, Tauri IPC, manifest discovery/validation, inventory, word counts and lock acquisition. |
| Project schema compatibility | `packages/compatibility/src/index.ts`, `packages/domain/src/index.ts`, `apps/desktop/src-tauri/src/migration/mod.rs` | Current and early-directory schemas, stable IDs, safe relative paths and read-only compatibility. |
| Process lock | `apps/desktop/src-tauri/src/process_lock/mod.rs` | Owns `.writing-buddy/runtime/project.lock`, stale-lock cleanup and release on process exit. |
| Safe filesystem | `apps/desktop/src-tauri/src/filesystem/mod.rs` | Canonical project roots, relative-path validation, UTF-8/LF/BOM preservation and atomic writes. |
| Resource tabs/session | `packages/project/src/index.ts`, `apps/desktop/src/workspace/ResourceTabs.tsx` | Tab deduplication/restoration, document sessions, cursor state and edit transactions. |
| Monaco editor | `apps/desktop/src/editor/ChapterEditor.tsx`, `apps/desktop/src/editor/monacoBootstrap.ts` | Chapter/note editing, selection, cursor/scroll restoration and external-change integration. |
| Resource editors | `apps/desktop/src/resources/ResourceEditor.tsx`, `apps/desktop/src/workspace/ProjectSidebar.tsx` | Legacy reference inventory and structured/text resource editing. |
| Review | `packages/review/src/index.ts`, `apps/desktop/src/features/review/ReviewPage.tsx`, `apps/desktop/src/review/TaskDock.tsx` | Deterministic review, AI candidates, text anchors, author-confirmed apply/undo and persisted issue state. |
| Version/snapshot | `packages/version/src/index.ts`, `apps/desktop/src-tauri/src/commands/mod.rs`, `apps/desktop/src/workspace/SystemPage.tsx` | Snapshot manifest/blob model, creation, listing, diff reads and restore. |
| Backup | `packages/backup/src/index.ts`, `apps/desktop/src-tauri/src/archive/mod.rs`, `apps/desktop/src-tauri/src/commands/mod.rs` | `.wbbackup` validation, creation, inspection and guarded restore. |
| DeepSeek contracts | `packages/ai/src/index.ts` | Provider definition, preferences, request/job contracts and public events/errors. |
| DeepSeek UI/runtime | `apps/desktop/src/features/ai/`, `apps/desktop/src/platform/bridge.ts`, `apps/desktop/src-tauri/src/ai/` | Settings, StoryForge test page, in-memory jobs, secure Rust transport, SSE parsing, credential access and aggregate usage. |
| Tauri command registry | `apps/desktop/src-tauri/src/lib.rs` | Registers the narrow IPC command surface and releases locks/jobs on exit. |
| React tests | `apps/desktop/tests/`, `apps/desktop/src/features/**/*.test.tsx` | App-shell, AI and review behavior. |
| Package tests | `packages/*/src/*.test.ts` | Domain, compatibility, project, review, backup and AI contracts. |
| Rust tests | Inline `#[cfg(test)]` modules under `apps/desktop/src-tauri/src/` | Filesystem, archive, AI validation/storage/SSE and credentials. |
| Build scripts | `package.json`, `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, `scripts/build/low-memory-tauri-build.ps1` | Node 24/pnpm gates, Vite build, Cargo tests and Tauri/NSIS release packaging. |

## Gate A path mapping

The implementation-plan paths do not exist in the frozen baseline. Gate A
maps them onto the current architecture as follows:

| Planned path | Repository path used by Gate A |
| --- | --- |
| `features/projects/application/ProjectOpenService.ts` | Create this focused application service, then call it from the existing `app/store.ts`; it must not own UI state or filesystem access. |
| `features/projects/ui/OpenProjectView.tsx` | Existing no-project view is `workspace/ProjectSidebar.tsx`; update it instead of creating a duplicate page. |
| `features/projects/ui/ProjectOpenErrorDialog.tsx` | Create one dialog component and render it from the existing `App.tsx`. |
| `src-tauri/src/projects/commands.rs` | Keep project commands in existing `src-tauri/src/commands/mod.rs`; keep manifest/integrity work in `src-tauri/src/migration/mod.rs`. |
| `src-tauri/src/projects/tests.rs` | Add focused tests beside the existing Rust modules unless a later extraction moves production code and tests together. |

## Gate A boundary decisions

- `open_project` remains a narrow Tauri command. React never receives arbitrary
  filesystem read/write primitives.
- Public open failures must be structured and redacted before reaching React.
- Read-only open does not acquire a write lock.
- Repair is capability-gated and may only perform an explicitly supported,
  reversible recovery; no schema migration is permitted in Gate A.
- Recent-project recovery uses the existing Zustand persistence key and must
  keep a failed path available for retry/diagnostics without reporting success.
- Gate A may create sanitized copies under `tmp/`; it must not modify fixtures
  or a real author project.

## Design contract

- Machine-readable layout: `docs/design/storyforge-ui-layout-spec-v1.json`
- Schema version: `1`
- Baseline: `1536 × 992`
- Responsive acceptance viewports: `1536 × 992`, `1280 × 800`,
  `1024 × 720`

The professional StoryForge pages remain out of scope until Gate A receives
human approval.
