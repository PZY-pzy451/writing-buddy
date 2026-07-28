# Codex 执行提示词：StoryForge AI 快速生成与正文提取

你正在继续开发已经迁移到独立 Tauri 客户端的 Writing Buddy。

当前已经具备 DeepSeek API 配置、流式生成、停止、复制、清空、Token/耗时显示。当前问题是 AI 主要存在于隔离测试台，还没有系统接入正文、人物、关系、世界观、时间线、物品、剧情线和伏笔工作流。

请严格依据：

```text
docs/superpowers/specs/2026-07-27-storyforge-ai-quick-actions-design.md
docs/superpowers/plans/2026-07-27-storyforge-ai-quick-actions-implementation-plan.md
```

实施。

## 绝对要求

1. 先执行 Source Map，检查当前仓库真实实现。
2. 不假设设计文档建议目录与实际目录相同。
3. 不创建第二套 DeepSeek Provider、Secret Store、SSE Parser、Job Queue 或 Usage。
4. 已实现的人物、世界观、时间线、物品、Review、Version 必须复用。
5. 缺失功能才新增。
6. 所有 AI 输出先 Preview，再由作者确认。
7. 结构化资料必须通过版本化 Schema。
8. 正文修改必须 Diff + Undo。
9. Apply 前验证 revision；变化后标记 stale。
10. 写入结构化数据前创建安全快照。
11. 默认不发送整章、整卷、整本小说或作者秘密。
12. 不允许 AI 后台自动改写。
13. 使用 TDD。
14. 每个 Gate 单独提交和验收。
15. 没有真实证据不得声称完成。

## 第一次执行范围

本轮只执行：

```text
Gate A：Source Map 与公共基础
Gate B：Context 与统一 AI Drawer
```

包括：

```text
Source Map
当前能力矩阵
AI Action Registry
Prompt Registry
Structured Output Validator
Context Pack
Context Preview
Unified Generation Drawer
Preview Transaction
```

不要在本轮实现具体人物、时间线或世界观生成。

## 第一轮完成后必须停止

提交：

- Source Map；
- 当前能力矩阵；
- 实际文件路径；
- 公共接口；
- 单元测试；
- 统一 AI Drawer 截图；
- Context Preview 截图；
- DeepSeek Runtime 无回归证明；
- Revision/Stale/Transaction 测试；
- Git commits；
- Gate A/B 是否通过。

得到用户批准后，才进入正文 AI。
