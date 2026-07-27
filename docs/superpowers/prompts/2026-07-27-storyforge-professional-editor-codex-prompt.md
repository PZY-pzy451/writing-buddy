# Codex Execution Prompt — Writing Buddy StoryForge Professional Editor

你正在继续开发已迁移到 Tauri 2 + React + TypeScript + Rust 的 Writing Buddy。

本次工作的唯一产品与技术依据：

```text
docs/superpowers/specs/2026-07-27-storyforge-professional-editor-design.md
docs/superpowers/plans/2026-07-27-storyforge-professional-editor-implementation-plan.md
docs/design/storyforge-ui-layout-spec-v1.json
```

开始前，将交付包中的文件复制到上述仓库路径，并确认内容没有缺失。

---

## 一、执行方式

必须使用：

```text
superpowers:subagent-driven-development
```

或：

```text
superpowers:executing-plans
```

逐任务执行。禁止一次性重写全部系统。

执行顺序固定：

```text
Gate A  Project Open Reliability
Gate B  Story Kernel + Scene + Mentions
Gate C  Character + Relationships + Timeline
Gate D  Worldbuilding + Assets + Plot + Information
Gate E  Grounded AI + Continuity
Gate F  Performance + Recovery + Final Acceptance
```

每个 Gate 完成后立即停止并提交验收报告，等待人工批准。不得自动进入下一 Gate。

---

## 二、第一步：Source Map

先执行实施计划 Task 0。

必须调查真实仓库并记录：

- App Shell；
- Router；
- Project Open；
- Resource Tabs；
- Monaco Editor；
- Review；
- Version/Backup；
- DeepSeek Runtime；
- Tauri Commands；
- Tests；
- Build scripts。

建议路径与真实仓库不一致时：

1. 更新 `docs/plans/storyforge-source-map.md`；
2. 更新实施计划“路径映射附录”；
3. 不创建平行第二套模块；
4. 不进行无关重构。

---

## 三、绝对约束

1. Story Kernel 不得导入 React、Tauri、Monaco、Node `fs` 或 DeepSeek Provider。
2. React 不得获得任意文件系统路径读写能力。
3. 正式故事数据存储于 `story/`；缓存和派生索引存储于 `.writing-buddy/`。
4. 所有写入必须 Schema 校验、revision 检查和原子替换。
5. AI 结果只能成为候选，不得自动修改正文或正式资料。
6. AI 提取结果必须进入待确认区，作者逐项确认。
7. 作者秘密默认不进入 AI Context Pack。
8. 不允许新旧数据格式静默漂移。
9. 不允许以 Mock 数据页面截图代替真实项目验收。
10. 不允许通过关闭安全校验或删除测试来通过 Gate。
11. 不使用 `latest` 依赖。
12. 每个任务必须 TDD、独立提交、`git diff --check`。

---

## 四、UI 契约

基准窗口：

```text
1536 × 992
Windows 标题栏：32
TopBar：0,32,1536,68
GlobalRail：0,100,78,852
ProjectPane：78,100,304,852
Workspace：382,100,815,852
Assistant：1197,100,339,852
StatusBar：0,952,1536,40
```

详细坐标从：

```text
docs/design/storyforge-ui-layout-spec-v1.json
```

读取。

响应式必须验收：

```text
1536×992
1280×800
1024×720
```

不得出现：

- 页面级横向滚动；
- 控件重叠；
- 被遮挡的主要操作；
- 低于 36×36 的关键点击区域；
- 只有颜色区分的状态；
- 图谱无列表/矩阵替代。

---

## 五、首个 Gate

当前首先只允许完成：

```text
Task 0
Task 1
```

即：

```text
冻结 Source Map
修复“无法打开作品”
提供结构化错误
支持只读打开、修复、诊断、重试
真实项目副本打开
关闭并第二次启动恢复
```

Gate A 未通过前，禁止创建 Story Kernel 文件或专业资料页面。

---

## 六、每个 Gate 的验收报告

最终回复必须包含：

```text
1. Gate 状态
2. 基线 commit/tag
3. 实际执行任务
4. 创建/修改文件
5. 核心接口
6. UI 结果与截图路径
7. 自动测试命令与精确结果
8. 手动真实项目验收
9. 数据兼容结果
10. 性能结果
11. 安全与隐私结果
12. 已知问题
13. git status
14. commits
15. 是否建议进入下一 Gate
```

没有真实证据不得声明 COMPLETE。
