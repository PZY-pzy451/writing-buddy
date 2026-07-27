# StoryForge Gate C — 人物、关系与时间线验收报告

日期：2026-07-27  
分支：`codex/phase-1.0a-deepseek-ai-foundation`

## 1. Gate 状态

**COMPLETE — 等待人工确认。**

Task 9–12 已完成：人物中心与动态状态、带方向和时间切片的关系图/矩阵、故事时间与叙事顺序分离的多轨时间线，以及确定性的时间/地点冲突规则。当前严格停在 Gate C；Task 13 的世界观、地点和规则页面尚未开始。

## 2. 本阶段 commits

- `af708b1` — `feat: add character center and position-aware states`
- `97068f8` — `feat: add time-aware character relationship graph and matrix`
- `e6adfa2` — `feat: add story and narrative timeline views`
- `82cb6d5` — `feat: detect deterministic timeline and location conflicts`
- `a648bcd` — `fix: expand Gate C work areas across target viewports`

## 3. 修改范围

相对 Gate B 完成提交 `4f13d12`，Gate C 共修改 41 个文件，新增约 5,309 行：

- `packages/story-kernel/src/model/`：Character、StateRecord、Relationship、TimelineEvent。
- `packages/story-kernel/src/query/`：故事时间/叙事顺序查询、窗口和筛选。
- `packages/story-kernel/src/validation/`：重叠、前置倒置和移动时间不足规则。
- `apps/desktop/src/features/story/characters/`：人物列表、筛选、七个详情页签、编辑与状态切片。
- `apps/desktop/src/features/story/relationships/`：有向图、矩阵、Inspector、历史/证据和 Worker 布局。
- `apps/desktop/src/features/story/timeline/`：虚拟轨道、缩放、键盘操作、列表替代视图和事件 Inspector。
- `apps/desktop/src/theme/workspace.css`：三档响应式布局和完整高度修复。
- `apps/desktop/src/platform/bridge.ts`：浏览器验收模式的 Gate C 脱敏演示数据。

## 4. Task 9 — 人物中心

- Character 支持角色、代称、出生、外观、职业、势力、目标、欲望、恐惧、价值观、秘密、语言风格和证据。
- StateRecord 支持位置、生存、伤势、情绪、当前目标、持有物品、已知信息、误解信息和能力变化。
- 状态按 `StoryPosition` 生效，可查看任意叙事位置的当前状态。
- 同一位置的候选状态会显示冲突和作者确认状态。
- 人物中心提供概览、当前状态、人物弧、关系、时间线、出场记录、来源与冲突七个页签。
- 切换人物或页签时有未保存表单保护；保存继续使用 Story Repository revision 检查。

## 5. Task 10 — 人物关系

- 关系是有方向的独立资源；`林墨 → 沈青` 与 `沈青 → 林墨` 不会合并。
- 支持类型、强度、公开程度、生效/失效位置、描述、变化历史和证据。
- 图谱与无障碍矩阵使用同一时间切片结果。
- 图谱布局在 Web Worker 中运行，默认硬限制为 150 个节点、500 条边，并报告被省略数量。
- 支持一至二跳人物聚焦、键盘选择关系边、Inspector 编辑和证据/历史查看。

## 6. Task 11 — 多轨时间线

- Story time 支持精确时间、日期、相对时间、不确定范围和未知时间。
- `story-time` 与 `narrative-order` 两种排序完全分离。
- 可按人物、地点、剧情线和事件类型切换轨道。
- 轨道采用窗口化渲染，支持缩放、横向滚动和键盘导航。
- 提供语义表格作为无障碍替代视图。
- 事件 Inspector 支持新建、编辑和保存，显示前置、后果和证据数量。

## 7. Task 12 — 确定性规则

纯规则引擎已覆盖：

- 同一人物在重叠时间内出现在两个地点。
- 前置事件在故事时间上晚于后续事件。
- 两地点之间的可用移动时间小于配置的最短旅行时间。

每条规则结果都包含两个证据位置，并通过 `TimelineReviewAdapter` 转换为现有 `ReviewIssue`，不直接修改正文。

## 8. 布局问题修复

视觉验收发现时间线和关系页将不存在的错误提示当作空网格行，导致主工作区只按内容高度展开。修复后：

- 1536×992 等效窗口中，时间线主区域从约 305px 高扩展至约 696px。
- 关系图填满可用的 696px 主区域。
- 1280×800 档项目栏为 280px。
- 1024×720 档项目栏为 240px，中央区域为 706×580。
- 三档页面外层横向和纵向溢出均为 0px；时间线内部保留预期的横向滚动。
- Tauri 默认内容窗口改为 1536×960，最小内容窗口为 1024×688，对应带 32px Windows 标题栏的 1536×992 和 1024×720。

## 9. 截图和视觉数据

截图由与桌面端相同的生产 React renderer 在隔离 Edge 实例中生成，使用与验收项目一致的脱敏正式资源；Tauri 发布包另行完成启动存活验证。未操作用户正在使用的其他窗口。

- [人物中心 1536×992](./screenshots/gate-c/01-character-center-1536x992.png)
- [关系图 1536×992](./screenshots/gate-c/02-relationship-graph-1536x992.png)
- [多轨时间线 1536×992](./screenshots/gate-c/03-timeline-1536x992.png)
- [关系图 1280×800](./screenshots/gate-c/04-relationship-1280x800.png)
- [多轨时间线 1024×720](./screenshots/gate-c/05-timeline-1024x720.png)
- 精确测量：[gate-c-visual-metrics.json](./gate-c-visual-metrics.json)

| 原生窗口 | 内容视口 | 项目栏 | 工作区 | 页面溢出 |
| --- | --- | ---: | ---: | --- |
| 1536×992 | 1536×960 | 304px | 1154×852 | 0×0px |
| 1280×800 | 1280×768 | 280px | 922×660 | 0×0px |
| 1024×720 | 1024×688 | 240px | 706×580 | 0×0px |

## 10. 自动测试

使用项目要求的 Node `24.14.0` 和 pnpm `10.32.1`：

```powershell
pnpm acceptance
```

- ESLint：通过，0 error / 0 warning。
- TypeScript：通过，0 error。
- Vitest：29 files / 98 tests passed。
- Vite：2,662 modules transformed；生产构建通过；关系布局 Worker 独立输出。

```powershell
cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

- Rust fmt：通过。
- Rust：27 passed / 0 failed。
- MSVC 仅输出“正在创建库”的信息性 linker warning。

## 11. 真实项目副本与数据兼容

验收副本：

```text
D:\develop_tool\writing-buddy-next\tmp\storyforge-gate-c-project-20260727-1425
```

它从脱敏 `fixtures/legacy-projects/10-full` 创建，并增加：

- 3 个人物资源。
- 4 条人物状态，其中包含同一叙事位置的位置冲突。
- 3 条有向关系和一条变化历史。
- 3 个时间线事件，覆盖故事时间与叙事顺序不同的情况。
- 原有 6 个 Markdown 章节 SHA-256 全部保持不变。

`pnpm compatibility:report` 结果：10/10 fixtures passed，0 blocking。没有修改任何真实作者项目。

## 12. 性能结果

- 三个 1536 档页面从重新加载到目标页面可交互：552–908ms。
- 1280 关系页：607ms。
- 1024 时间线页：615ms。
- 150 节点 / 500 边上限由自动测试覆盖；额外节点和边只计数、不进入 DOM。
- 时间线只渲染当前窗口内事件，横向大范围通过内部滚动处理。
- 完整 Vitest 测试批次：3.82s。

大型项目正式性能预算、索引和 50,000 事件压力测试仍属于 Task 21 / Gate F，本阶段结果不能替代 Gate F。

## 13. 发布构建与运行

标准 release EXE 正被旧实例占用，因此按既有安全策略使用隔离 Cargo target；没有结束用户原来的标准版进程。

- EXE：`tmp/gate-c-target-final/release/writing-buddy-next.exe`
  - 6,830,592 bytes
  - SHA-256 `14E79D8383BDCA382E9B4BF594DC5688970B1E3244CFAD59800806E15A39F3D2`
- NSIS：`tmp/gate-c-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 2,975,348 bytes
  - SHA-256 `6D6C0338A581A9633C0DC0C02F88351A4B35088F4966BEF617F21AE0699255CB`

先前由 Codex 启动的隔离实例通过原生 `CloseMainWindow` 正常退出。最终 EXE 已启动并保持运行，启动 PID 为 `43128`；用户原来的标准版 PID `38436` 未被操作。

## 14. 已知问题

- 图谱当前采用确定性 Worker 布局，不含拖拽后位置持久化；这不影响 Gate C 的方向、时间切片和容量要求。
- 关系 Inspector 与事件 Inspector 在紧凑宽度下以覆盖式抽屉显示，这是设计规定的 compact 行为。
- Story Kernel 目前仅进入 Gate C；世界观、地点、势力、物品、剧情线、伏笔和信息权限仍属于 Gate D。
- 大型项目索引、恢复和正式性能门槛仍属于 Gate F。
- AI 自动/手动审校已在 Phase 1.0B 完成；基于 Story Kernel 的 Grounded Context Pack 属于 Gate E。

## 15. 是否建议进入下一 Gate

**建议人工确认后进入 Gate D。**

Gate C 的功能、自动测试、数据兼容、三档布局、发布构建和运行验证均已完成。按照交付约束，本提交后停止，不执行 Task 13，等待人工批准。
