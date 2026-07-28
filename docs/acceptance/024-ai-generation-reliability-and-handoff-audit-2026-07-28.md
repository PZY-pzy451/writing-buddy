# AI 生成可靠性与设计文档实现审计 — 2026-07-28

## 结论

本轮已修复截图中的通用 **AI 生成失败。** 问题。原生端返回的公开错误码、
中文消息、是否可重试和 HTTP 状态现在会完整到达界面，并给出对应恢复动作。

两份 v1.0 设计文档**尚未全部实现**：

- AI Quick Actions 的主要业务动作已实现，但“Schema 校验失败后携带错误修复并
  重试一次”只有校验器和修复指令，尚未真正发起受控修复请求；真实 DeepSeek
  账号质量、费用和非脱敏作者项目仍是人工门禁。
- Project Creation / Drag / Highlight 的项目创建、卷章拖拽、资料关联拖拽和
  共享高亮已实现，但场景排序/跨章移动、人物分组和世界观分类拖拽、全应用
  Y6 视觉精修与完整 Y7 加固仍未完成。

因此，当前准确状态是“核心工作流可用，设计文档部分完成”，不能标记为整体
100% 完成。

## 1. 生成失败根因与修复

### 根因

Tauri `invoke` 失败时会拒绝一个普通结构化对象 `PublicAiError`，而不是
JavaScript `Error`。原 Story Kernel、共享 Grounded AI runner 和选区改写边界
只保留 `Error`，其余拒绝统一替换为 **AI 生成失败。**，导致以下信息丢失：

- `authentication_failed`、`insufficient_balance`、`rate_limited` 等错误码；
- 原生端已经脱敏的中文消息；
- `retryable`；
- HTTP 401/429/5xx 等诊断状态。

### 已实现

- 新增共享 `AiErrorPresentation`，统一解析对象、`Error`、字符串错误码和未知
  拒绝形态。
- `AiRequestError` 在 runner 边界保留公开错误元数据，不再让各业务面板把错误
  降级为固定文案。
- Story Kernel 失败卡同时显示标题、公开消息、恢复指导和可折叠诊断信息。
- 鉴权、余额、配置、模型和密钥存储问题提供 **检查 AI 设置**。
- 限流、网络、超时、服务端和未知问题提供 **使用相同条件重试**。
- 重试保留指令、选区和资源类型；不会静默重发付费请求。
- 取消与失败分开呈现；失败时不再显示“AI 返回的数据会先进入候选区”的误导
  空状态。
- 浏览器验收夹具覆盖鉴权、限流一次后成功和未知原生拒绝形态；Tauri 生产桥
  不受夹具影响。

实现提交：`12a278f7`（`fix: make ai generation failures recoverable`）。

## 2. 可靠性验证

| 验证 | 结果 |
| --- | --- |
| `pnpm acceptance` | 通过 |
| ESLint | 零警告 |
| TypeScript | 通过 |
| Vitest | 91 个文件，295 项通过 |
| Vite production build | 通过 |
| `cargo fmt --all -- --check` | 通过 |
| `cargo test` | 49 通过，2 个显式外部/发行门禁忽略 |
| 聚焦错误边界测试 | 4 文件，13 项通过 |
| 浏览器 page errors | 0 |

浏览器只记录了项目既有的 favicon 404；没有应用运行时页面错误。

### 故障恢复场景

| 场景 | 预期恢复 | 结果 |
| --- | --- | --- |
| 鉴权失败 / HTTP 401 | 显示真实消息并进入 AI 设置 | 通过 |
| 限流 / HTTP 429 | 保留条件，显式重试 | 通过；重试后得到 7 个候选 |
| 未知启动错误 | 显示公开消息并允许显式重试 | 通过 |
| 纸页 1440×1000 | 无通用回退、无误导空状态 | 通过 |
| 纸页 1024×800 | 无横向溢出、交互目标 44px | 通过 |
| 深夜 1024×800 | 无横向溢出、诊断可读 | 通过 |

证据：

- [纸页主题鉴权失败，1440×1000](./screenshots/ai-generation-reliability-audit/01-auth-error-paper-1440x1000.png)
- [纸页主题未知错误，1024×800](./screenshots/ai-generation-reliability-audit/02-unknown-error-paper-1024x800.png)
- [深夜主题鉴权失败，1024×800](./screenshots/ai-generation-reliability-audit/03-auth-error-midnight-1024x800.png)
- [机器可读视觉指标](./ai-generation-reliability-visual-metrics.json)

## 3. Project Creation / Drag / Highlight v1.0 审计

状态定义：

- **已实现**：设计要求、自动回归和现有验收证据闭环。
- **部分实现**：主链路存在，但文档中的明确子项仍缺失。
- **未实现**：当前领域契约或 UI 中没有该能力。

| Task | 状态 | 仓库证据 / 缺口 |
| --- | --- | --- |
| 1 创建与打开 Source Map | 已实现 | `docs/plans/010-project-creation-drag-source-map.md` |
| 2 Design Token 状态契约 | 已实现 | 四主题语义 Token；Y0–Y2、Y5 验收 |
| 3 六套 Project Template | 已实现 | 空白、悬疑、奇幻、科幻、现实、自定义；模板矩阵测试 |
| 4 无写入 Preflight | 已实现 | Windows 保留名、重名、路径、权限和结构化错误 |
| 5 staging + verify + atomic rename | 已实现 | 同级 staging、旧 Reader 复读验证、失败清理、Recent |
| 6 Wizard Shell | 已实现 | 四步、Focus Trap、Esc、响应式、reduced motion |
| 7 Wizard Steps | 已实现 | 基础、结构、外观、确认摘要和创建后打开 |
| 8 全局入口和空状态 | 部分实现 | 顶部、新建空状态和侧栏入口已实现；未发现 Command Palette 新建动作和侧栏最近项目列表 |
| 9 Drag Domain Contract | 部分实现 | `MoveCommand` 仅支持 `volume \| chapter`，没有 scene |
| 10 Ordered Move Service | 部分实现 | 卷/章同容器、跨卷、revision、Undo 已实现；场景同章/跨章未实现 |
| 11 Project Tree Drag UI | 部分实现 | 卷/章 Pointer、Keyboard、自动滚动、Overlay、Toast/Undo 已实现；场景拖拽 UI 未实现 |
| 12 Association Drop Intent | 已实现 | 人物、物品、伏笔到章节/场景/人物的确认菜单、冲突和 Undo |
| 13 Time and Plot Dragging | 已实现 | 时间事件重排/冲突确认、剧情卡跨状态、Undo |
| 14 Shared Interaction Components | 已实现 | TreeRow、DropIndicator、DragOverlayCard、AssociationMenu、UndoToast |
| 15 Entity and AI Highlights | 已实现 | 正文资源高亮开关、AI 候选/冲突/stale、四主题证据 |
| 16 Visual Polish Pass | 部分实现 | 相关页面与共享组件已精修；全应用按钮/空状态/图标/间距/disabled 的 Y6 扫描未完成 |
| 17 Accessibility and Motion | 部分实现 | Focus Trap、卷章键盘拖拽、aria-live、reduced motion 已有；全应用对比度审计和 scene 键盘等价缺失 |
| 18 Regression and Acceptance | 部分实现 | 模板、卷章拖拽、重启、AI/Review/Version 回归已覆盖；完整拖拽矩阵、内存/性能和真实作者项目最终验收未完成 |

设计正文还要求人物分组、世界观分类和剧情卡片均可拖拽编排。剧情卡片已实现；
人物分组和世界观分类拖拽在当前代码中未实现。

### 项目侧剩余优先级

1. 先定义场景移动对正文 Mention/anchor、场景范围和章节状态的迁移契约，再实现
   同章排序与跨章移动；不能只移动数组。
2. 补人物分组和世界观分类的领域 Command、规则矩阵、键盘等价和 Undo。
3. 补 Task 8 的 Command Palette/最近项目入口。
4. 执行 Y6 全应用视觉精修和 Y7 对比度、性能、内存、完整矩阵验收。

## 4. StoryForge AI Quick Actions v1.0 审计

| Task / Gate | 状态 | 仓库证据 / 缺口 |
| --- | --- | --- |
| 1 Source Map / 能力矩阵 | 已实现 | `docs/plans/002-ai-quick-actions-source-map.md` |
| 2 AI Action Core | 已实现 | typed Action、scope、context、output 和 apply policy |
| 3 Prompt Registry / version | 已实现 | 版本化模板、日志脱敏和回归 |
| 4 Structured Output Validator | 部分实现 | fence/JSON/类型/字段错误、本地清理和最多 1 次常量已实现；没有携带校验错误发起 repair 请求 |
| 5 Context Pack Builder | 已实现 | action-specific、Token 预算、秘密默认排除 |
| 6 Context Preview | 已实现 | 分层、Token、来源、删除上下文和秘密提醒 |
| 7 Unified Generation Drawer | 已实现 | loading/streaming/success/error/cancel、成本确认和候选预览 |
| 8 Preview Transaction | 已实现 | Compare → Confirm → Snapshot → Atomic Write → Undo |
| 9–11 正文 AI | 已实现 | 选区动作、三种续写、场景细纲/反向提取/情绪节拍 |
| 12–14 人物与关系 | 已实现 | 快速人物、正文提取、关系建议与冲突 |
| 15–17 世界观与物品 | 已实现 | 世界规则/地点/势力、正文提取、物品生命周期 |
| 18–21 故事进程 | 已实现 | 事件提取/生成、因果、剧情线、伏笔 |
| 22 批量整理中心 | 已实现 | 范围/类型、按章批次、Token、停止/恢复、候选冲突 |
| 23 AI ReviewIssue | 已实现 | warning 上限、证据 A/B、Story Fact、无直接修改 |
| 24 性能/隐私/恢复 | 已实现（脱敏自动范围） | 流批处理、隐私扫描、Offline/取消/超时/无效 JSON/stale/回滚、Snapshot/Restore |
| 25 文档与最终验收 | 部分实现 | 用户/隐私/开发文档与脱敏专业切片已完成；真实 Key、非脱敏作者项目和发布标签未完成 |

### AI 侧剩余门禁

1. **Schema repair 请求**：设计要求“第一次本地清理，第二次携带校验错误重试
   一次”。当前只生成 `repairInstruction` 并展示诊断。建议做成作者明确点击的
   **修复并重试（最多 1 次）**，预先显示会增加一次请求和 Token 成本，保存原始
   输出，修复结果仍须通过权威 Schema 后才能进入候选区。
2. **真实提供方门禁**：需要用户主动配置 DeepSeek Key、选择可计费测试章节，
   再确认输出质量、费用、模型行为和账户特有错误；本轮没有读取 Key，也没有发
   起真实付费请求。
3. **真实作者项目门禁**：只能在用户明确提供的项目副本上做完整验收，不能改
   原件。

## 5. 安全边界

- 本轮没有读取、记录或显示 API Key。
- 浏览器故障夹具只存在于非 Tauri 的验收桥中。
- 自动测试和截图使用脱敏内存项目。
- 所有生成仍坚持候选区、Schema 校验和作者确认后写入。
- 不会因“重试”静默产生额外付费请求。

## 6. Windows 交付物

实现提交 `12a278f7` 的 fresh Tauri 构建已完成。第一次并行构建被 Windows
“页面文件太小”中止，这是本机峰值内存/虚拟内存压力，并非代码编译错误；保留
有效缓存并将 Cargo 限制为单任务后，同一提交成功生成便携版和 NSIS 安装版。

隔离原生 smoke 启动便携版 PID `35668`，成功进入 input-idle，进程保持响应，
窗口标题为 `Writing Buddy`；`CloseMainWindow` 返回成功，程序在 10 秒内正常
退出，退出码为 `0`。

- 便携版：
  `tmp/ai-generation-reliability-target-final/release/writing-buddy-next.exe`
  - 大小：7,352,832 bytes
  - SHA-256：
    `9FB9D5EE103E132B227006F09C6D136468E4E1C3962BA9B4CC0DC3AB554A3DDA`
- NSIS 安装版：
  `tmp/ai-generation-reliability-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 大小：3,194,024 bytes
  - SHA-256：
    `FA020040D17444519BE3A11328E7808B9B3BC33528329DA2DEB6364CF779DFF3`

## 7. 完成判定

本次“生成失败可诊断、可恢复”修复和两份设计文档的实现审计已完成。不能把
审计结论解释为两份设计文档 100% 完成：项目侧的 scene/group/Y6/Y7 和 AI
侧的显式 schema repair/真实提供方/真实作者项目门禁仍须作为后续独立增量。
