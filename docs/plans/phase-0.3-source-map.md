# Phase 0.3 Source Path Map

Mapping of the implementation to the actual codebase. Generated as Task 0 of the Phase 0.3 Completion Pass.

## Layout

| Concern | File | Notes |
| --- | --- | --- |
| Extension entry / activation | `extensions/writing-buddy/src/extension.ts` | `activate()` orchestrates providers, commands, listeners. |
| Tree data provider | `extensions/writing-buddy/src/chapterTree.ts` | `ChapterTreeDataProvider` (left navigation). |
| Chapter catalog | `extensions/writing-buddy/src/chapterCatalog.ts` | `chapters`, `ChapterDefinition`, lookups. |
| Active chapter tracking | `extensions/writing-buddy/src/extension.ts` (`trackActiveChapter`) | Wrapped in `chapterTracking.ts` queue. |
| Chapter switching queue | `extensions/writing-buddy/src/chapterTracking.ts` | `SerialOperationQueue`. |
| Sample novel bootstrap | `extensions/writing-buddy/src/novelBootstrap.ts` | `ensureSampleNovel`, `isSampleNovelWorkspace`. |
| Writing statistics service | `extensions/writing-buddy/src/writingStatistics.ts` | Aggregates word counts via `vscode.workspace.fs`. |
| Word count algorithm | `extensions/writing-buddy/src/wordCount.ts` | `countWords`. |
| Workspace state helpers | `extensions/writing-buddy/src/writingState.ts` | `WritingStatistics` type. |
| Status bar presentation | `extensions/writing-buddy/src/statusBarPresentation.ts` | Pure formatting. |
| Status bar items | `extensions/writing-buddy/src/statusBar.ts` | `WriterStatusBar` (left + right items). |
| Assistant webview HTML | `extensions/writing-buddy/src/assistantHtml.ts` | Pure-CSS tabs; suggestions/review/context. |
| Assistant view provider | `extensions/writing-buddy/src/assistantView.ts` | `AssistantViewProvider`. |
| Product header webview | `extensions/writing-buddy/src/productHeader.ts` | `ProductHeader` (chapter tabs, action buttons). |
| Content annotations | `extensions/writing-buddy/src/contentAnnotations.ts` | Monaco decorations for characters/locations/foreshadow. |
| Product shell config | `extensions/writing-buddy/src/writerShell.ts` | `applyWriterShell`. |
| Extension manifest | `extensions/writing-buddy/package.json` | Commands, views, configurationDefaults, contributes. |
| Localized strings | `extensions/writing-buddy/package.nls.json` | nls keys. |
| Workbench shell suppression | `src/vs/workbench/browser/parts/editor/editorStatus.ts` | `IProductService`-gated status bar entries. |
| Workbench problems suppression | `src/vs/workbench/contrib/markers/browser/markers.contribution.ts` | `IProductService`-gated `status.problems`. |
| Launch script | `scripts/launch-writing-buddy.bat` | Windows dev launcher. |
| Product | `product.json` | Writing Buddy branding. |

## Currently registered commands

| Command | File:line | Status under completion pass |
| --- | --- | --- |
| `writingBuddy.openSampleNovel` | `extension.ts:99` | **Disable** (boots sample workspace). |
| `writingBuddy.focusMode` | `extension.ts:102` | **Disable** (uses Zen Mode). |
| `writingBuddy.openChapter` | `extension.ts:116` | Keep. |
| `writingBuddy.prevChapter` | `extension.ts:119` | **Disable** (no longer needed; tree click suffices). |
| `writingBuddy.nextChapter` | `extension.ts:128` | **Disable**. |
| `writingBuddy.showPending` | `extension.ts:137` | **Disable** (stub). |
| `writingBuddy.showDiff` | `extension.ts:140` | **Disable** (stub). |
| `writingBuddy.showTasks` | `extension.ts:143` | **Disable** (stub). |
| `writingBuddy.showBackupRecords` | `extension.ts:146` | **Disable** (stub). |

## Currently registered views

| View | File | Status under completion pass |
| --- | --- | --- |
| `writingBuddy.novelStructure` | `package.json:53-58` (left sidebar) | Keep, restrict to one volume + three chapters. |
| `writingBuddy.sceneAssistant` | `package.json:60-67` (right auxiliary bar) | **Replace** AI webview with static metadata webview; same view id. |
| Product header (editor-area webview) | `extension.ts:170-180` | **Disable** (replaced by a minimal title). |

## Status bar items

| Item ID | Source | Status under completion pass |
| --- | --- | --- |
| `writingBuddy.pending` | `statusBar.ts:14` | **Disable**. |
| `writingBuddy.diff` | `statusBar.ts:15` | **Disable**. |
| `writingBuddy.tasks` | `statusBar.ts:16` | **Disable**. |
| `writingBuddy.backupRecord` | `statusBar.ts:17` | **Disable**. |
| `writingBuddy.localSave` | `statusBar.ts:18` | Keep. |
| `writingBuddy.backup` | `statusBar.ts:19` | **Disable**. |
| `writingBuddy.chapterWords` | `statusBar.ts:20` | Keep, simplified text. |
| `writingBuddy.todayWords` | `statusBar.ts:21` | **Disable**. |
| `writingBuddy.work` | `statusBar.ts:22` | Keep (chapter breadcrumb). |
| `status.editor.*` | workbench | Suppressed for writing-buddy via `editorStatus.ts`. |
| `status.problems` | workbench | Suppressed for writing-buddy via `markers.contribution.ts`. |
| `updateIndicator` / `update.titleBar` | workbench | **Disable** via product.json (no product service gate yet). |
| `chat.titleBarSignIn` | workbench | Suppressed via `chat.titleBarSignInEnabled: false` setting. |

## Decorations

| Concern | File | Status |
| --- | --- | --- |
| Character / location / foreshadow tags | `contentAnnotations.ts` | **Disable** (entire module removed from activation). |

## Listeners

| Event | File | Status under completion pass |
| --- | --- | --- |
| `onDidChangeActiveTextEditor` | `extension.ts:150` (queue) + `writingStatistics.ts:27` + `contentAnnotations.ts:63` | Refactor: single controller drives all consumers. |
| `onDidChangeTextDocument` | `writingStatistics.ts:28` + `contentAnnotations.ts:73` | Refactor: single controller, debounced ~200ms. |
| `onDidSaveTextDocument` | `writingStatistics.ts:33` | Keep (used for save-state signal). |
| `onDidCloseTextDocument` | `writingStatistics.ts:38` | Keep. |

## Persisted state

| Key | File | Purpose |
| --- | --- | --- |
| `writingBuddy.sampleWorkspaceOpened` | `extension.ts:18` | Track whether the sample workspace was ever opened. |
| `writingBuddy.layoutInitialized` | `extension.ts:19` | First-time layout initialisation. |
| `writingBuddy.lastChapterId` | `extension.ts:20` | Last opened chapter (workspaceState). |
| `writingBuddy.shellSettingsApplied` | `writerShell.ts` | Idempotency flag for global settings write. |
| `writingBuddy.hiddenStatusBarItems` | `writerShell.ts` | Reserved list. |

## Single-source consumers that must converge

- **Active chapter**: extension.ts queue → chapterTreeProvider.setActiveChapter + assistantProvider.setActiveChapter + writingStatistics + productHeader + statusBar
  - Target: a single `ChapterController` exposes `setActiveChapter(chapterId | undefined)` and all consumers subscribe.
- **Word count**: writingStatistics.statistics (currentChapterWords, novelWords) and chapterTree chapter word counts
  - Target: a single `WordCountService` instance shared by both the tree and the status bar.
- **Save state**: statusBar saveItem (per chapter) and productHeader saveItem
  - Target: single source reads `editor.document.isDirty`.

## Hot-exit & restore

- Code-OSS handles workspace + dirty buffers + last opened editor (hot exit).
- extension stores `writingBuddy.lastChapterId` in workspaceState for fallback.

## Risk areas

- Removing `openSampleNovel` will change behaviour for empty workspace state. The acceptance user-data ships a pre-created sample so this is safe.
- `signInIndicator` may still leak through the account menu even with `chat.titleBarSignInEnabled: false` set. Account menu suppression needs explicit handling.
- `updateIndicator` (the "Hello" item in the screenshot) is registered by a built-in dev sample or the update service — exact path needs verification.
