# Genre-to-Draft Gate I 核心旅程验收

日期：2026-07-30

工作树：`D:\develop_tool\writing-buddy-genre-to-draft`

分支：`codex/genre-to-draft-gates-a-c`

基线：`5c1e0eeb feat: reconcile draft changes with story plans`

## 结论

Gate I 通过。结构化大纲现在具备离线确定性结构检查和由作者显式触发的
AI 语义建议；两者都只读，不会替作者改写大纲。真实界面已从新建项目走到
题材生成、编辑与锁定、局部候选、卷/章/场景物化和正文编辑器，最终生产
Release、NSIS 与正常关闭冒烟全部通过。

## 大纲质量检查

本地检查完全离线，覆盖九类硬错误：空标题、空摘要、同级顺序重复、孤立
节点、场景缺少章节、章节缺少卷、重复 ID、锁定节点被修改，以及章节规划
状态与已物化正文状态不一致。检查器使用映射与分组进行单次遍历；512 节点
测试满足 100 ms 预算。

AI 检查复用现有 `creation-journey` 作业。打开“检查大纲”只运行本地规则；
只有再次点击“AI 语义检查”才会发起请求。同一时刻的重复触发合并为一个
请求。响应只能包含问题代码、节点、原字段证据、影响和建议，不允许补丁或
替换内容；未知节点、伪造引文和带修改字段的响应都会在边界被拒绝。

界面按“本地规则 / AI 建议”分组，显示错误、警告和建议文本。问题可定位
到节点；结果绑定大纲修订号，修改后会标记过期，不会自动重跑 AI。

## 真实纵向链

浏览器确定性 AI 夹具完成了以下可见操作：

1. 新建 `Gate I 完整纵向链` 项目并选择题材创作起点。
2. 输入“都市悬疑”和一句话设想，经 Context Preview 明确确认后生成大纲。
3. 修改并锁定节点，验证锁定后不能编辑或生成候选；解锁后生成 A/B/C 三个
   局部候选，只采用三个勾选字段，再次锁定。
4. 本地检查返回 0 个错误；作者显式运行 AI 检查后得到 1 条带原文证据的
   建议，大纲内容保持不变。
5. 将大纲拆为 1 卷、1 章、1 场景；每次先显示预览，再由作者确认。
6. 原子创建正式卷、章节、场景与正文锚点，进入 `第1章 · 夜雨名单` 编辑器。

Gate G 的上下文续写/候选/Undo 与 Gate H 的计划—实际对比/作者选择更新仍由
现有自动化覆盖；本轮没有复制这些运行时或建立第二套数据源。

## 响应式与无障碍

实测发现并修复两项裁切：390×844 下检查面板原先被作品侧栏挤至 79 px，
现改为相对窗口的 8 px 覆盖层；1024 px 下创作阶段导航原先因 `width:100%`
叠加 padding 多出 20 px，现采用 border-box。最终结果：

| 视口 | 面板 | 页面横向溢出 | 最小操作高度 |
| --- | --- | ---: | ---: |
| 1536×960 | 1058×732 | 0 | 44 px |
| 390×844 | 374×828，左右各 8 px | 0 | 44 px |

按钮具备可见 `:focus-visible`，状态通过文字与图标共同表达，动态结果使用
语义 region/status。机器可读指标见
[Gate I metrics](./genre-to-draft-gate-i-metrics.json)。

截图：

- [桌面大纲检查](./screenshots/genre-to-draft-gate-i/outline-check-wide.png)
- [390 px 大纲检查](./screenshots/genre-to-draft-gate-i/outline-check-narrow.png)
- [物化后正文编辑器](./screenshots/genre-to-draft-gate-i/materialized-editor.png)

## 自动化与原生验证

- Gate I 聚焦测试：4 文件 / 12 测试通过。
- 全量前端：154 文件 / 588 测试通过；ESLint、TypeScript、生产构建通过。
- `self-test:release`：285.5 秒通过，包含 diff 检查、完整前端验收、Cargo
  格式、全部 Rust 测试和生产 Tauri/NSIS 构建。
- Rust：67 通过，2 个需外部真实项目/性能夹具的门禁按设计忽略，0 失败。
- Phase 1.2B Edge/CDP 完整旅程通过；原生 Gate D 的真实项目、快照、原子
  写入、关闭重开与恢复通过。
- 最终便携版 607 ms 出现主窗口，正常关闭，退出码 0。

完整发布自测报告：`artifacts/self-test/latest.json`。

## Windows 交付物

目录：`artifacts/release/genre-to-draft-gate-i/`

- `Writing-Buddy-0.1.0-genre-to-draft-gate-i-portable.exe`
  - 8,358,912 bytes
  - SHA-256: `509008AEE8725DEE335CF9B3EB6EC6C4C444B1EE63B88A9A50B840B74124BE37`
- `Writing-Buddy-0.1.0-genre-to-draft-gate-i-setup.exe`
  - 3,625,931 bytes
  - SHA-256: `392E96D2829B6F7A288EC250498D8ABDE6543C0F3F89CF4091DB288CC7034EF8`

`SHA256SUMS.txt` 与两个 EXE 同目录。最终交付使用普通生产配置，未开放
验收用 CDP 端口。

## 已知非阻断项

- Windows 产物未做代码签名，首次运行可能出现 SmartScreen 提示。
- Vite 继续报告既有 Monaco 大 chunk 警告；不影响功能、启动或本 Gate 验收。
