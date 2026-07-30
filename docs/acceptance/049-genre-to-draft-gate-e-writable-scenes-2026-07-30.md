# Phase 1.2B Genre-to-Draft Gate E 验收报告

日期：2026-07-30

## Gate

Gate E — 从结构化总纲展开为可写卷、章节和场景。

基线提交：`01b2b8df feat: preserve author control over outline generation`

工作分支：`codex/genre-to-draft-gates-a-c`

## Status

**PASS**

Gate E 已完成并通过发布级自测、真实浏览器交互、Rust 原子事务、
Tauri Release/NSIS 构建以及原生 Windows 窗口启动与退出验证。
本次不包含 Gate F。

## Canonical ownership

- `CreationJourneyState.outline` 中的卷、章、景只是在确认写入前的规划投影。
- `WritingProject.volumes[].chapters[]` 是正式卷/章节层级的唯一权威来源。
- Story Kernel `StoryScene` 是正式场景列表的唯一权威来源。
- 只有原子物化成功后，规划节点才取得对应 `resourceId`。
- 没有新增第二套项目树、章节模型、场景模型、AI runtime 或快照系统。

## Author journey

工作区根据当前选中层级只显示一个主要动作：

1. 故事总纲：拆分为卷
2. 卷：拆分为章节
3. 章节：生成场景
4. 场景：开始写作

每次 AI 拆分先进入审核预览，显示：

- 预计创建数量
- 保留的现有节点
- 保留的锁定节点
- 同级标题冲突
- 完整候选摘要、目标与冲突

关闭或取消预览不会修改规划结构。只有“确认拆分”才把候选写入
Creation Journey；此时仍不会创建正文文件。

## AI contracts

新增三个严格操作：

- `expand-to-volumes`
- `expand-volume-to-chapters`
- `expand-chapter-to-scenes`

请求只包含有限故事信息、精确父节点、期望数量和已锁定决定；拒绝项目路径、
项目 ID、凭据、正文与未知字段。响应必须匹配操作、父节点和精确数量。
场景还必须提供可写作的目标、冲突、结果、钩子、POV、地点与人物提示。

同条件重复请求共享一个在途任务；结构错误最多修复一次。

## Atomic apply

固定事务顺序：

`Preview → Validate revision → Check locked → Create snapshot → Atomic apply → Update tree → Show undo`

原生命令在同一事务中准备并提交：

- 项目 manifest 中的卷与章节
- 新章节 Markdown
- 正文场景标题与稳定锚点
- Story Kernel `StoryScene`
- 带正式 `resourceId` 的 Creation Journey

写入前校验项目 revision、journey hash、父子结构、连续顺序、锁定状态、
已有正式资源和同名卷/章节。写入后重新打开 manifest、journey、章节和场景
验证；任一步失败都会恢复之前的字节并清理新文件。

成功后打开第一个新章节，刷新项目树和字数，并提供 12 秒标准快照撤销。

## Automated tests

- 发布级自测：PASS
- ESLint：PASS
- TypeScript：PASS
- Vitest：149 个测试文件、555 项测试全部通过
- 生产前端构建：PASS
- `cargo fmt --check`：PASS
- Rust：66 passed，0 failed，2 ignored
- Tauri Release 与 NSIS：PASS

两个 ignored Rust 测试仍是既有外部真实项目与性能 fixture 门禁。

新增覆盖包括：

- 预览不提前修改状态
- 父子关系、连续排序和完整卷→章→景覆盖
- 同名冲突、重复 ID、旧预览和锁定保护
- 严格数量、父节点、隐私和一次修复
- 快照严格先于原子写入
- 正式项目树、StoryScene 和 UTF-16 正文范围
- 强制 Story 写入失败后的完整回滚
- 最终确认弹窗只保留一个可执行主操作

发布级报告：`artifacts/self-test/latest.json`

## Browser acceptance

在本地浏览器适配层中通过真实可见界面完成：

- 新建一个题材创作项目
- 生成 5 个结构化故事节点
- 以 1 个候选依次拆卷、拆章、拆场景
- 每层确认前检查创建、保留、锁定与冲突统计
- 检查预览期间层级节点数量未提前变化
- 打开最终原子写入确认
- 创建 1 卷、1 章、1 个 Story Scene
- 自动打开新章节
- 展开项目树确认卷、章节和场景同步
- 确认 Markdown 中存在稳定 scene anchor
- 确认 12 秒撤销入口出现

1280×720 下预览与最终确认按钮均在视口内，浏览器 warning/error 为 0。
交互验收发现并修复了最终弹窗打开时背景主按钮仍可用的问题；回归测试现在
要求弹窗阶段只有一个启用的 `.primary-button`。

AI 使用本地确定性浏览器 fixture，不访问外部服务，不读取或替换真实凭据。

## Native Windows acceptance

最终 Release 便携版通过原生 Windows 自动化启动：

- 唯一窗口标题为 `Writing Buddy`
- WebView2 文档与完整可访问性树可读取
- 项目仪表盘、项目树、工作区按钮与状态栏可响应
- 关闭按钮正常退出
- 关闭后不存在残留 Writing Buddy 窗口

卷、章、景真实磁盘事务由 Rust 测试直接覆盖成功、锁定拒绝与中途失败回滚。

## Screenshots

目录：`docs/acceptance/screenshots/genre-to-draft-gate-e/`

- `01-scene-preview-1280x720.png`
- `02-atomic-confirm-1280x720.png`
- `03-final-project-tree-1280x720.png`

## Deliverables

目录：`artifacts/release/genre-to-draft-gate-e/`

- `Writing-Buddy-0.1.0-genre-to-draft-gate-e-portable.exe`
  - 8,294,400 bytes
  - SHA-256:
    `C9BB7F7E116D8F10AE87414607D897710B66D239D2F553C6FFCF877471706732`
- `Writing-Buddy-0.1.0-genre-to-draft-gate-e-setup.exe`
  - 3,606,232 bytes
  - SHA-256:
    `E82C53AC15F189642CEFC96135FAE87CEF94B1D358DFA64DEAFA993F2AE902D4`

生产构建使用 Node 24.14.0。

## Known issues

- Windows 交付物未做代码签名，首次运行可能出现 SmartScreen 提示。
- Vite 仍报告既有 Monaco 大 chunk 警告；不影响本 Gate 功能、测试或启动。
- Gate F 尚未开始。

## Git

预期提交信息：`feat: expand outlines into writable scenes`
