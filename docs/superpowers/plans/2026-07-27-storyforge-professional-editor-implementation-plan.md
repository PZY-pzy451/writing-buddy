# StoryForge Professional Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已迁移的 Writing Buddy Tauri 客户端升级为具备场景、人物、关系、时间线、世界观、物品、剧情线、伏笔、信息权限、AI 上下文和长篇一致性审查的专业小说编辑器。

**Architecture:** 以纯 TypeScript `story-kernel` 为唯一故事事实层；React 负责产品 UI，Tauri/Rust 负责原子文件、锁、索引和安全边界。所有资源均通过 Repository、Transaction、ResourceOpenService 和 Evidence 链接，不允许 UI 直接访问文件系统，也不允许 AI 输出直接修改正式数据。

**Tech Stack:** Tauri 2、React、TypeScript、Vite、Monaco Editor、Zod、Zustand、Vitest、React Testing Library、Rust、现有 DeepSeek AI Runtime。

## Global Constraints

- 基准窗口：1536×992；机器可读布局契约：`docs/design/storyforge-ui-layout-spec-v1.json`。
- 最小窗口：1024×720。
- 所有作者正式资料写入 `story/`；派生索引与 AI 待确认资料写入 `.writing-buddy/`。
- Story Kernel 不得导入 React、Tauri、Monaco、Node `fs` 或 DeepSeek Provider。
- React 不得直接调用任意路径读写 API；通过应用服务和窄 Tauri Commands。
- 所有 AI 结果先成为候选建议，未经确认不得写入正文或正式资料。
- 每阶段必须使用真实项目副本验证，Mock 截图不作为完成证据。
- 每阶段完成后必须停止，等待人工验收，再进入下一阶段。
- TypeScript、ESLint、Rust 测试均为 0 failing。
- 依赖锁定精确版本，不使用 `latest`。

---

## Planned File Structure

```text
packages/story-kernel/src/
├─ ids/
├─ model/
├─ schema/
├─ repository/
├─ transaction/
├─ query/
├─ validation/
└─ test-support/

apps/desktop/src/features/story/
├─ application/
├─ dashboard/
├─ manuscript/
├─ characters/
├─ relationships/
├─ timeline/
├─ worldbuilding/
├─ assets/
├─ plots/
├─ information/
├─ continuity/
├─ ai-context/
└─ shared/

apps/desktop/src-tauri/src/story/
├─ commands.rs
├─ storage.rs
├─ lock.rs
├─ index.rs
└─ errors.rs
```

若实际仓库路径不同，Task 0 只能更新 `docs/plans/storyforge-source-map.md` 与本计划的“路径映射附录”，不得创建平行第二套目录。

---

### Task 0: Freeze Source Map and Baseline

**Files:**
- Create: `docs/plans/storyforge-source-map.md`
- Create: `docs/acceptance/storyforge-baseline.md`
- Copy: `docs/design/storyforge-ui-layout-spec-v1.json`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: existing project-open flow, app routes, resource tabs, DeepSeek runtime, version/backup services.
- Produces: exact path map used by every later task.

- [ ] **Step 1: Record current repository map**

Document exact paths for App shell, router, stores, Monaco editor, Tauri commands, project repository, AI runtime, review, version, backup and tests.

- [ ] **Step 2: Run current baseline**

Run:

```powershell
pnpm test
pnpm lint
pnpm typecheck
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: record exact passing/failing counts without correcting them in this task.

- [ ] **Step 3: Capture current failure reproduction**

Open the current build, click “选择项目”, reproduce “无法打开作品”, and record public error, logs, path and failed command in `storyforge-baseline.md`.

- [ ] **Step 4: Copy design contract**

Place `storyforge-ui-layout-spec-v1.json` under `docs/design/` and add its schema/version to the source map.

- [ ] **Step 5: Commit**

```bash
git add docs

git commit -m "docs: freeze storyforge source map and baseline"
```

---

### Task 1: Repair Project Open and Diagnostic Flow

**Files:**
- Modify: `apps/desktop/src/features/projects/application/ProjectOpenService.ts`
- Modify: `apps/desktop/src/features/projects/ui/OpenProjectView.tsx`
- Create: `apps/desktop/src/features/projects/ui/ProjectOpenErrorDialog.tsx`
- Modify: `apps/desktop/src-tauri/src/projects/commands.rs`
- Test: `apps/desktop/src/features/projects/application/ProjectOpenService.test.ts`
- Test: `apps/desktop/src/features/projects/ui/ProjectOpenErrorDialog.test.tsx`
- Test: `apps/desktop/src-tauri/src/projects/tests.rs`

**Interfaces:**
- Produces: `ProjectOpenResult`, `PublicProjectOpenError`, `openProjectReadOnly(path)`, `openProjectReadWrite(path)`.

```ts
export type ProjectOpenStage =
  | 'select-path' | 'read-manifest' | 'validate-schema'
  | 'acquire-lock' | 'integrity-scan' | 'load-index';

export interface PublicProjectOpenError {
  code: string;
  stage: ProjectOpenStage;
  safePath?: string;
  canOpenReadOnly: boolean;
  canRepair: boolean;
  diagnosticId: string;
}
```

- [ ] **Step 1: Write failing service tests**

Cover successful open, missing `project.json`, unsupported schema, lock conflict, read-only fallback and diagnostic redaction.

- [ ] **Step 2: Run focused tests**

```powershell
pnpm vitest run apps/desktop/src/features/projects/application/ProjectOpenService.test.ts
```

Expected: FAIL because structured error/result is not implemented.

- [ ] **Step 3: Implement structured open flow**

Implement stage-by-stage results; never collapse all errors to “无法打开作品”.

- [ ] **Step 4: Implement dialog UX**

Buttons: `重试`, `只读打开`, `修复项目`, `打开目录`, `查看诊断`, `关闭`. Hide unavailable actions based on error capabilities.

- [ ] **Step 5: Verify real sample project**

Open a sanitized legacy project copy, close, reopen and verify recent-project recovery.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/features/projects apps/desktop/src-tauri/src/projects

git commit -m "fix: make project opening diagnosable and recoverable"
```

---

### Task 2: Add Story Kernel IDs, Positions and Evidence

**Files:**
- Create: `packages/story-kernel/src/ids/StoryId.ts`
- Create: `packages/story-kernel/src/model/StoryPosition.ts`
- Create: `packages/story-kernel/src/model/EvidenceRef.ts`
- Create: `packages/story-kernel/src/model/StoryResourceBase.ts`
- Create: `packages/story-kernel/src/index.ts`
- Test: `packages/story-kernel/src/model/model.test.ts`

**Interfaces:**
- Produces: `StoryId`, `StoryPosition`, `EvidenceRef`, `StoryResourceBase`.

```ts
export type StoryId = string & { readonly __brand: 'StoryId' };
export function parseStoryId(value: string): StoryId;
export function createStoryId(prefix: string): StoryId;
```

- [ ] **Step 1: Write failing ID and model tests**

Tests reject whitespace, path separators, duplicate prefixes and invalid narrative order.

- [ ] **Step 2: Run tests**

```powershell
pnpm vitest run packages/story-kernel/src/model/model.test.ts
```

Expected: FAIL because package is absent.

- [ ] **Step 3: Implement minimal pure TypeScript models**

No React/Tauri imports. Use deterministic validation and ISO UTC strings.

- [ ] **Step 4: Run package tests and typecheck**

```powershell
pnpm vitest run packages/story-kernel
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/story-kernel

git commit -m "feat: add story kernel identity position and evidence models"
```

---

### Task 3: Add Story Schemas and File Layout

**Files:**
- Create: `packages/story-kernel/src/schema/storyManifestSchema.ts`
- Create: `packages/story-kernel/src/schema/resourceSchemas.ts`
- Create: `packages/story-kernel/src/schema/schemaRegistry.ts`
- Create: `packages/story-kernel/src/repository/StoryPaths.ts`
- Test: `packages/story-kernel/src/schema/schemaRegistry.test.ts`

**Interfaces:**
- Produces: `StorySchemaRegistry.parse(type, json)`, `StoryPaths.forResource(root,type,id)`.

- [ ] **Step 1: Write fixture-based schema tests**

Create valid/invalid fixtures for character, scene, relationship, event and item.

- [ ] **Step 2: Verify tests fail**

```powershell
pnpm vitest run packages/story-kernel/src/schema/schemaRegistry.test.ts
```

- [ ] **Step 3: Implement schema registry**

Use Zod; every schema has explicit `schemaVersion: 1`. Unknown fields are retained only where the current repository convention requires forward compatibility; document the decision.

- [ ] **Step 4: Implement path rules**

Map formal data to `story/<type>/<id>.json`; reject absolute paths, `..`, reserved names and separator-containing IDs.

- [ ] **Step 5: Commit**

```bash
git add packages/story-kernel/src/schema packages/story-kernel/src/repository

git commit -m "feat: define story resource schemas and safe file layout"
```

---

### Task 4: Implement Story Repository and Transactions

**Files:**
- Create: `packages/story-kernel/src/repository/StoryRepository.ts`
- Create: `packages/story-kernel/src/transaction/StoryTransaction.ts`
- Create: `apps/desktop/src-tauri/src/story/storage.rs`
- Create: `apps/desktop/src-tauri/src/story/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Test: `packages/story-kernel/src/repository/StoryRepository.test.ts`
- Test: `apps/desktop/src-tauri/src/story/tests.rs`

**Interfaces:**

```ts
export interface StoryRepository {
  get<T>(type: StoryResourceType, id: StoryId): Promise<T | undefined>;
  list<T>(type: StoryResourceType): Promise<readonly T[]>;
  save<T extends StoryResourceBase>(resource: T, expectedRevision?: number): Promise<T>;
  moveToTrash(type: StoryResourceType, id: StoryId): Promise<void>;
}
```

- [ ] **Step 1: Write revision-conflict and atomicity tests**

Test successful save, stale revision, invalid schema, partial staging failure and trash recovery.

- [ ] **Step 2: Run tests and confirm failure**

- [ ] **Step 3: Implement Rust narrow commands**

Commands accept project-relative resource identity, not arbitrary paths. Use staging file, flush, validate and atomic replace.

- [ ] **Step 4: Implement TypeScript repository adapter**

Convert Tauri public errors into domain errors; do not leak Rust paths/backtraces.

- [ ] **Step 5: Verify backup/version integration hook**

Saving formal story resources must emit the existing “project content changed” event used by snapshot triggers.

- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel apps/desktop/src-tauri/src/story apps/desktop/src-tauri/src/lib.rs

git commit -m "feat: add atomic story repository and revision transactions"
```

---

### Task 5: Add Resource Registry, Routes and Tabs

**Files:**
- Create: `apps/desktop/src/features/story/application/StoryResourceRegistry.ts`
- Create: `apps/desktop/src/features/story/application/StoryResourceOpenService.ts`
- Modify: `apps/desktop/src/app/routes.tsx`
- Modify: `apps/desktop/src/features/workspace/ResourceTabManager.ts`
- Test: `apps/desktop/src/features/story/application/StoryResourceOpenService.test.ts`

**Interfaces:**
- Produces: `openStoryResource({type,id})`, route `story/:type/:id`, tab key `story:<type>:<id>`.

- [ ] **Step 1: Write open/deduplicate/restore tests**
- [ ] **Step 2: Run tests and confirm failure**
- [ ] **Step 3: Register all resource types with placeholder views**
- [ ] **Step 4: Add persisted tab restoration**

Missing/deleted resources open an explicit “资源不存在” recovery view instead of crashing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/features/story apps/desktop/src/app/routes.tsx apps/desktop/src/features/workspace

git commit -m "feat: make story resources first-class workspace tabs"
```

---

### Task 6: Implement Story Dashboard

**Files:**
- Create: `apps/desktop/src/features/story/dashboard/StoryDashboardPage.tsx`
- Create: `apps/desktop/src/features/story/dashboard/dashboardSelectors.ts`
- Create: `apps/desktop/src/features/story/dashboard/StoryDashboardPage.css`
- Test: `apps/desktop/src/features/story/dashboard/StoryDashboardPage.test.tsx`

**Interfaces:**
- Consumes: project session, recent chapter, plot summary, review counts, pending facts.

- [ ] **Step 1: Write empty/loading/error/populated UI tests**
- [ ] **Step 2: Implement exact baseline layout from JSON coordinates**
- [ ] **Step 3: Add card navigation and keyboard focus**
- [ ] **Step 4: Verify at 1536×992, 1280×800 and 1024×720**
- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/features/story/dashboard

git commit -m "feat: add project story dashboard"
```

---

### Task 7: Implement Scene Model and Chapter Integration

**Files:**
- Create: `packages/story-kernel/src/model/Scene.ts`
- Create: `apps/desktop/src/features/story/manuscript/SceneService.ts`
- Create: `apps/desktop/src/features/story/manuscript/SceneNavigator.tsx`
- Modify: `apps/desktop/src/features/editor/ChapterEditor.tsx`
- Test: `apps/desktop/src/features/story/manuscript/SceneService.test.ts`
- Test: `apps/desktop/src/features/story/manuscript/SceneNavigator.test.tsx`

**Interfaces:**
- Produces: `createScene`, `updateSceneRange`, `findSceneAtOffset`, `listScenesForChapter`.

- [ ] **Step 1: Write scene range and overlap tests**
- [ ] **Step 2: Implement scene schema/service**
- [ ] **Step 3: Add scene gutter marker and navigator**
- [ ] **Step 4: Add unlink-vs-delete confirmation**
- [ ] **Step 5: Verify Markdown bytes are unchanged by metadata-only edits**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model/Scene.ts apps/desktop/src/features/story/manuscript apps/desktop/src/features/editor/ChapterEditor.tsx

git commit -m "feat: add scene metadata and manuscript navigation"
```

---

### Task 8: Implement Mentions and Backlinks

**Files:**
- Create: `packages/story-kernel/src/model/MentionLink.ts`
- Create: `apps/desktop/src/features/story/manuscript/MentionService.ts`
- Create: `apps/desktop/src/features/story/shared/BacklinksPanel.tsx`
- Modify: `apps/desktop/src/features/editor/ChapterEditor.tsx`
- Test: `apps/desktop/src/features/story/manuscript/MentionService.test.ts`

**Interfaces:**
- Produces: `linkSelection`, `rebaseMentions`, `listBacklinks(resourceId)`.

- [ ] **Step 1: Write anchor rebase and stale tests**
- [ ] **Step 2: Implement mention persistence outside Markdown**
- [ ] **Step 3: Add selection action menu**

Actions: existing resource, create character, create location, create item, reveal information, create foreshadowing.

- [ ] **Step 4: Add hover/open behavior and backlinks**
- [ ] **Step 5: Verify Undo only affects text edits, not confirmed resource creation unless in the same explicit transaction**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model/MentionLink.ts apps/desktop/src/features/story/manuscript apps/desktop/src/features/story/shared apps/desktop/src/features/editor/ChapterEditor.tsx

git commit -m "feat: link manuscript text to story resources"
```

---

### Task 9: Implement Character Center and State History

**Files:**
- Create: `packages/story-kernel/src/model/Character.ts`
- Create: `packages/story-kernel/src/model/StateRecord.ts`
- Create: `apps/desktop/src/features/story/characters/CharacterCenterPage.tsx`
- Create: `apps/desktop/src/features/story/characters/CharacterEditor.tsx`
- Create: `apps/desktop/src/features/story/characters/CharacterStateTimeline.tsx`
- Test: `apps/desktop/src/features/story/characters/CharacterCenterPage.test.tsx`
- Test: `packages/story-kernel/src/model/StateRecord.test.ts`

**Interfaces:**
- Produces: `Character`, `CharacterStateKind`, `getStateAt(position)`.

- [ ] **Step 1: Write character/state interval tests**
- [ ] **Step 2: Implement model and query**
- [ ] **Step 3: Implement three-column UI at specified coordinates**
- [ ] **Step 4: Add tabs and unsaved-form guard**
- [ ] **Step 5: Add evidence/conflict display**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model apps/desktop/src/features/story/characters

git commit -m "feat: add character center and position-aware states"
```

---

### Task 10: Implement Directed Relationship Model, Graph and Matrix

**Files:**
- Create: `packages/story-kernel/src/model/Relationship.ts`
- Create: `apps/desktop/src/features/story/relationships/RelationshipService.ts`
- Create: `apps/desktop/src/features/story/relationships/RelationshipGraphPage.tsx`
- Create: `apps/desktop/src/features/story/relationships/RelationshipMatrix.tsx`
- Create: `apps/desktop/src/features/story/relationships/RelationshipInspector.tsx`
- Create: `apps/desktop/src/features/story/relationships/layout.worker.ts`
- Test: `apps/desktop/src/features/story/relationships/RelationshipService.test.ts`
- Test: `apps/desktop/src/features/story/relationships/RelationshipGraphPage.test.tsx`

**Interfaces:**
- Produces: `getRelationshipsAt(position)`, `upsertRelationship`, `relationship graph view model`.

- [ ] **Step 1: Write direction/time-slice tests**
- [ ] **Step 2: Implement model and service**
- [ ] **Step 3: Implement accessible matrix first**
- [ ] **Step 4: Implement graph with worker layout and 150-node limit**
- [ ] **Step 5: Add inspector/evidence/history**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model/Relationship.ts apps/desktop/src/features/story/relationships

git commit -m "feat: add time-aware character relationship graph and matrix"
```

---

### Task 11: Implement Timeline Events and Multi-track View

**Files:**
- Create: `packages/story-kernel/src/model/TimelineEvent.ts`
- Create: `packages/story-kernel/src/query/TimelineQuery.ts`
- Create: `apps/desktop/src/features/story/timeline/TimelinePage.tsx`
- Create: `apps/desktop/src/features/story/timeline/TimelineCanvas.tsx`
- Create: `apps/desktop/src/features/story/timeline/EventInspector.tsx`
- Test: `packages/story-kernel/src/query/TimelineQuery.test.ts`
- Test: `apps/desktop/src/features/story/timeline/TimelinePage.test.tsx`

**Interfaces:**
- Produces: `queryEvents(window, filters, mode)`, modes `story-time|narrative-order`.

- [ ] **Step 1: Write ordering/range/filter tests**
- [ ] **Step 2: Implement event schema/query**
- [ ] **Step 3: Implement virtualized tracks and zoom**
- [ ] **Step 4: Implement event creation/edit drawer**
- [ ] **Step 5: Add keyboard navigation and list fallback**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model/TimelineEvent.ts packages/story-kernel/src/query/TimelineQuery.ts apps/desktop/src/features/story/timeline

git commit -m "feat: add story and narrative timeline views"
```

---

### Task 12: Add Deterministic Time and Location Rules

**Files:**
- Create: `packages/story-kernel/src/validation/timeRules.ts`
- Create: `packages/story-kernel/src/validation/locationRules.ts`
- Create: `packages/story-kernel/src/validation/RuleIssue.ts`
- Test: `packages/story-kernel/src/validation/timeRules.test.ts`

**Interfaces:**
- Produces: `runTimelineRules(projectSnapshot): RuleIssue[]`.

- [ ] **Step 1: Write tests for impossible overlap, predecessor inversion and insufficient travel time**
- [ ] **Step 2: Implement pure deterministic rules**
- [ ] **Step 3: Map results into existing ReviewIssue adapter**
- [ ] **Step 4: Verify issues locate both evidence positions**
- [ ] **Step 5: Commit**

```bash
git add packages/story-kernel/src/validation

git commit -m "feat: detect deterministic timeline and location conflicts"
```

---

### Task 13: Implement Worldbuilding, Locations and Rules

**Files:**
- Create: `packages/story-kernel/src/model/Location.ts`
- Create: `packages/story-kernel/src/model/Faction.ts`
- Create: `packages/story-kernel/src/model/WorldRule.ts`
- Create: `apps/desktop/src/features/story/worldbuilding/WorldbuildingPage.tsx`
- Create: `apps/desktop/src/features/story/worldbuilding/LocationTree.tsx`
- Create: `apps/desktop/src/features/story/worldbuilding/WorldRuleEditor.tsx`
- Test: `apps/desktop/src/features/story/worldbuilding/WorldbuildingPage.test.tsx`

- [ ] **Step 1: Write hierarchy-cycle and travel-link tests**
- [ ] **Step 2: Implement models**
- [ ] **Step 3: Implement tree/list/detail UI**
- [ ] **Step 4: Add static map image and point placement only**
- [ ] **Step 5: Add backlinks and evidence**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model apps/desktop/src/features/story/worldbuilding

git commit -m "feat: add structured worldbuilding and location hierarchy"
```

---

### Task 14: Implement Story Assets and Ownership History

**Files:**
- Create: `packages/story-kernel/src/model/StoryItem.ts`
- Create: `packages/story-kernel/src/model/ItemState.ts`
- Create: `apps/desktop/src/features/story/assets/StoryAssetsPage.tsx`
- Create: `apps/desktop/src/features/story/assets/ItemTransferDialog.tsx`
- Create: `packages/story-kernel/src/validation/itemRules.ts`
- Test: `packages/story-kernel/src/validation/itemRules.test.ts`
- Test: `apps/desktop/src/features/story/assets/ItemTransferDialog.test.tsx`

- [ ] **Step 1: Write unique-item, negative-quantity and transfer-overlap tests**
- [ ] **Step 2: Implement item/state models**
- [ ] **Step 3: Implement list/detail/history UI**
- [ ] **Step 4: Implement transfer transaction and impact preview**
- [ ] **Step 5: Map conflicts into ReviewIssue**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model packages/story-kernel/src/validation/itemRules.ts apps/desktop/src/features/story/assets

git commit -m "feat: track story assets ownership quantity and condition"
```

---

### Task 15: Implement Plot Threads and Foreshadowing

**Files:**
- Create: `packages/story-kernel/src/model/PlotThread.ts`
- Create: `packages/story-kernel/src/model/Foreshadowing.ts`
- Create: `apps/desktop/src/features/story/plots/PlotBoardPage.tsx`
- Create: `apps/desktop/src/features/story/plots/ForeshadowingTable.tsx`
- Create: `packages/story-kernel/src/validation/plotRules.ts`
- Test: `packages/story-kernel/src/validation/plotRules.test.ts`

- [ ] **Step 1: Write lifecycle/overdue tests**
- [ ] **Step 2: Implement schemas and queries**
- [ ] **Step 3: Implement keyboard-accessible board and table**
- [ ] **Step 4: Add chapter coverage visualization**
- [ ] **Step 5: Add at-risk/overdue review issues**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model packages/story-kernel/src/validation/plotRules.ts apps/desktop/src/features/story/plots

git commit -m "feat: manage plot threads and foreshadowing lifecycle"
```

---

### Task 16: Implement Information Control Matrix

**Files:**
- Create: `packages/story-kernel/src/model/StoryInformation.ts`
- Create: `packages/story-kernel/src/model/KnowledgeState.ts`
- Create: `apps/desktop/src/features/story/information/InformationControlPage.tsx`
- Create: `apps/desktop/src/features/story/information/KnowledgeMatrix.tsx`
- Test: `packages/story-kernel/src/model/KnowledgeState.test.ts`
- Test: `apps/desktop/src/features/story/information/KnowledgeMatrix.test.tsx`

- [ ] **Step 1: Write chapter-time-slice knowledge tests**
- [ ] **Step 2: Implement fact/knowledge models**
- [ ] **Step 3: Implement fact list and virtualized matrix**
- [ ] **Step 4: Add author-secret default exclusion flag**
- [ ] **Step 5: Add premature-reveal rule output**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model apps/desktop/src/features/story/information

git commit -m "feat: track truth character knowledge and reader revelation"
```

---

### Task 17: Build Context Pack Engine

**Files:**
- Create: `packages/story-kernel/src/query/ContextPackBuilder.ts`
- Create: `packages/story-kernel/src/query/TokenBudgetPolicy.ts`
- Create: `apps/desktop/src/features/story/ai-context/ContextPackPreview.tsx`
- Test: `packages/story-kernel/src/query/ContextPackBuilder.test.ts`
- Test: `apps/desktop/src/features/story/ai-context/ContextPackPreview.test.tsx`

**Interfaces:**

```ts
export interface ContextPackBuilder {
  build(request: ContextPackRequest): Promise<ContextPack>;
}
```

- [ ] **Step 1: Write priority, deduplication and secret-exclusion tests**
- [ ] **Step 2: Implement deterministic context selection**
- [ ] **Step 3: Implement token-budget trimming from P6 upward**
- [ ] **Step 4: Implement preview with per-item include toggles**
- [ ] **Step 5: Verify no project path/API key/full chapter is included**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/query apps/desktop/src/features/story/ai-context

git commit -m "feat: build author-visible grounded ai context packs"
```

---

### Task 18: Implement Selection Rewrite with Diff and Undo

**Files:**
- Create: `apps/desktop/src/features/story/ai-context/SelectionRewriteService.ts`
- Create: `apps/desktop/src/features/story/ai-context/SelectionRewritePanel.tsx`
- Create: `apps/desktop/src/features/story/ai-context/CandidateDiffView.tsx`
- Modify: `apps/desktop/src/features/editor/ChapterEditor.tsx`
- Test: `apps/desktop/src/features/story/ai-context/SelectionRewriteService.test.ts`
- Test: `apps/desktop/src/features/story/ai-context/SelectionRewritePanel.test.tsx`

**Interfaces:**
- Consumes: existing DeepSeek runtime and `ContextPackBuilder`.
- Produces: `RewriteCandidate` containing source revision/range, suggestion, rationale, usage.

- [ ] **Step 1: Write candidate/stale/accept/undo tests**
- [ ] **Step 2: Add editor selection action**
- [ ] **Step 3: Stream result into candidate panel**
- [ ] **Step 4: Add Monaco diff and partial/full accept**
- [ ] **Step 5: Apply through existing edit transaction and verify Undo**
- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/features/story/ai-context apps/desktop/src/features/editor/ChapterEditor.tsx

git commit -m "feat: add grounded selection rewrite with diff and undo"
```

---

### Task 19: Add AI Extraction Pending Facts

**Files:**
- Create: `apps/desktop/src/features/story/ai-context/StoryExtractionService.ts`
- Create: `apps/desktop/src/features/story/ai-context/PendingFactsReview.tsx`
- Create: `packages/story-kernel/src/model/PendingFact.ts`
- Test: `apps/desktop/src/features/story/ai-context/StoryExtractionService.test.ts`

- [ ] **Step 1: Write structured validation and no-auto-confirm tests**
- [ ] **Step 2: Add JSON-only extraction prompt contract**
- [ ] **Step 3: Store results under `.writing-buddy/ai/pending-facts/`**
- [ ] **Step 4: Implement accept/edit/reject one item at a time**
- [ ] **Step 5: On accept, require Evidence and StoryPosition**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/model/PendingFact.ts apps/desktop/src/features/story/ai-context

git commit -m "feat: review ai extracted story facts before confirmation"
```

---

### Task 20: Implement Unified Continuity Review

**Files:**
- Create: `packages/story-kernel/src/validation/ContinuityEngine.ts`
- Create: `apps/desktop/src/features/story/continuity/ContinuityReviewPage.tsx`
- Create: `apps/desktop/src/features/story/continuity/IssueEvidenceView.tsx`
- Modify: `apps/desktop/src/features/review/ReviewRepository.ts`
- Test: `packages/story-kernel/src/validation/ContinuityEngine.test.ts`
- Test: `apps/desktop/src/features/story/continuity/ContinuityReviewPage.test.tsx`

- [ ] **Step 1: Write aggregation/dedup/stale tests**
- [ ] **Step 2: Aggregate rule, kernel and AI issues**
- [ ] **Step 3: Implement severity/list/detail UI**
- [ ] **Step 4: Ensure AI issues max at warning by default**
- [ ] **Step 5: Add two-source navigation and resolution state**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/validation/ContinuityEngine.ts apps/desktop/src/features/story/continuity apps/desktop/src/features/review/ReviewRepository.ts

git commit -m "feat: unify long-form continuity review across story data"
```

---

### Task 21: Add Indexing, Virtualization and Performance Gates

**Files:**
- Create: `apps/desktop/src-tauri/src/story/index.rs`
- Create: `apps/desktop/src/features/story/application/StoryIndexService.ts`
- Create: `scripts/perf/measure-storyforge.ps1`
- Create: `fixtures/performance/storyforge-large-project/manifest.json`
- Test: `apps/desktop/src-tauri/src/story/index_tests.rs`

- [ ] **Step 1: Generate deterministic large fixture**

Fixture: 1000 chapters, 10000 scenes, 5000 resources, 50000 events/states and 200000 mentions without copyrighted prose.

- [ ] **Step 2: Write incremental-index tests**
- [ ] **Step 3: Implement rebuildable derived index**
- [ ] **Step 4: Add list/timeline virtualization**
- [ ] **Step 5: Run and record performance gates**

```text
Project interactive < 2.5s
Resource switch < 200ms
Single-resource save < 300ms
Timeline feedback < 100ms
Filtered graph < 1s
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/story/index.rs apps/desktop/src/features/story/application/StoryIndexService.ts scripts/perf fixtures/performance

git commit -m "perf: add incremental story indexes and scale gates"
```

---

### Task 22: Accessibility, Responsive Layout and Visual Acceptance

**Files:**
- Modify: `apps/desktop/src/features/story/**/*.css`
- Create: `docs/acceptance/storyforge-visual-checklist.md`
- Create: `apps/desktop/tests/e2e/storyforge-layout.spec.ts`

- [ ] **Step 1: Add viewport tests**

Test 1536×992, 1280×800 and 1024×720. Verify no overlap, inaccessible controls or horizontal page scroll.

- [ ] **Step 2: Add keyboard tests**

Resource navigation, matrix, timeline list fallback, drawers, dialogs, focus return.

- [ ] **Step 3: Add contrast/reduced-motion checks**
- [ ] **Step 4: Capture real-data screenshots matching six approved prototypes**
- [ ] **Step 5: Record intentional differences**
- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/features/story apps/desktop/tests/e2e docs/acceptance/storyforge-visual-checklist.md

git commit -m "test: verify storyforge responsive and accessible layouts"
```

---

### Task 23: Migration, Version, Backup and Recovery Acceptance

**Files:**
- Create: `packages/story-kernel/src/schema/migrations/v0-to-v1.ts`
- Create: `docs/acceptance/storyforge-data-recovery.md`
- Modify: existing version snapshot inclusion policy
- Modify: existing `.wbbackup` manifest inclusion policy
- Test: `packages/story-kernel/src/schema/migrations/v0-to-v1.test.ts`

- [ ] **Step 1: Write staging/rollback migration tests**
- [ ] **Step 2: Include `story/` in snapshot and backup**
- [ ] **Step 3: Exclude rebuildable indexes and AI temporary files**
- [ ] **Step 4: Run backup/restore on real project copy**
- [ ] **Step 5: Verify second launch and all backlinks**
- [ ] **Step 6: Commit**

```bash
git add packages/story-kernel/src/schema/migrations docs/acceptance/storyforge-data-recovery.md

git commit -m "feat: protect story kernel data with migration version and backup"
```

---

### Task 24: End-to-End Professional Slice and Documentation

**Files:**
- Create: `apps/desktop/tests/e2e/storyforge-professional-slice.spec.ts`
- Create: `docs/user/storyforge.md`
- Create: `docs/architecture/story-kernel.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: Automate the vertical slice where possible**

Open project copy, create scene/character/location/item/event/relationship, transfer item, run review, generate AI rewrite, accept, undo, snapshot, backup, restart and restore.

- [ ] **Step 2: Run complete gates**

```powershell
pnpm test
pnpm lint
pnpm typecheck
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm tauri build
```

- [ ] **Step 3: Run manual real-data acceptance**

Use only sanitized sample content; record screenshots and hashes.

- [ ] **Step 4: Write known limitations**

Explicitly state no cloud sync, collaboration, whole-book auto-generation, advanced fictional calendar or complex map editor.

- [ ] **Step 5: Create tag only after evidence**

```bash
git tag -a baseline-writing-buddy-storyforge-professional-v1 -m "StoryForge professional editor baseline"
git push origin baseline-writing-buddy-storyforge-professional-v1
```

- [ ] **Step 6: Commit documentation**

```bash
git add apps/desktop/tests/e2e docs

git commit -m "docs: record storyforge professional editor acceptance"
```

---

## Phase Gates

Codex must stop at these gates:

```text
Gate A: Task 1 – project opening real acceptance
Gate B: Tasks 2–8 – Story Kernel + scene + mentions
Gate C: Tasks 9–12 – character, relations and timeline
Gate D: Tasks 13–16 – world, assets, plot and information
Gate E: Tasks 17–20 – grounded AI and continuity
Gate F: Tasks 21–24 – scale, recovery and final acceptance
```

At each gate output:

1. commits;
2. changed files;
3. tests and exact counts;
4. real screenshots;
5. data compatibility result;
6. known issues;
7. recommendation whether the next gate may start.

Do not continue automatically.

---

## Repository path mapping appendix

Frozen against commit
`7e658a284920b0e61d42da39a0addaa39bd6b11d` on 2026-07-27.
The detailed authority is `docs/plans/storyforge-source-map.md`.

| Planned area | Actual repository path |
| --- | --- |
| App shell | `apps/desktop/src/app/App.tsx` |
| Router | No React Router; `RailMode`/`activeMode` in `apps/desktop/src/app/store.ts` with `GlobalRail.tsx` and `SystemPage.tsx` |
| Project open | `apps/desktop/src/app/store.ts` → `apps/desktop/src/platform/bridge.ts` → `apps/desktop/src-tauri/src/commands/mod.rs` → `apps/desktop/src-tauri/src/migration/mod.rs` |
| Project lock | `apps/desktop/src-tauri/src/process_lock/mod.rs` |
| Filesystem | `apps/desktop/src-tauri/src/filesystem/mod.rs` |
| Resource tabs | `packages/project/src/index.ts`, `apps/desktop/src/workspace/ResourceTabs.tsx` |
| Monaco | `apps/desktop/src/editor/ChapterEditor.tsx`, `apps/desktop/src/editor/monacoBootstrap.ts` |
| Review | `packages/review/src/index.ts`, `apps/desktop/src/features/review/ReviewPage.tsx`, `apps/desktop/src/review/TaskDock.tsx` |
| Version/backup | `packages/version`, `packages/backup`, `apps/desktop/src-tauri/src/archive/mod.rs`, `apps/desktop/src-tauri/src/commands/mod.rs` |
| DeepSeek runtime | `packages/ai`, `apps/desktop/src/features/ai`, `apps/desktop/src-tauri/src/ai` |
| Tests/build | `apps/desktop/tests`, `packages/*/src/*.test.ts`, inline Rust tests, root/app package scripts |

Gate A will create a focused TypeScript ProjectOpenService and error dialog,
but will wire them into the existing store/App shell. Rust project commands
remain in the existing command/migration modules. No parallel project module
or second router is allowed.
