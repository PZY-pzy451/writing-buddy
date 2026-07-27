# StoryForge AI Quick Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已经可用的 DeepSeek AI Runtime 接入 Writing Buddy 的正文、人物、关系、世界观、时间线、物品、剧情线和伏笔工作流，并建立统一的生成、提取、预览、确认和应用机制。

**Architecture:** 先盘点并复用现有 AI Runtime、Repository 和 UI Shell，再增加 AI Action Registry、Context Pack、Prompt Registry 与统一 Generation Drawer。所有 AI 输出必须经 Schema 校验和 Preview Transaction，正文使用 Diff，结构化资料使用字段或候选级勾选确认。

**Tech Stack:** 当前 Writing Buddy Tauri/React/TypeScript/Rust 技术栈；现有 DeepSeek Provider；现有状态管理、Repository、Version、Review 和 Theme 实现。

## Global Constraints

- 不创建第二套 DeepSeek Provider、密钥存储、SSE 解析或 Token Usage 系统。
- 先创建 Source Map，再决定真实文件路径；本文建议路径不得覆盖仓库既有惯例。
- AI 不得自动写入正文或 Story Kernel。
- 所有结构化输出必须通过版本化 Schema。
- 所有写入前验证资源 revision；变化后候选进入 stale。
- 用户未明确选择时，不发送整章、整卷、完整项目或作者秘密。
- 每个 Gate 必须有自动测试、真实 UI 截图、兼容性报告和 Git commit。
- 不使用 `latest` 依赖。
- 不修改当前可用 DeepSeek API 行为，除非测试证明存在缺陷。

---

## Gate A — 盘点与公共基础

### Task 1: Source Map 与能力矩阵

**Files:**
- Create: `docs/plans/ai-quick-actions-source-map.md`
- Create: `docs/plans/ai-current-capability-matrix.md`
- Modify: `docs/migration/status.md`（若存在）

**Produces:**
- 现有 AI Runtime、Tauri Commands、Provider、Settings、Usage、Playground 的准确路径。
- Project/Chapter/Character/World/Timeline/Item/Plot/Foreshadowing/Review/Version 的实现状态。
- 建议设计路径到真实路径的映射。

- [ ] 搜索现有 AI、DeepSeek、stream、usage、cancel、settings、project、resource、review、version 模块。
- [ ] 记录真实接口签名和依赖方向。
- [ ] 对每个目标模块标记：`complete / partial / shell / missing`。
- [ ] 运行当前测试、lint、typecheck、Rust test 和应用启动。
- [ ] 将真实基线写入 Source Map。
- [ ] 提交：

```bash
git commit -m "docs: map existing ai and story capabilities"
```

### Task 2: AI Action Core 契约

**Suggested Files — map first:**
- Create: `packages/ai-actions/src/action/AiActionDefinition.ts`
- Create: `packages/ai-actions/src/action/AiActionRegistry.ts`
- Create: `packages/ai-actions/src/action/AiApplyPolicy.ts`
- Test: `packages/ai-actions/src/action/AiActionRegistry.test.ts`

**Interfaces:**
- Consumes: 现有 Provider/Job Runtime。
- Produces: `AiActionDefinition`, `AiActionRegistry.register/get/listAvailable`。

- [ ] 为重复 ID、未知 ID、Availability 和分类过滤写失败测试。
- [ ] 运行单测并确认失败。
- [ ] 实现最小 Registry。
- [ ] 注册一个测试 Action，不接 UI。
- [ ] 运行测试。
- [ ] 提交：

```bash
git commit -m "feat: add reusable ai action registry"
```

### Task 3: Prompt Registry 与版本

**Files:**
- Create: `packages/ai-actions/src/prompt/PromptTemplate.ts`
- Create: `packages/ai-actions/src/prompt/PromptRegistry.ts`
- Test: `packages/ai-actions/src/prompt/PromptRegistry.test.ts`

**Produces:**
- `PromptRegistry.get(templateId, version?)`
- Prompt 版本、Schema 版本进入 Job metadata。

- [ ] 编写模板不存在、重复版本和默认最新版本测试。
- [ ] 实现 Registry。
- [ ] 将 Playground 的系统提示抽成模板，验证不改变当前输出链。
- [ ] 测试日志不记录完整 Prompt。
- [ ] 提交：

```bash
git commit -m "feat: add versioned ai prompt registry"
```

### Task 4: Structured Output Validator

**Files:**
- Create: `packages/ai-actions/src/output/AiOutputValidator.ts`
- Create: `packages/ai-actions/src/output/AiOutputError.ts`
- Test: `packages/ai-actions/src/output/AiOutputValidator.test.ts`

**Produces:**
- `validateAiOutput(schema, rawText)`
- 仅一次 repair/retry 所需的结构化校验错误。

- [ ] 覆盖合法 JSON、Markdown fence、字段缺失、错误类型和多余文本。
- [ ] 实现本地轻量清理。
- [ ] 明确禁止无限重试。
- [ ] 提交：

```bash
git commit -m "feat: validate structured ai action output"
```

### Gate A 验收

- 当前 AI 测试台行为未回归；
- Action/Prompt/Output 三个公共模块有单元测试；
- Source Map 已记录所有实际路径；
- 不存在第二套 Provider。

---

## Gate B — Context 与统一 AI 抽屉

### Task 5: Context Pack 类型和 Builder

**Files:**
- Create: `packages/ai-actions/src/context/AiContextPack.ts`
- Create: `packages/ai-actions/src/context/AiContextPolicy.ts`
- Create: `packages/ai-actions/src/context/AiContextBuilder.ts`
- Test: `packages/ai-actions/src/context/AiContextBuilder.test.ts`

**Interfaces:**
- Consumes: 当前 Project/Resource repositories。
- Produces: `buildContextPack(action, scope): Promise<AiContextPack>`。

- [ ] 测试最小上下文、可选项、作者秘密默认排除、Token 裁剪。
- [ ] 用 Adapter 读取现有数据；缺失模块返回空集合而非伪造。
- [ ] 增加 Context Exclusion 说明。
- [ ] 提交：

```bash
git commit -m "feat: build privacy-aware ai context packs"
```

### Task 6: Context Preview UI

**Files:**
- Create/Modify: 根据 Source Map 放入现有 AI feature 目录。
- Suggested: `apps/desktop/src/features/ai/context/ContextPreview.tsx`
- Test: `ContextPreview.test.tsx`

- [ ] 显示项目、选区、人物、事件、规则、秘密和 Token 估算。
- [ ] 必选项不可取消但有原因。
- [ ] 作者秘密默认关闭。
- [ ] 无项目时显示明确说明。
- [ ] 提交：

```bash
git commit -m "feat: add ai context preview and consent controls"
```

### Task 7: Unified Generation Drawer

**Files:**
- Suggested: `apps/desktop/src/features/ai/drawer/AiGenerationDrawer.tsx`
- Suggested: `apps/desktop/src/features/ai/drawer/aiGenerationStore.ts`
- Test: drawer component/store tests。

**Produces:**
- `openAiAction(actionId, input, scope)`
- 公共状态：idle 到 stale。

- [ ] 复用现有 Job Runtime。
- [ ] 支持开始、停止、错误、流式、Schema 校验、预览。
- [ ] 页面切换保留预览；关闭应用取消任务。
- [ ] 1536、1280、1024 三档截图测试。
- [ ] 提交：

```bash
git commit -m "feat: add unified ai generation drawer"
```

### Task 8: Preview Transaction

**Files:**
- Create: `packages/ai-actions/src/apply/AiPreviewTransaction.ts`
- Create: `packages/ai-actions/src/apply/AiApplyService.ts`
- Test: `AiApplyService.test.ts`

- [ ] 测试 revision 未变、revision 已变、部分字段接受、取消。
- [ ] 写入前创建安全快照或调用现有 Version Service。
- [ ] Apply 失败回滚。
- [ ] 提交：

```bash
git commit -m "feat: apply ai candidates through guarded transactions"
```

### Gate B 验收

- 任意测试 Action 能打开统一 Drawer；
- Context 可见和可裁剪；
- DeepSeek 流式结果进入统一状态机；
- Stale 和 Snapshot 生效。

---

## Gate C — 正文 AI

### Task 9: 正文选区动作

**Actions:** polish、condense、expand、dialogue、pacing。

- [ ] 先用 Fake Provider 写选区到 Diff 的 E2E 组件测试。
- [ ] 接入编辑器选区浮动菜单。
- [ ] 输出使用 `text_diff` ApplyPolicy。
- [ ] 接受后支持 Monaco Undo。
- [ ] 正文变化后候选 stale。
- [ ] 提交：

```bash
git commit -m "feat: add selection based ai writing actions"
```

### Task 10: AI 续写

- [ ] 增加“继续本段、完成场景、三种走向”。
- [ ] 只有当前场景存在时才发送场景资料。
- [ ] 结果进入右侧 AI 建议，不自动插入。
- [ ] 插入后 Undo。
- [ ] 提交：

```bash
git commit -m "feat: add author controlled ai continuation"
```

### Task 11: 细纲与情绪节拍

- [ ] AI 生成本章目标。
- [ ] AI 生成场景细纲。
- [ ] 从正文提取细纲。
- [ ] AI 生成情绪节拍候选。
- [ ] 字段级接受。
- [ ] 提交：

```bash
git commit -m "feat: integrate ai chapter outline and emotion beats"
```

### Gate C 验收

- 真实章节完成选区润色和续写；
- Diff、接受、拒绝、Undo、Stale 全通过；
- 不发送整本项目。

---

## Gate D — 人物与关系

### Task 12: 人物快速生成

- [ ] 注册人物生成、背景、人物弧、语言风格 Actions。
- [ ] 使用字段级 Schema。
- [ ] 已有字段冲突必须展示。
- [ ] 支持三个人物候选。
- [ ] 空状态有“用 AI 创建人物”。
- [ ] 提交：

```bash
git commit -m "feat: add ai assisted character creation"
```

### Task 13: 从正文提取人物

- [ ] 选择章节范围。
- [ ] 提取人物、别名、状态、知识和物品。
- [ ] 候选去重。
- [ ] 记录 Evidence。
- [ ] 不自动覆盖同名人物。
- [ ] 提交：

```bash
git commit -m "feat: extract character facts from manuscript"
```

### Task 14: 人物关系 AI

- [ ] 生成关系。
- [ ] 从正文分析关系变化。
- [ ] AI 候选显示虚线边。
- [ ] 双向认知可不同。
- [ ] 接受后进入正式关系。
- [ ] 提交：

```bash
git commit -m "feat: add ai relationship generation and extraction"
```

### Gate D 验收

- 从真实章节提取人物和关系；
- 字段/边级确认；
- Evidence 可跳回正文。

---

## Gate E — 世界观与物品

### Task 15: 世界观快速生成

- [ ] 支持地点、势力、文化、宗教、科技/魔法、法律、世界规则。
- [ ] 类型决定 Schema。
- [ ] 生成规则必须含适用范围和例外。
- [ ] 检测与已有规则冲突。
- [ ] 提交：

```bash
git commit -m "feat: add structured ai worldbuilding actions"
```

### Task 16: 从正文提取世界观

- [ ] 从指定范围提取地点、组织、术语和规则。
- [ ] 将长文本拆为候选条目。
- [ ] 合并前显示重复和冲突。
- [ ] 提交：

```bash
git commit -m "feat: extract worldbuilding facts from manuscript"
```

### Task 17: 物品与叙事资产 AI

- [ ] 生成物品卡、历史、限制和叙事作用。
- [ ] 从正文提取物品及持有人。
- [ ] 候选转移事件。
- [ ] 唯一物品冲突提示。
- [ ] 提交：

```bash
git commit -m "feat: add ai story asset generation and extraction"
```

### Gate E 验收

- 世界规则和物品均为结构化数据；
- 正文 Evidence 可追踪；
- 不产生静默覆盖。

---

## Gate F — 故事进程、剧情线与伏笔

### Task 18: 故事进程页面 AI 入口

- [ ] 顶部增加“手动添加”和“AI 从正文提取”。
- [ ] 保持时间/章节/人物筛选。
- [ ] 右侧 Inspector 显示前置、结果、影响、伏笔和检查。
- [ ] 提交：

```bash
git commit -m "feat: integrate ai actions into story progress workspace"
```

### Task 19: 事件提取

- [ ] 支持当前章、当前卷、指定章、未分析章。
- [ ] 提取事件、时间、人物、地点、前置、结果、影响、剧情线、伏笔和 Evidence。
- [ ] 重复和冲突分组。
- [ ] 批量选择接受。
- [ ] 提交：

```bash
git commit -m "feat: extract timeline events from manuscript"
```

### Task 20: 事件生成和因果建议

- [ ] 根据章节目标生成事件。
- [ ] 生成三种后续。
- [ ] 补全前置/结果。
- [ ] 因果图中候选边使用虚线。
- [ ] 提交：

```bash
git commit -m "feat: add ai event and causality suggestions"
```

### Task 21: 剧情线与伏笔

- [ ] 生成/提取剧情线。
- [ ] 生成伏笔、提醒和回收。
- [ ] 作者秘密默认排除。
- [ ] 逾期、提前泄露和未回收检查。
- [ ] 提交：

```bash
git commit -m "feat: add ai plot thread and foreshadowing workflows"
```

### Gate F 验收

- 一章正文可提取为事件时间线；
- Event → Plot → Foreshadowing 关联可见；
- 本地规则与 AI 检查来源明确。

---

## Gate G — 批量提取与最终加固

### Task 22: AI 从正文整理中心

- [ ] 建立统一范围选择和类型选择。
- [ ] 按章节分批。
- [ ] Token 预估。
- [ ] 支持停止和已完成批次保留。
- [ ] 重启后不自动继续收费。
- [ ] 候选统一进入冲突处理。
- [ ] 提交：

```bash
git commit -m "feat: add manuscript ai extraction center"
```

### Task 23: AI 审查与 ReviewIssue

- [ ] AI 一致性结果进入现有 ReviewIssue。
- [ ] 默认最大 warning。
- [ ] 证据 A/B 和 Story Fact 必须可见。
- [ ] AI 不直接修改。
- [ ] 提交：

```bash
git commit -m "feat: integrate ai consistency findings with review"
```

### Task 24: 性能、隐私和恢复

- [ ] 流批处理刷新。
- [ ] 大范围提取内存测试。
- [ ] 日志、诊断、备份扫描无正文和 Key。
- [ ] Offline、取消、超时、无效 JSON、Stale、Apply 回滚。
- [ ] Snapshot/Restore 演练。
- [ ] 提交：

```bash
git commit -m "test: harden storyforge ai quick action workflows"
```

### Task 25: 文档与最终验收

- [ ] 用户文档。
- [ ] AI 上下文和隐私说明。
- [ ] 开发者新增 Action 指南。
- [ ] 真实项目完整验收。
- [ ] 更新进度与标签。
- [ ] 提交：

```bash
git commit -m "docs: record storyforge ai quick actions acceptance"
```

---

## 最终报告

Codex 最终必须输出：

1. 复用的现有 AI 模块；
2. 新增公共模块；
3. 各 Action 清单；
4. 各页面 UI 入口；
5. Context Pack 行为；
6. Schema 和 Prompt 版本；
7. 自动测试；
8. 真实项目验收；
9. 性能；
10. 隐私扫描；
11. Snapshot/Undo/Restore；
12. 已知问题；
13. Git commits/tags；
14. 是否满足完成定义。
