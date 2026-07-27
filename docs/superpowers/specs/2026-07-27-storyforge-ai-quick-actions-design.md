# Writing Buddy — StoryForge AI 快速生成与正文提取系统设计规格 v1.0

> 适用基线：独立 Tauri + React 客户端；DeepSeek API、流式输出、停止、Token 用量和设置已经可用。
> 目标：把现有 AI Runtime 从“隔离测试台”升级为覆盖正文、人物、关系、世界观、时间线、物品、剧情线、伏笔和审校的统一 AI Action System。

---

## 1. 当前状态与本次边界

### 可复用能力

- 独立 Writing Buddy 产品壳；
- 作品、搜索、资料、审校、版本、AI 测试、设置入口；
- 主题与强调色；
- DeepSeek 流式测试台；
- 停止、复制、清空、Token 和耗时；
- 本地审校与 AI 审校入口；
- 版本与恢复入口；
- 三栏编辑工作区和右侧写作助手结构。

### 本次禁止重复建设

- 第二套 DeepSeek HTTP Client；
- 第二套 API Key 存储；
- 第二套 SSE Parser；
- 第二套 Job Queue 或 Usage；
- 每个页面各自维护 Prompt、错误和 Loading；
- AI 自动连续生成整本小说；
- 未经确认直接写正文或资料；
- 默认发送完整项目。

### 本次新增

```text
现有 DeepSeek Runtime
        ↓
AI Action Registry
        ↓
Context Pack Builder
        ↓
Structured Output Validator
        ↓
Unified Generation Drawer
        ↓
Preview / Diff / Accept / Reject
        ↓
正文、人物、关系、世界观、时间线、物品、剧情线、伏笔、审校
```

---

## 2. 产品原则

### 作者控制

任何 AI 结果只能经历：

```text
draft → previewed → accepted / partially_accepted / rejected / stale
```

### AI 是能力层，不是独立产品页

人物页仍以人物资料为核心；时间线仍以事件编排为核心；世界观仍以结构化设定为核心。AI 只提供生成、补全、提取、检查和改写。

### 结构化输出优先

人物、事件、关系、物品等不得把自由文本直接落库：

```text
JSON Schema → 校验 → 字段级预览 → 用户勾选 → Repository 写入
```

### 来源可追踪

从正文提取的数据必须记录：

```text
chapterId
sceneId（存在时）
textRange / paragraphAnchor
revisionId
extractionJobId
```

### 必须先盘点现状

Codex 先完成 Source Map：

- 找出现有 AI Runtime、DeepSeek Provider、AI 测试台、Usage、设置页；
- 找出现有 Project、Chapter、Resource、Review、Version、Theme；
- 判断人物、世界观、时间线、关系、物品、剧情线、伏笔是 complete / partial / shell / missing；
- 已实现部分使用 Adapter 或 Extension，不新建并行系统。

---

## 3. 统一 AI Action 架构

```ts
export type AiActionId =
  | 'editor.polish'
  | 'editor.condense'
  | 'editor.expand'
  | 'editor.continue'
  | 'editor.dialogue'
  | 'editor.pacing'
  | 'editor.sceneOutline'
  | 'character.generateProfile'
  | 'character.generateBackstory'
  | 'character.generateArc'
  | 'character.generateVoice'
  | 'character.extractFromText'
  | 'relationship.generate'
  | 'relationship.analyzeEvolution'
  | 'world.generateLocation'
  | 'world.generateFaction'
  | 'world.generateRule'
  | 'world.generateCulture'
  | 'timeline.generateEvent'
  | 'timeline.extractEvents'
  | 'timeline.inferOrdering'
  | 'timeline.detectConflicts'
  | 'item.generate'
  | 'item.extractFromText'
  | 'item.generateHistory'
  | 'plot.generateThread'
  | 'plot.generateConsequences'
  | 'plot.extractProgress'
  | 'foreshadowing.generateSeed'
  | 'foreshadowing.generatePayoff'
  | 'foreshadowing.extract'
  | 'review.consistency';
```

```ts
export interface AiActionDefinition<I, O> {
  id: AiActionId;
  title: string;
  description: string;
  category:
    | 'editor'
    | 'character'
    | 'relationship'
    | 'world'
    | 'timeline'
    | 'item'
    | 'plot'
    | 'foreshadowing'
    | 'review';
  availability: AiActionAvailability;
  inputSchema: Schema<I>;
  outputSchema: Schema<O>;
  contextPolicy: AiContextPolicy;
  applyPolicy: AiApplyPolicy;
  promptTemplateId: string;
  defaultModelClass: 'fast' | 'reasoning';
}
```

```ts
export type AiApplyPolicy =
  | { type: 'text_diff'; allowPartial: true }
  | { type: 'field_patch'; selectableFields: true }
  | { type: 'create_resources'; selectableItems: true }
  | { type: 'create_links'; selectableItems: true }
  | { type: 'review_issues'; maximumSeverity: 'warning' }
  | { type: 'analysis_only' };
```

不可用 Action 需要显示原因：

```text
请先打开作品
请先选择一段正文
请先打开人物卡
当前项目没有可提取章节
```

---

## 4. Context Pack

```ts
export interface AiContextPack {
  actionId: AiActionId;
  project: ContextProjectSummary;
  currentResource?: ContextResourceSummary;
  selection?: ContextSelection;
  scene?: ContextSceneSummary;
  entities: readonly ContextEntity[];
  events: readonly ContextEvent[];
  plotThreads: readonly ContextPlotThread[];
  foreshadowing: readonly ContextForeshadowing[];
  worldRules: readonly ContextWorldRule[];
  knowledgeRules: readonly ContextKnowledgeRule[];
  styleProfile?: ContextStyleProfile;
  exclusions: readonly ContextExclusion[];
  tokenEstimate: number;
}
```

默认策略：

| Action | 默认发送 |
|---|---|
| 润色/精简 | 选区、前后各 1 段、文风约束 |
| 续写 | 当前场景、人物状态、地点、剧情线、最近事件 |
| 人物生成 | 用户输入、已有同名人物摘要、作品类型 |
| 人物提取 | 用户指定章节/场景正文 |
| 时间线提取 | 选定章节范围、已有事件摘要 |
| 世界观生成 | 用户输入、相关规则、冲突规则 |
| 关系生成 | 两个人物、共同事件、现有关系 |
| 物品提取 | 指定正文、已有物品别名 |
| 剧情提取 | 指定章节、已有剧情线和事件 |
| 伏笔生成 | 当前剧情线、目标回收范围、读者已知信息 |

Context Preview：

```text
将发送给 DeepSeek：
✓ 当前选区：326 字
✓ 相邻段落：418 字
✓ 人物：沈默、画师
✓ 地点：桥下
✓ 当前场景目标
✓ 主线摘要
○ 作者秘密（默认关闭）
预计输入：2,460 Tokens
```

---

## 5. Prompt Registry

Prompt 不得散落在 React 组件：

```text
packages/ai-actions/prompts/
├─ editor/
├─ character/
├─ relationship/
├─ world/
├─ timeline/
├─ item/
├─ plot/
├─ foreshadowing/
└─ review/
```

```ts
export interface PromptTemplate<I> {
  id: string;
  version: number;
  buildSystemPrompt(input: I): string;
  buildUserPrompt(input: I, context: AiContextPack): string;
  outputSchemaName: string;
}
```

每次 Job 记录 Action、Prompt 版本、Schema 版本和 Model ID；普通日志不记录正文或完整 Prompt。

---

## 6. UI/UX 总体编排

基准窗口：`1536 × 992`。

```text
Title Bar            0,0,1536,32
Product Header       0,32,1536,68
Global Rail          0,100,78,852
Project/Module Nav   78,100,228~304,852
Main Workspace       动态占满
AI Drawer            右侧 380px，可展开至 520px
Status Bar           0,952,1536,40
```

### 统一 AI Generation Drawer

```text
┌────────────────────────────────────┐
│ AI 快速生成                  [×]   │
├────────────────────────────────────┤
│ 动作：生成人物档案                 │
│ 模型：自动 / 快速 / 深度           │
├────────────────────────────────────┤
│ 你的要求                           │
│ [多行输入]                         │
├────────────────────────────────────┤
│ 参考上下文                         │
│ ✓ 当前作品                         │
│ ✓ 现有人物                         │
│ ○ 指定章节                         │
│ [查看完整上下文]                   │
├────────────────────────────────────┤
│ [开始生成] [停止]                  │
├────────────────────────────────────┤
│ 候选结果                           │
│ 字段级预览 / Diff / 多候选         │
├────────────────────────────────────┤
│ [全部接受] [选择接受] [拒绝]       │
└────────────────────────────────────┘
```

状态：

```text
idle
validating_context
queued
connecting
streaming
validating_output
preview
applying
completed
cancelled
failed
stale
```

入口规则：

- 页面右上角：`AI 生成`、`AI 从正文提取`；
- 空状态：`用 AI 创建第一个人物`；
- 卡片内部：`AI 补全`；
- 更多菜单放低频 Action；
- 正文选区浮动菜单：润色、精简、扩写、对话、节奏、更多。

---

## 7. 正文编辑器 AI

参考目标布局：左侧卷章树、中央正文、右侧细纲/角色/AI 建议/设定。

顶部：章节标题、保存状态、本章/全书字数、专注模式、AI 续写、更多。

选区 Action：

| Action | 输出 | 应用 |
|---|---|---|
| 润色 | 单候选 + Diff | 替换选区 |
| 精简 | 单候选 + Diff | 替换选区 |
| 扩写 | 单候选 + Diff | 替换选区 |
| 对话 | 1–3 个候选 | 插入/替换 |
| 节奏 | 分析 + 候选 | 部分接受 |
| 续写 | 三种走向或一段正文 | 插入光标后 |

AI 续写：

```text
继续本段 / 完成本场景 / 三种走向
→ Context Preview
→ 流式生成
→ 右侧 AI 建议
→ 插入正文
→ Undo
```

右侧“细纲”：AI 生成章节目标、场景细纲、情绪节拍；支持从正文反向提取。

---

## 8. 人物中心 AI

页面：左人物列表，中人物资料，右 AI 建议与关联。

Tabs：

```text
概览 | 当前状态 | 人物弧 | 关系 | 时间线 | 出场记录 | 来源
```

Actions：

- 根据一句描述生成人物；
- 根据故事前提生成主角/配角/反派；
- 生成三个人物候选；
- 从正文提取人物；
- 补全背景、矛盾、目标、恐惧、语言、秘密、人物弧；
- 提取状态、知识、别名、物品和关系变化。

字段预览：

```text
☑ 姓名：桥下画师
☑ 真实姓名：顾维
☑ 角色定位：关键证人
☐ 年龄：42
☑ 核心秘密：曾参与……
```

冲突字段：

```text
当前：35 岁
AI：42 岁
[保留当前] [采用 AI] [标记冲突]
```

---

## 9. 人物关系 AI

Actions：

- 生成两个人物的初始关系；
- 根据共同事件分析关系；
- 生成关系张力；
- 从正文提取关系变化；
- 检查双向认知；
- 生成人物关系网候选。

AI 候选在关系图中显示虚线边，接受后转为正式边。

---

## 10. 故事进程与时间线 AI

目标页面：顶部“手动添加 / AI 从正文提取”；筛选故事线、时间、章节、人物；中央事件轨；右侧详情、前置、结果、影响、伏笔和检查；底部时间线/因果图/章节分布。

### 从正文提取

范围：当前章节、当前卷、指定章节、未分析章节。

提取：

- 事件；
- 时间；
- 人物；
- 地点；
- 前置事件；
- 直接结果；
- 后续影响；
- 剧情线；
- 伏笔/回收；
- Evidence。

批量确认：

```text
发现 12 个事件
新增 8
可能重复 2
与已有事件冲突 2
```

### 生成

- 根据章节目标生成事件；
- 生成冲突升级；
- 补全因果链；
- 生成三种后续；
- 生成章节事件骨架。

本地确定性规则和 AI 语义检查必须分别标记。

---

## 11. 世界观 AI

类型：地点、区域、势力、组织、种族、文化、宗教、科技、魔法、法律、经济、历史、规则、术语。

Actions：

- 按类型快速创建；
- 依据已有设定补全；
- 生成多个候选；
- 生成规则与例外；
- 检查规则冲突；
- 从正文提取；
- 将长设定拆为结构化条目；
- 生成地点层级和势力冲突。

---

## 12. 物品与叙事资产 AI

Actions：

- 生成物品卡；
- 生成外观、用途、限制、来源、历史和叙事作用；
- 生成获得/转移/丢失事件；
- 从正文提取物品和持有人；
- 检查唯一物品冲突；
- 关联人物、剧情线和伏笔。

作者确认后才更新资产状态。

---

## 13. 剧情线与伏笔 AI

剧情线：从故事前提生成主线，为人物生成个人线，从正文提取推进，生成阻碍/转折/解决候选，检查长期未推进。

伏笔：生成埋设、提醒、回收方式；从正文提取潜在伏笔；检查逾期、重复揭示和提前泄露。

作者必须控制真实含义、目标回收范围和是否允许 AI 看到作者秘密。默认关闭作者秘密。

---

## 14. AI 从正文批量提取中心

入口：`资料中心 → AI 从正文整理`。

```text
1. 选择范围
2. 选择提取类型
3. 预估 Tokens
4. 执行
5. 查看候选
6. 处理重复和冲突
7. 批量确认
8. 创建安全快照
9. 写入 Story Kernel
```

类型：人物、人物状态、关系、事件、时间、地点、规则、物品、剧情线、伏笔、信息揭示。

支持取消和已完成批次保留；应用重启后不得自动继续收费任务。

---

## 15. Structured Output 与失败处理

每类 Action 独立 Schema。示例：

```ts
export interface ExtractedTimelineEvent {
  clientCandidateId: string;
  title: string;
  summary: string;
  timeExpression?: string;
  participants: readonly EntityReference[];
  location?: EntityReference;
  predecessorCandidateIds: readonly string[];
  directResults: readonly string[];
  plotThreadRefs: readonly EntityReference[];
  foreshadowingRefs: readonly EntityReference[];
  evidence: readonly TextEvidence[];
  confidence: number;
}
```

失败策略：

```text
第一次：本地轻量清理
第二次：携带校验错误重试一次
仍失败：显示无法解析，允许复制原始输出，不写项目
```

---

## 16. 应用事务、版本与隐私

Apply：

```text
Preview Transaction
→ 验证 revision
→ stale 检测
→ 用户确认
→ Version Snapshot
→ 原子写入
→ Apply Result
```

正文使用 Monaco Undo；结构化资料使用应用事务或版本恢复。

默认不发送：项目绝对路径、API Key、未选中的完整小说、版本历史正文、诊断日志、作者秘密。

AI History 默认仅保存元数据，不保存正文和完整输出。

---

## 17. 性能与响应式

- 不启动额外 Node 进程；
- 复用现有 Runtime；
- 流增量 30–50ms 合并刷新；
- 大范围提取按章节分批；
- 同时最多一个活动任务；
- Context Builder 不把完整项目加载进前端内存。

响应式：

- `≥1440px`：AI Drawer 380–520px 常规抽屉；
- `1100–1439px`：AI Drawer 覆盖式；
- `800–1099px`：模块列表折叠，AI Drawer 全高覆盖；
- `<800px`：不作为首版桌面验收尺寸。

---

## 18. 阶段拆分

```text
A0  Source Map 与能力盘点
A1  AI Action Registry + Prompt Registry
A2  Context Pack + Generation Drawer
A3  正文选区和续写
A4  人物 + 关系
A5  世界观 + 物品
A6  故事进程 + 时间线
A7  剧情线 + 伏笔
A8  正文批量提取中心
A9  一致性、事务、性能和验收
```

---

## 19. 完成定义

```text
打开真实作品
→ 正文选区润色并 Diff 接受
→ AI 创建人物候选并字段级接受
→ 从正文提取人物关系
→ 生成世界观并检查冲突
→ 从正文提取物品
→ 从一章提取事件并显示时间线
→ 生成剧情线和伏笔
→ 批量候选不自动写入
→ Stale 防止覆盖新修改
→ Snapshot/Undo/Restore 通过
→ 日志无正文和 Key
```
