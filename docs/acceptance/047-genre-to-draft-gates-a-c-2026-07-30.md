# Genre-to-Draft Gates A–C acceptance, 2026-07-30

## Gate A

Gate：Source Map 与 Canonical Data  
状态：PASS

基线提交：`01a440af73a764abc14e45f388b2a2f098e0bca1`  
Source Map：
`docs/superpowers/plans/2026-07-30-genre-to-draft-source-map.md`；
UX 基线：
`docs/superpowers/plans/2026-07-30-genre-to-draft-ux-baseline.md`。  
复用模块：项目创建向导、Creation Journey v2、项目清单
`WritingProject.volumes[].chapters[]`、Story Kernel `StoryScene`、AI Job /
Action / Prompt Registry、Context Pack、Tauri expected-hash 原子写入、
Snapshot、Session Restore 与现有三栏壳层。  
新增模块：无运行时模块；只新增架构与 UX 审计文档。  
修改文件：两份 Source Map / UX 基线文档及计划索引。  
数据迁移：无。故事节点在 Gate C 前保持为未物化 `story_beat`；Chapter
仍以项目清单为唯一来源，Scene 仍以 Story Kernel 为唯一来源。  
AI Actions：审计并冻结复用 `creation-journey` 作业与既有注册表。  
Structured Schemas：冻结 `GenreToOutlineInput`、`StoryOutline`、兼容现有
`StoryOutlineNode` 的字段与所有权边界。  
自动测试：基线通过 TypeScript、ESLint、135 个 Vitest 文件 / 507 个测试
及生产构建。  
Rust 测试：基线 60 通过，2 个需要外部真实项目/性能夹具的测试按设计
忽略。  
Tauri 桌面验收：基线 Release/NSIS、启动、响应与正常关闭通过。  
UI 截图：基线截图与测量记录在 UX 基线文档。  
隐私检查：冻结默认不发送全文、作者秘密、路径、API Key 与其他项目。  
性能：复用现有索引、存储和渲染路径，没有增加第二套运行时。  
已知问题：无 Gate A 阻断项。  
Git commits：`10925326 docs: map genre to draft architecture`。  
是否建议进入下一 Gate：是，Gate B 已按冻结边界完成。

## Gate B

Gate：题材生成入口  
状态：PASS

基线提交：`10925326`。  
Source Map：沿用 Gate A 两份文档。  
复用模块：Project Creation Wizard、Creation Journey v2 store、
`creation-journey` AI job、现有 DeepSeek Provider、Prompt Registry、
AI Action Registry、浏览器确定性 AI fixture 与 Rust command validator。  
新增模块：题材快速/深度输入、Context Preview、严格的题材生成操作及
配套测试；没有新增 Provider、AI Drawer、项目树或 Story Kernel。  
修改文件：Creation Journey 类型/页面/存储测试、项目创建向导、
AI Action/Prompt 注册、浏览器 fixture、Rust `creation-journey`
命令校验及相关 CSS。  
数据迁移：Creation Journey 继续使用 schema v2；新字段均为兼容扩展。
新项目只创建第一卷，不创建 Chapter、Scene 或 Story 资料。  
AI Actions：`outline.generateFromGenre`；Prompt Registry：
`creation-journey.genre-to-outline`；底层仍是唯一的
`creation-journey` job。  
Structured Schemas：TypeScript、AI Action parser、fixture 与 Rust
共同校验严格 JSON：一个故事根、5–8 个故事节点、建议资料与 warnings；
额外字段拒绝，结构修复最多一次。  
自动测试：Node 24.14.0 下全量 142 个 Vitest 文件 / 531 个测试通过。
覆盖仅题材、题材加设想、自定义/组合题材、更多控制、草稿恢复、取消、
失败保留、一次修复、修复失败和同一时刻重复点击只发起一个请求。  
Rust 测试：包含题材生成边界在内 62 通过，2 个外部夹具测试按设计忽略。  
Tauri 桌面验收：真实 Tauri 创建了全新项目，原生命令接受严格大纲状态，
确认 `firstChapterId=null`、Chapter 数为 0；确定性 Edge AI fixture
验收通过且无浏览器异常。  
UI 截图：[七个真实起点](./screenshots/phase-1.2b-creation-journey/01-seven-honest-starts-paper-1536x992.png)。  
隐私检查：请求断言不含 projectId、绝对路径、API Key、Credential、
全文或未选择的秘密；日志只保留安全事件元数据。  
性能：同步重复请求 guard 在 React 重渲染前生效；无轮询或后台自动生成。  
已知问题：未使用用户私人 DeepSeek Key 做付费内容质量评价；自动验收使用
确定性 fixture，真实 Tauri 验证同一跨语言结构与持久化边界。  
Git commits：`5623866 feat: generate structured outlines from genre`。  
是否建议进入下一 Gate：是，Gate C 已完成。

## Gate C

Gate：结构化大纲工作区  
状态：PASS

基线提交：`5623866`。  
Source Map：实现仍遵守 Gate A 的 Canonical Chapter/Scene 边界。  
复用模块：Creation Journey v2 state/store、expected-hash 保存、
现有规划工作区壳层、项目侧栏、设计 tokens、Lucide、Tauri 项目锁及
原生 project/journey commands。  
新增模块：`StructuredOutlineWorkspace`、结构化大纲 model 测试、
工作区交互测试、原生 Tauri Gate A–C 验收 runner 与仅用于验收构建的
Tauri 配置。  
修改文件：`CreationJourneyModel.ts`、`CreationJourneyPage.tsx`、
`StructuredOutlineWorkspace.tsx`、`workspace.css`、相关 Vitest 与
acceptance runner、验收截图/指标、进度与记忆文档。  
数据迁移：无。故事根和 5–8 个 `story_beat` 保存在既有 journey v2；
编辑、锁定、顺序与 revision 持久化。删除不会留下孤立 lock/impact；
关联 ID 数组在 TypeScript 与 Rust 边界都拒绝重复。  
AI Actions：无新增；Gate C 是作者手动控制层，不触发后台 AI。  
Structured Schemas：根字段、富节点字段、0-based 连续顺序、集中锁、
5–8 数量边界、唯一关联 ID、project ownership 与 reopen parser 全部
严格校验。  
自动测试：Node 24.14.0 下 TypeScript、ESLint、生产构建及 142 个
Vitest 文件 / 531 个测试全部通过。新增测试覆盖根/节点编辑、添加/删除、
键盘与拖拽排序、锁定/解锁、Undo 作为新 revision、保存重开和不创建
Chapter/Scene。  
Rust 测试：`cargo fmt --check` 通过；62 通过，2 个外部夹具测试按设计
忽略。  
Tauri 桌面验收：真实 WebView2 + Tauri release 验收通过。全新项目完成
原生创建、写入、编辑、拖拽、锁定、显式保存、关闭与重开；标题、顺序
`[0,1,2,3,4]`、锁 ID 和 Chapter 数 0 均从原生文件复核。运行时异常和
console error 均为 0，正常窗口关闭 exit code 为 0。  
UI 截图：
[1536×992](./screenshots/genre-to-draft-gates-a-c/01-structured-outline-1536x992.png)；
[1280×800](./screenshots/genre-to-draft-gates-a-c/02-structured-outline-1280x800.png)；
[1024×720](./screenshots/genre-to-draft-gates-a-c/03-structured-outline-stacked-1024x720.png)；
[重开恢复](./screenshots/genre-to-draft-gates-a-c/04-native-reopen-restored-1536x992.png)。  
隐私检查：Gate C 不发起 AI；验收项目位于隔离临时目录并在进程退出后清理。
指标/截图不含 API Key、绝对项目路径或作者秘密。  
性能：真实 Tauri shell 654 ms 可见，944 ms 到达首个结构工作区；
完整交互与截图在关闭前 3,233 ms。三档分辨率均为 0 页面横/纵溢出、
0 工作区横溢出、0 个低于 44 px 的可见控件，并且同屏只有 1 个可用
Primary Action。  
已知问题：Gate D 的局部 AI 候选、字段 Diff、Impact Report、Snapshot
与局部 Undo 明确未实现；这是本轮停止线，不是 Gate C 缺陷。  
Git commits：`feat: add structured outline workspace`（本 Gate 提交）。  
是否建议进入下一 Gate：否。按用户指令停在 Gate C，等待人工审查后再
决定是否进入 Gate D。

## Release artifacts

- Portable EXE:
  `artifacts/release/genre-to-draft-gates-a-c/Writing-Buddy-Genre-to-Draft-Gates-A-C-portable.exe`
  — SHA-256
  `E2ED893F027857A2B7E32F804B9467B44C0CECEF0B62DD808641DE4748DA6EF8`.
- NSIS installer:
  `artifacts/release/genre-to-draft-gates-a-c/Writing-Buddy-Genre-to-Draft-Gates-A-C-setup.exe`
  — SHA-256
  `A529AD82575AD17947702CD1F8CA47721919258B986CA910D3404D938DD7FA33`.
- Both are unsigned internal x64 builds. The final production EXE opened
  responsively with title `Writing Buddy`, did not expose the acceptance
  debugging port, accepted a normal window close, and exited with code 0.
- Machine-readable evidence:
  [genre-to-draft-gates-a-c-metrics.json](./genre-to-draft-gates-a-c-metrics.json).

Stop line: Gate D was not started.
