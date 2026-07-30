# Phase 1.2B Genre-to-Draft Gate F 验收报告

日期：2026-07-30

## Gate

Gate F — 编辑器布局优化：让已展开的章节与场景可以在稳定、可恢复的写作工作区中直接推进。

基线提交：`83a71760 feat: expand outlines into writable scenes`

工作分支：`codex/genre-to-draft-gates-a-c`

## Status

**PASS**

Gate F 已完成并通过真实浏览器交互、完整前端回归、Rust 工作区测试、Tauri Release/NSIS 构建以及原生 Windows 启动与正常退出验证。本次不包含 Gate G 的 AI 续写能力。

## Delivered experience

- 章节编辑器右侧始终保留 52 px 写作工具轨：细纲、人物、资料、AI、检查。
- 同一时间只显示一个工具面板；面板支持切换、固定、关闭、`Escape` 收起和刷新恢复。
- 面板关闭后正文立即收回空间；固定面板在刷新和专注模式往返后恢复。
- 当前场景条显示场景序号、标题、目标、冲突与结尾，并提供完成场景、查看细纲、隐藏与本章场景跳转。
- 项目树、场景卡片和场景条都复用现有稳定锚点导航；跳转时保留编辑器选择，光标变化同步当前场景。
- 恢复工作区时同时恢复当前场景、工具面板、固定状态、场景条状态和正文排版密度。
- 正文提供紧凑 680 px、舒适 760 px、宽松 820 px 三档版心，对应 17/30、18/34、19/38 px 字号/行高。
- 专注模式隐藏项目侧栏、工具轨和工具面板，正文扩大至 820 px；退出后恢复原布局。
- 面板动画为 180 ms，`prefers-reduced-motion` 下禁用；新增主要交互均满足至少 44 px 点击目标。

## Reuse and compatibility

- 复用现有 `AssistantPanel`、AI 意图、审校中心、人物/资料数据和 `ResizeHandle`，没有创建第二套 AI 面板或运行时。
- 复用现有 Story Kernel 场景与 TextAnchor；没有创建第二套场景模型。
- 写作工作区布局只增加向后兼容的可选字段。旧 session 缺少字段时使用安全默认值，不修改项目内容，也不需要磁盘项目迁移。
- 没有新增 AI action、provider 请求或凭据访问。

## Automated validation

- Release self-test：PASS
- ESLint：PASS
- TypeScript：PASS
- Vitest：149 个测试文件、559 项测试全部通过
- Production build：PASS
- `cargo fmt --check`：PASS
- Rust：66 passed、0 failed、2 ignored
- Tauri Release：PASS
- NSIS installer：PASS

两个 ignored Rust 测试仍是既有外部真实项目恢复和性能 fixture 门禁。

自测报告：`artifacts/self-test/latest.json`

## Browser acceptance

真实可见界面验证结果：

- 1024×720：正文 680 px，项目侧栏 220 px，工具轨 52 px，无水平溢出，侧栏不再覆盖正文。
- 1280×800：正文 760 px，360 px 工具面板按需覆盖，只有一个面板且没有重复内部标签栏。
- 1536×960：360 px 工具面板进入稳定网格列，正文保持 760 px，无水平溢出。
- 固定面板时按 `Escape` 保持；取消固定后按 `Escape` 正常收起。
- 固定“人物”面板后刷新并继续上次位置，工具、固定状态和 760 px 排版均恢复。
- 场景条从 158.67 px 折叠到 44.67 px，再展开正常。
- 三档正文排版、场景条、工具轨和面板均通过交互测量。
- 专注模式正文为 820 px，工具轨/面板隐藏；退出后固定“人物”面板和舒适排版恢复。

精确指标：`docs/acceptance/genre-to-draft-gate-f-metrics.json`

## Native Windows acceptance

最终便携版 EXE：

- 到达 input-idle
- 窗口标题为 `Writing Buddy`
- 窗口保持响应
- 正常请求关闭
- 无强制终止
- 退出码 0

## Screenshots

目录：`docs/acceptance/screenshots/genre-to-draft-gate-f/`

- `01-editor-1024x720.png`
- `02-ai-panel-1280x800.png`
- `03-character-panel-1536x960.png`
- `04-focus-mode-1536x960.png`

## Deliverables

目录：`artifacts/release/genre-to-draft-gate-f/`

- `Writing-Buddy-0.1.0-genre-to-draft-gate-f-portable.exe`
  - 8,298,496 bytes
  - SHA-256: `73ED06881B4F3BB938D7B1006D781284BFDB27CCF824FFCE908F6CC9B3C5FE9D`
- `Writing-Buddy-0.1.0-genre-to-draft-gate-f-setup.exe`
  - 3,606,958 bytes
  - SHA-256: `9B4FD3CB36168BC3E2A172FC14324AE020B3D64199F66588480542C1FE1A54B7`

生产构建使用 Node 24.14.0。

## Known issues

- Windows 交付物未做代码签名，首次运行可能出现 SmartScreen 提示。
- Vite 仍报告既有 Monaco 大 chunk 警告；不影响 Gate F 功能、测试、构建或启动。
- Gate G 尚未开始。

## Git

提交信息：`feat: optimize editor for outline guided drafting`
