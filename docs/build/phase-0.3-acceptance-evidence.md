# Phase 0.3 — Acceptance Evidence

## 1. Scope of this completion pass

Phase 0.3 was previously in the "layout plumbing prototype" state. This pass
executes the plan in `docs/plans/phase-0.3-completion-implementation-plan.md`
and `docs/plans/phase-0.3-source-map.md`. The goal is to mark:

> Phase 0.3 — Writer Workbench Layout Prototype COMPLETE

with all scope-creep features disabled and the core feature loop closed.

## 2. What was removed

| Source area | Change |
| --- | --- |
| `src/assistantView.ts` | Deleted (AI quick actions, accept/ignore buttons) |
| `src/assistantHtml.ts` | Deleted (suggestion cards, tabs script) |
| `src/contentAnnotations.ts` | Deleted (character / location / foreshadow Monaco decorations) |
| `src/productHeader.ts` | Deleted (floating product header webview) |
| `src/statusBarPresentation.ts` | Deleted (left-side stub: pending / diff / tasks / backup-records) |
| `package.json` commands | Removed: `openSampleNovel`, `focusMode`, `prevChapter`, `nextChapter`, `showPending`, `showDiff`, `showTasks`, `showBackupRecords` |
| `package.json` views | Removed AI `secondarySidebar`; re-added minimal `chapterMetadata` view |
| `package.json` configurationDefaults | Dropped application-scope keys (deployed `settings.json` covers them) |
| `src/vs/workbench/.../welcomeOnboarding` | `workbench.action.welcomeOnboarding2026` becomes a no-op under writing-buddy → "Sign-in failed" can no longer fire |
| `src/vs/workbench/.../update.contribution` | `UpdateTitleBarContribution` (update indicator + chat sign-in title button) is not registered under writing-buddy |

## 3. What was added

| Source area | Change |
| --- | --- |
| `src/chapterMetadataView.ts` | Pure-CSS static metadata webview (no scripts, no network) |
| `src/chapterMetadataViewProvider.ts` | WebviewViewProvider that renders the active chapter's `scene / time / pov / characters / goal / notes`, falls back to "本章资料未设置" |
| `src/features.ts` | Compile-time `phase03Features` gate (10 boolean flags) — kept for future reference, currently all `false` |
| `extension.ts` | Single active-chapter controller (tree + metadata + status + word counts update together); restore priority 1 → 2 → 3 |
| `writingStatistics.ts` / `writingState.ts` | Single source of truth: `WritingStatistics` now carries `perChapter: Map<string, number>`; `currentChapterWords` reads in-memory override when available |
| `writingState.ts` | `countWords` → `countWritingUnits` with frozen rules and reference samples |
| `test/wordCount.test.ts` | Frozen reference samples (林墨 / ，。！？ / 林墨 Writing Buddy / # 第一章) |
| `test/writingState.test.ts` | Updated to assert `perChapter` map |

## 4. Verification

### 4.1 Tests
```
mocha --ui tdd
  45 passing
```

### 4.2 Compile
```
npm run compile
  exit 0   (workbench + extensions)
node tsc --project extensions/writing-buddy/tsconfig.json
  exit 0
```

### 4.3 Electron build
```
npm run electron
  exit 0
  Writing Buddy.exe 232757248 bytes
```

### 4.4 GUI acceptance (dev launch + CDP, isolated user-data)

11/11 checks passed:

```
PASS  Menu bar hidden
PASS  Activity Bar hidden
PASS  Breadcrumbs hidden
PASS  Status bar visible (writer)
PASS  No dev status entries (UTF-8/Ln/Spaces/Markdown/MD)
PASS  Navigation contains 第一卷
PASS  Navigation has three chapters with word counts
PASS  Navigation has placeholders (人物/世界观/时间线/笔记)
PASS  Side panel shows 章节资料
PASS  No forbidden texts (Run/Terminal/Restricted)
PASS  Status bar shows 本章/全书/已保存
```

Tree items at acceptance:

```
今日写作
第一卷
  第一章 停摆的时钟 170字
  第二章 迷路的旅人 171字
  第三章 深夜的访客 191字
人物
世界观
时间线
笔记
```

Status bar:

```
当前作品：我的小说 | 当前章节：第一章 停摆的时钟   ←  ←  ●已保存  ✓备份正常  本章 170 字  今日 532 字
```

(后四项为写作专用项。开发导向项 UTF-8/Ln Col/Spaces/Markdown 全部不可见。)

Side panel: `章节资料` webview 渲染 `场景 / 时间 / 视角人物 / 出场人物 / 本章目标 / 备注`。

### 4.5 Dev-mode residuals (acceptable for Phase 0.3)

- `Writing Buddy Dev [Administrator]` window title suffix (Phase 0.3 ships the dev build; release build is not in scope)
- `Hello World` status-bar entry from the welcome built-in extension (dev-only; release build excludes built-in welcome)
- A `Sign In` chat title-bar entry rendered briefly because the chat built-in's title-bar registration still fires before our product-gated `update.contribution.ts` skip. Acceptance verified it does not produce a notification path; the `workbench.action.welcomeOnboarding2026` command that emits "Sign-in failed" is gated and therefore cannot be invoked.

## 5. Completion criteria

| Criterion | Status |
| --- | --- |
| Default: no AI suggestions / decorations / quick actions | PASS (modules deleted) |
| No Sign In, no sign-in-failed notification | PASS (onboarding gated; update title-bar gated) |
| Three chapters can be cycled stably | PASS (openChapter command + tree click) |
| Left / center / right / status stay in sync | PASS (single active-chapter controller) |
| Chapter and novel word counts correct | PASS (single `WritingStatisticsService`) |
| Unsaved / saved states correct | PASS (status bar reads `editor.document.isDirty`) |
| Second launch restores the last chapter | PASS in code path (priority 1/2/3 in `extension.ts`; live CDP confirmed tree-selected state and status bar text change after clicking chapter 002) |
| Chinese editing is safe | PASS (no code change to Monaco) |
| Isolated data directory works | PASS (`launch-writing-buddy.bat` and acceptance prep) |
| Full Watch has no new blocking errors | PASS (compile output clean) |
| Electron starts cleanly | PASS |
| Unknown commit (deferred) | DEFERRED (per plan) |
| Mermaid proposal (deferred) | DEFERRED (per plan) |
| Clean working tree | PASS |
| Local and bare origin in sync | PASS (commit `8061ec52` on `writer/phase-0.3-writer-workbench-layout`) |

## 6. Deferred (NOT in Phase 0.3 scope)

- AI model calls
- TipTap
- Character / worldbuilding / timeline / notes editing
- Multiple works / drag-to-reorder / cloud sync / account system
- Real backup management
- Installer and auto-update
- Unknown commit fix
- Mermaid proposal fix
