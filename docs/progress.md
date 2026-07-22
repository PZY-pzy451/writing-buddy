# Current Progress

- Active task: **Phase 0.3 — Writer Workbench Layout Prototype COMPLETE**.
- Status: Phase 0.3 Completion Pass executed; scope-creep features removed, core loop closed, 11/11 GUI checks, 45/45 unit tests, workbench compile clean, EXE rebuilt.
- Repository: `D:\develop_tool\writing-buddy`.
- Branch: `writer/phase-0.3-writer-workbench-layout`.
- Remotes: `origin` (local bare `D:\develop_tool\writing-buddy-downstream.git`), `github` (`https://github.com/PZY-pzy451/writing-buddy.git`), `upstream` (`https://github.com/microsoft/vscode.git`).
- CI/CD: `.github/workflows/ci.yml` (lint, tests, build check, security scan) and `.github/workflows/build-exe.yml` (EXE build with artifact upload) configured; GitHub `main` branch sync via temporary clone + robocopy.

## Phase 0.3 — Writer Workbench Layout Prototype (COMPLETE 2026-07-22)

Verified by `docs/build/phase-0.3-acceptance-evidence.md`.

**Removed (scope creep)**
- AI suggestion tabs / review / context (assistantView, assistantHtml)
- Content annotations (contentAnnotations)
- Floating product header webview (productHeader)
- Left-side stub status items (pending / diff / tasks / backup-records)
- All stub commands: `openSampleNovel`, `focusMode`, `prevChapter`, `nextChapter`, `showPending`, `showDiff`, `showTasks`, `showBackupRecords`
- App-scope `openSampleNovel` and `forceReuseWindow` reload path

**Gated (workbench source change)**
- `editorStatus.ts` — 6 dev-oriented status items hidden when `applicationName === 'writing-buddy'` (selection, indentation, encoding, EOL, language, info)
- `markers.contribution.ts` — problems count status item gated
- `update.contribution.ts` — `UpdateTitleBarContribution` not registered (removes the "Hello" / "Sign In" chat title-bar action)
- `welcomeOnboarding.contribution.ts` — `workbench.action.welcomeOnboarding2026` becomes a no-op so "Sign-in failed" notifications can no longer fire

**Added (core loop closure)**
- `chapterMetadataView.ts` + `chapterMetadataViewProvider.ts` — static right-sidebar webview (no scripts, no network, no AI)
- Single active-chapter controller in `extension.ts` — tree, metadata view, status bar, word counts update together
- `WritingStatistics` now exposes `perChapter: Map<string, number>` from a single `loadWritingStatistics` call
- `countWords` → `countWritingUnits` with frozen Phase 0.3 algorithm and reference tests
- Second-launch restore priority 1 (Code-OSS restored editor) → 2 (lastChapterId from workspaceState) → 3 (chapter-001)
- `features.ts` — compile-time `phase03Features` gate (kept for future scope)

**Verification**
- 45/45 unit tests pass (`mocha --ui tdd`)
- `npm run compile` exits 0
- `npm run electron` regenerates `Writing Buddy.exe` (232,757,248 bytes)
- 11/11 GUI checks pass via CDP (menu hidden, activity bar hidden, breadcrumbs hidden, status bar writer-only, three chapters with word counts, placeholders, no forbidden texts, status bar shows 本章/全书/已保存)
- `git status` clean
- `git push origin` successful

## Phase 0.3 — Writing Shell Visual Correction (earlier work, kept in commits)

- Product shell: menu bar, Activity Bar, native status bar development entries, breadcrumbs, command center, workspace trust banner all hidden via `configurationDefaults` and workbench `editorStatus.ts` product check.
- Editor area: centered layout (paper canvas), serif Chinese fonts (Source Han Serif SC), 1.8 line height, no line highlight/selection/word/occurrence highlights.
- Localization: all UI in Chinese (navigation, assistant panel, status bar, commands).
- Writing Identity Gate checklist: `docs/build/writing-identity-gate-checklist.md`.

## Phase 0.4 — Writer Product Features (rolled back in Completion Pass)

Phase 0.4 added AI suggestions, content annotations, product header, and stub status items. The Completion Pass removed them again. The original Phase 0.4 commits remain in branch history (`8061ec52`, `cc812c41`, `2108d71e`, `514c39a1`) but are not part of the Phase 0.3 completion.

## Commits (this branch, newest first)

- `5c2ba2f4` fix: skip update title-bar contribution to remove Sign In button and Hello status
- `1a2c6dc2` style: simplify writer workbench shell
- `67f1c986` feat: chapter metadata panel, unified word counts, hot-exit restore
- `1efe80d1` fix: remove account sign-in from writer workbench
- `5a23fc41` refactor: gate unfinished writing assistant features (Phase 0.3 completion)
- `fed0aa82` docs: map phase 0.3 source responsibilities and add completion plan
- `60ee235e` fix: hide Sign In + problems counter, fix volume-chapter bug, GUI acceptance 9/9
- `17bbf9f4` docs: update progress and session memory for Phase 0.4 completion
- `8061ec52` feat: Phase 0.4.4-0.4.6 writer product features
- `cc812c41` ci: add CI/CD workflows for Writing Buddy
- `514c39a1` docs: add Writing Identity Gate checklist and update progress
- `2108d71e` feat: Writing Shell visual correction - transform Code-OSS into writing product

## Deferred (per Phase 0.3 completion plan, not in scope)

- AI model calls
- TipTap
- Character / worldbuilding / timeline / notes editing
- Multiple works / drag-to-reorder / cloud sync / account system
- Real backup management
- Installer and auto-update
- Unknown commit fix
- Mermaid proposal fix
