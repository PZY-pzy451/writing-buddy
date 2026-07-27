# StoryForge Gate B — Story Kernel 验收报告

日期：2026-07-27
分支：`codex/phase-1.0a-deepseek-ai-foundation`

## 1. Gate 状态

**COMPLETE — 等待人工批准。**

Task 2–8 已完成，真实 Tauri 项目副本已验证 Story Kernel、作品仪表盘、场景、
正文 Mention 和反向链接。验收中发现的仪表盘短网格行和 Monaco 首次挂载竞态
均已修复并重新构建。当前严格停在 Gate B；Task 9 与 Gate C 页面尚未开始。

## 2. 基线 commit/tag

- 原始 Source Map 基线：`7e658a284920b0e61d42da39a0addaa39bd6b11d`
- Gate A 完成边界：`a409788d16588e46e7758d0149b5f2de38414c41`
- Gate B 最后功能修复：`c00cd01`

## 3. 实际执行任务

- Task 2：Story ID、StoryPosition、EvidenceRef、StoryResourceBase。
- Task 3：12 类资源的 schemaVersion 1、Schema Registry、安全文件布局。
- Task 4：TypeScript Repository/Transaction 与 Rust 原子保存、版本冲突、
  Trash 恢复、快照变更钩子。
- Task 5：资源注册表、`story/:type/:id`、稳定 Tab key、去重、持久化恢复和
  “资源不存在”恢复态。
- Task 6：作品仪表盘、加载/空/部分错误/完整状态、三档响应式布局。
- Task 7：场景范围、重叠校验、章节导航、Monaco gutter、解除关联确认。
- Task 8：Mention 独立持久化、anchor rebase/stale、六项选区动作、正文装饰、
  反向链接和正文返回。
- Gate B 补充：同步旧项目流测试；修复仪表盘被 closed-dock 规则覆盖的问题；
  修复 Mention 早于 Monaco 挂载时未绘制的问题。

## 4. 创建/修改文件

Gate B 功能提交相对 Gate A 共涉及 61 个文件：42 个新增、19 个修改。主要范围：

- `packages/story-kernel/`：完整新包、模型、schema、repository、transaction
  和单元测试。
- `apps/desktop/src-tauri/src/story/`：资源与 Mention 的安全存储和命令。
- `apps/desktop/src/features/story/`：资源打开、仪表盘、场景、Mention、
  Backlinks 和资源占位视图。
- `apps/desktop/src/app/`、`editor/ChapterEditor.tsx`、`platform/bridge.ts`：
  现有 store/route/bridge/Monaco 集成。
- `apps/desktop/src/theme/`：专业布局 token、仪表盘/编辑器布局和 CSS 回归测试。
- `packages/domain`、`packages/platform-ports`、`packages/project`：现有边界的
  最小扩展；没有建立第二套项目系统。
- `scripts/acceptance/prepare-storyforge-gate-b-project.mjs`：只生成脱敏验收副本。
- 本报告及 `docs/acceptance/assets/storyforge-gate-b-*.png`。

精确清单可复现：

```powershell
git diff --name-status a409788..c00cd01
```

## 5. 核心接口

```ts
parseStoryId(value)
createStoryId(prefix)
StorySchemaRegistry.parse(type, json)
StoryPaths.forResource(root, type, id)
StoryRepository.get/list/save/moveToTrash
StoryTransaction.stage/commit
openStoryResource({ type, id })
createScene/updateSceneRange/findSceneAtOffset/listScenesForChapter
linkSelection/rebaseMentions/listBacklinks
```

Rust 暴露的是窄命令：资源身份和项目根目录，不接受任意目标文件路径。保存先完成
整批校验和 revision 检查，再 staging、flush、原子替换；Mention 位于
`story/mentions/`，不写进 Markdown。

## 6. UI 结果与截图路径

真实 Tauri WebView 使用 1536×960 内容视口，对应带 32px Windows 标题栏的
1536×992 原生窗口：

- Top bar：`0,0,1536,68`
- Rail：`0,68,78,852`
- Project sidebar：`78,68,304,852`
- Center/dashboard：`382,68,1154,852`
- Status bar：`0,920,1536,40`
- 页面横向溢出：`0px`
- 页面纵向溢出：`0px`

修复前真实测量仪表盘仅高 90px；修复后 clientHeight/scrollHeight 均为 852px。

- [作品仪表盘](./assets/storyforge-gate-b-dashboard.png)
- [2 个场景与 3 条正文 Mention](./assets/storyforge-gate-b-scenes-mentions.png)
- [地点资源与正文反向链接](./assets/storyforge-gate-b-backlink.png)

响应式真实 WebView 结果：

| 原生窗口 | 内容视口 | Dashboard | 横向溢出 | “继续写作” |
| --- | --- | --- | --- | --- |
| 1536×992 | 1536×960 | 1154×852 | 0 | 可见 |
| 1280×800 | 1280×768 | 602×660 | 0 | 可见 |
| 1024×720 | 1024×688 | 706×580 | 0 | 可见 |

## 7. 自动测试命令与精确结果

```powershell
pnpm acceptance
```

- ESLint：通过，0 warning/error。
- TypeScript：通过，0 error。
- Vitest：21 files / 80 tests passed，0 failed。
- Vite：2640 modules transformed，生产构建通过。

```powershell
cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

- Rust fmt：通过。
- Rust：27 passed，0 failed，0 ignored。

```powershell
pnpm compatibility:report
pnpm tauri:build
```

- 兼容夹具：10/10 passed，0 blocking。
- Tauri release 与 NSIS：通过。
- EXE：`apps/desktop/src-tauri/target/release/writing-buddy-next.exe`，
  6,814,208 bytes，SHA-256
  `A5EA7C5B206BEB3CCC06E46E47E0722335D1211B2436C7CD344C2F9C8130C186`。
- Installer：
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`，
  2,957,457 bytes，SHA-256
  `0E68FF7ABA31624AB9B407F4BBD7CA55DAB3B1B8B6C124B4C5479B64F5DF9C66`。

## 8. 手动真实项目验收

验收副本：

```text
D:\develop_tool\writing-buddy-next\tmp\storyforge-gate-b-project-20260727-1238
```

它从脱敏 `fixtures/legacy-projects/10-full` 创建，包含 2 卷、6 章、5 个正式
Story 资源、2 个 Scene、3 个 Mention。真实 Tauri WebView 完成了：

1. 打开作品并渲染 6 章、192 字、活跃剧情线和 1 条待确认事实；
2. 从 Dashboard 进入第 1 章；
3. 读取并显示 2 个场景按钮和 2 个 gutter 标记；
4. 从 Rust 读取 3 条 Mention，并在 Monaco 显示 3 条装饰；
5. 点击“旧车站”正文 Mention，打开 `location:old-station`；
6. 显示 1 条反向链接，点击后返回第 1 章；
7. 正常关闭隔离实例后，运行锁被清理。

最终标准生产 EXE 已启动，PID `38436`，窗口响应正常。

## 9. 数据兼容结果

- 旧格式 golden fixtures：10/10 通过，0 blocking。
- 验收副本中原有文件：17/17 与源 fixture SHA-256 相同，差异 0。
- 6 个 Markdown 章节 hash 全部保持不变。
- 新增数据：5 个正式资源、2 个 Scene、3 个 Mention、1 个 story manifest。
- Story JSON 共 11 个；均位于新增 `story/` 目录。
- 正常关闭后 `.writing-buddy/runtime/project.lock` 不存在。
- 快照包含 `story/` 的 Rust 回归测试通过。
- 原始 fixture 与任何真实作者项目均未修改。

## 10. 性能结果

真实本地 Tauri WebView、脱敏 6 章项目、1536×992 等效窗口：

- 从章节返回作品仪表盘并完成 Story 列表：66ms。
- 从仪表盘进入章节并完成 2 Scene + 3 Mention 绘制：114ms。
- Dashboard 全高 852px，页面横向/纵向外层溢出均为 0。

这是 Gate B 的小项目交互指标；大型项目索引、虚拟化和正式预算属于 Task 21 /
Gate F，不能用本结果替代。

## 11. 安全与隐私结果

- Story path 拒绝绝对路径、`..`、分隔符和 Windows 保留名。
- Rust 命令只接收受校验的 project root、resource type 和 Story ID。
- 批量保存先全量验证；revision 冲突不会部分落盘。
- 删除采用项目内 Trash，可恢复。
- Mention、Scene 和资源元数据不修改作者正文。
- 验收只使用脱敏 fixture 副本；没有发送网络请求或 AI 内容。
- 未新增依赖，锁文件仍使用精确版本。

## 12. 已知问题

- 人物动态状态、人物弧、关系图/矩阵和多轨时间线属于 Gate C，当前未实现。
- Gate B 的通用 Story 资源视图是可恢复占位编辑视图；专业页面从 Task 9 开始。
- 大型项目索引、虚拟化、备份恢复全链路和正式性能预算属于 Gate F。
- Grounded Context Pack 与长篇一致性审查属于 Gate E。
- MSVC 链接器输出“正在创建库”的信息性 warning；构建和测试均成功。

## 13. git status

报告提交后预期工作树干净。`tmp/` 验收副本和构建缓存不纳入 Git。

## 14. commits

- `bdf2da2` — `feat: add story kernel identity position and evidence models`
- `f4ad4f2` — `feat: define story resource schemas and safe file layout`
- `22b7fc8` — `feat: add atomic story repository and revision transactions`
- `239b4bb` — `feat: make story resources first-class workspace tabs`
- `e24230f` — `feat: add project story dashboard`
- `3345b5c` — `feat: add scene model and chapter integration`
- `d92df10` — `feat: link manuscript text to story resources`
- `ce41633` — `test: align project flows with story dashboard`
- `d6cda7d` — `fix: keep story dashboard full height`
- `c00cd01` — `fix: apply story decorations after editor mount`

## 15. 是否建议进入下一 Gate

**建议进入 Gate C，但必须先由人工批准本报告。**

批准前不执行 Task 9，不创建人物中心、关系图、关系矩阵或多轨时间线页面。
