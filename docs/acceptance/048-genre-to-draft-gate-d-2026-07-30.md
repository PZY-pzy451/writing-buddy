# Phase 1.2B Genre-to-Draft Gate D 验收报告

日期：2026-07-30

## Gate

Gate D — 局部生成与作者控制。

基线提交：`2d53f3c1 feat: add structured outline workspace`

工作分支：`codex/genre-to-draft-gates-a-c`

## Status

**PASS**

Gate D 已完成并通过自动化、Rust、真实 Tauri/WebView2、生产构建与交付验证。
本次到此停止，Gate E 尚未开始。

## Source map

- 作者控制模型：
  `apps/desktop/src/features/creation-journey/OutlineAuthorControlModel.ts`
- 去重与一次有界修复：
  `apps/desktop/src/features/creation-journey/OutlineAlternativeGenerationService.ts`
- Current/A/B/C 审核与局部采纳 UI：
  `apps/desktop/src/features/creation-journey/StructuredOutlineWorkspace.tsx`
- 快照、原子写入、影响报告与撤销编排：
  `apps/desktop/src/features/creation-journey/CreationJourneyPage.tsx`
- Creation Journey 快照恢复：
  `apps/desktop/src/features/creation-journey/CreationJourneyModel.ts`
- AI 请求/响应契约：
  `packages/ai/src/index.ts`
- AI Action 与 Prompt 注册：
  `packages/ai-actions/src/action/AiActionRegistry.ts`、
  `packages/ai-actions/src/prompt/PromptRegistry.ts`
- 浏览器确定性 fixture：
  `apps/desktop/src/platform/bridge.ts`
- Rust 原生边界：
  `apps/desktop/src-tauri/src/ai/mod.rs`
- 原生验收：
  `scripts/acceptance/validate-genre-to-draft-gate-d.mjs`

## Reused and new modules

复用：

- `.writing-buddy/creation/journey.json`
- `CreationJourneyStore`
- `StoryOutline` / `StoryOutlineNode`
- `locks.outlineNodeIds`
- `creation-journey` AI job
- `desktopBridge.createSnapshot`
- `write_creation_journey_state` 期待哈希原子写入
- 项目版本列表与标准快照

新增：

- `OutlineAuthorControlModel`
- `OutlineAlternativeGenerationService`
- 结构化大纲候选审核区
- Gate D 原生 Tauri 验收脚本

没有新增第二套大纲存储、AI runtime、项目树、Chapter/Scene 模型或 Story
Kernel 资源。

## Modified files

- 桌面 Creation Journey：模型、页面、结构化大纲工作区、测试与样式
- AI 包：局部候选输入/输出 schema、消息构建、解析与测试
- AI Actions：三个动作、严格 schema、Prompt 与测试
- Rust：Creation Journey 局部候选输入验证、Prompt 约束与测试
- 原生验收脚本、package scripts、计划、进度、记忆与本报告

## Migration

无需迁移。继续使用现有 Creation Journey v2 文档；候选仅存在于审核期间，
不会持久化。采纳后只更新原有 `StoryOutlineNode` 字段。

## AI actions

- `outline.regenerate_node`
- `outline.generate_alternatives`
- `outline.analyze_impact`

Prompt：`creation-journey.outline-author-control`

## Structured schemas

请求操作：`generate-outline-alternatives`

- 唯一目标必须是未锁定的 `journey-outline:*` 节点。
- 上下文仅包含目标、相邻节点、有限故事字段、作者指导答案与锁定决定。
- 拒绝项目 ID、根路径、绝对路径、凭据、密钥、正文与未知字段。
- 同条件同 tick 请求合并为一个在途任务。
- 结构异常最多修复一次，不会发起第三次请求。

响应：

- `targetId` 必须与请求完全一致。
- `alternatives` 必须恰好为 3 个。
- 每个候选包含 `label`、`rationale` 和完整可比较节点字段。
- 三个 replacement 必须实质不同。
- Markdown、额外字段、错误 target、路径文本与越界值全部拒绝。

## Author-control transaction

固定顺序：

`Preview → Validate revision/lock → Create snapshot → Revalidate → Atomic save → Report impact → Guarded undo`

- 只允许采纳真实变化的字段，未选字段保持作者当前内容。
- 快照失败时项目写入次数为零。
- 原子写入失败时不更新可见状态。
- 影响报告只分析现有下游节点和物化章节 ID，不自动重写。
- 撤销要求采纳后的 journey/node 版本仍匹配，避免覆盖后续作者编辑。

## Automated tests

- ESLint：PASS
- TypeScript：PASS
- Vitest：145 个测试文件、543 项测试全部通过
- 生产 Web 构建：PASS
- 新增覆盖：
  - 严格三候选、目标匹配、隐私、锁与一次修复
  - 字段 Diff、局部采纳、版本/锁保护、影响报告与撤销
  - Current/A/B/C、复选框、局部采纳和撤销 UI
  - 快照先于写入、快照失败零写入、原子持久化
  - AI Action / Prompt 注册和结构化 schema

## Rust tests

- `cargo fmt --check`：PASS
- Rust：63 passed，0 failed，2 ignored
- 两个 ignored 测试仍是既有外部真实项目/性能 fixture 门禁。
- 新增原生验证：
  `creation_journey_accepts_bounded_outline_alternatives_and_rejects_locked_or_unsafe_targets`

## Tauri acceptance

运行时：真实 Release Tauri + WebView2。

AI 仅在 `ai_get_preferences` 与 `ai_start_generation` 两条原生 IPC fetch
调用处使用确定性输出。项目创建、journey 读取/写入、标准快照、版本列表、
期待哈希原子写入、关闭、重开和恢复全部使用真实 Rust 命令。

通过的交互：

- 选中单一故事节点并生成三个候选
- Current/A/B/C 切换与字段级 Diff
- 只采纳 `conflict` 与 `hook`
- 采纳前创建标准快照
- 显示精确影响报告，不自动重写下游
- 再创建撤销快照并恢复原字段
- 保存、关闭、原生重开并恢复顺序与锁
- 全程没有创建 Chapter、Scene 或正文锚点

结果：

- 采纳前版本数：0
- 采纳后版本数：1
- 撤销后版本数：2
- Runtime errors：0
- Console errors：0
- 正常关闭：exit code 0

指标：
`docs/acceptance/genre-to-draft-gate-d-metrics.json`

## Screenshots

目录：
`docs/acceptance/screenshots/genre-to-draft-gate-d/`

- `01-candidate-diff-1536x992.png`
- `02-candidate-diff-1280x800.png`
- `03-candidate-diff-1024x720.png`
- `04-impact-report-after-partial-apply-1536x992.png`
- `05-structured-outline-1536x992.png`
- `06-structured-outline-1280x800.png`
- `07-structured-outline-stacked-1024x720.png`
- `08-native-reopen-restored-1536x992.png`

三个候选尺寸均为：

- 页面横向溢出：0
- 工作区横向溢出：0
- 审核区横向溢出：0
- 小于 44 px 的交互目标：0
- 选中候选 tab：1
- 变化字段：3
- 审核区在视口内：是

## Privacy

- 不发送项目 ID、项目根路径、绝对路径、API key、凭据、正文或隐藏历史。
- 锁定目标在 TypeScript 与 Rust 请求边界均拒绝。
- 原生验收 fixture 不读取、不写入、不删除用户的 DeepSeek 密钥，也不会向
  外部 AI 服务发送请求。
- 截图和指标只使用验收临时项目。

## Performance

- 原生 shell ready：651 ms
- 首个结构化大纲工作区 ready：1,017 ms
- 关闭前完整验收：5,791 ms
- 1536×992、1280×800、1024×720 均无页面横向溢出或小触控目标。

## Deliverables

目录：`artifacts/release/genre-to-draft-gate-d/`

- `Writing-Buddy-0.1.0-Genre-to-Draft-Gate-D-portable.exe`
  - 8,191,488 bytes
  - SHA-256:
    `77707297E8CA8318495AF1CD534F6DF7DC9266032C8AB8FD69A6F1E4719A7BA9`
- `Writing-Buddy-0.1.0-Genre-to-Draft-Gate-D-x64-setup.exe`
  - 3,572,979 bytes
  - SHA-256:
    `38805ED04FECD2CDE1174FD0C2DE1ECC335BA3A7E3A0543DFE7003A0C16A1F4E`

生产构建使用 Node 24.14.0。便携版启动、主窗口出现、正常关闭和 exit code
0 均通过。

## Known issues

- Windows 交付物未做代码签名，首次运行可能出现 SmartScreen 提示。
- Vite 仍报告既有 Monaco 大 chunk 警告；不影响本 Gate 功能或启动验收。
- Gate E 的卷、章节、场景物化尚未开始。

## Git commits

- Gate D 基线：`2d53f3c1 feat: add structured outline workspace`
- Gate D 提交信息：`feat: preserve author control over outline generation`

## Recommendation

建议在用户审阅本 Gate 的 Current/A/B/C、局部采纳、影响报告和撤销体验后，
再单独启动 Gate E。当前应停止，不进入物化阶段。
