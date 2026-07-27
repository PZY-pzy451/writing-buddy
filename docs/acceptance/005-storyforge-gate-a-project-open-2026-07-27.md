# 005 — StoryForge Gate A project-open acceptance, 2026-07-27

## 1. Gate 状态

`READY FOR HUMAN APPROVAL`

Task 0 与 Task 1 已完成。真实 Tauri 发行版已打开验收作品副本，并在受控
异常退出留下旧锁后，于第二次启动自动恢复到同一作品和章节。Gate A 在此
停止；未创建 Story Kernel、人物、关系、时间线或其他 Gate B 以后文件。

## 2. 基线 commit/tag

- 功能基线：`7e658a284920b0e61d42da39a0addaa39bd6b11d`
- Task 0：`d2556ed` — `docs: freeze storyforge source map and baseline`
- 工作分支：`codex/phase-1.0a-deepseek-ai-foundation`

## 3. 实际执行任务

- Task 0：复制完整 StoryForge 交付包，冻结 Source Map、自动化基线和旧版
  “无法打开作品”实机复现。
- Task 1：增加结构化打开错误、阶段与能力标记、重试、只读打开、旧锁修复、
  打开目录、诊断信息和稳定的首次启动落地页。
- 将新服务接入既有 Zustand store、DesktopBridge、Rust command、
  migration reader 和 process lock；没有建立第二套路由或项目模块。
- 新建脱敏验收项目副本并执行真实发行版打开、异常退出、二次启动恢复与损坏
  清单错误验收。

## 4. 创建/修改文件

主要实现文件：

- `apps/desktop/src/features/projects/application/ProjectOpenService.ts`
- `apps/desktop/src/features/projects/application/ProjectOpenService.test.ts`
- `apps/desktop/src/features/projects/ui/ProjectOpenErrorDialog.tsx`
- `apps/desktop/src/features/projects/ui/ProjectOpenErrorDialog.test.tsx`
- `apps/desktop/src/features/projects/ui/ProjectOpenExperience.test.tsx`
- `apps/desktop/src/app/store.ts`
- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/platform/bridge.ts`
- `apps/desktop/src/theme/workspace.css`
- `packages/platform-ports/src/index.ts`
- `apps/desktop/src-tauri/src/commands/mod.rs`
- `apps/desktop/src-tauri/src/process_lock/mod.rs`
- `apps/desktop/src-tauri/src/lib.rs`

Task 0 文档与交付包路径详见
`docs/plans/storyforge-source-map.md`。

## 5. 核心接口

```ts
type ProjectOpenMode = 'read-write' | 'read-only';

interface PublicProjectOpenError {
  code: string;
  stage: ProjectOpenStage;
  safePath?: string;
  canOpenReadOnly: boolean;
  canRepair: boolean;
  diagnosticId: string;
}
```

`ProjectOpenService` 暴露读写打开、只读打开、旧锁修复和打开目录。Rust
`open_project` 返回可序列化的公共错误，不再将所有失败压缩为同一句提示。
错误对话框根据能力显示或隐藏 `重试`、`只读打开`、`修复项目`、`打开目录`、
`查看诊断` 和 `关闭`。

## 6. UI 结果与截图路径

- 首次真实打开：
  [storyforge-gate-a-first-open.png](./assets/storyforge-gate-a-first-open.png)
- 异常退出后的第二次启动恢复：
  [storyforge-gate-a-second-launch-restored.png](./assets/storyforge-gate-a-second-launch-restored.png)
- 损坏清单的结构化错误：
  [storyforge-gate-a-structured-error.png](./assets/storyforge-gate-a-structured-error.png)
- 旧版泛化错误基线：
  [storyforge-gate-a-baseline-open-failure.jpg](./assets/storyforge-gate-a-baseline-open-failure.jpg)

新布局在没有历史项目时停留在稳定落地页，不会在应用启动时自动弹出系统目录
选择器。损坏清单会显示失败阶段、安全路径和可用恢复动作。

## 7. 自动测试命令与精确结果

TDD 首轮按预期失败：项目打开 service 与 dialog 尚不存在，2 个测试套件失败。
完成实现后的最终结果：

| 命令 | 结果 |
| --- | --- |
| `pnpm acceptance` | ESLint 0 warning；TypeScript 通过；Vitest 12 files / 37 tests；Vite build 通过 |
| `cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml` | 通过 |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | 19 tests passed / 0 failed；0 doc tests |
| `pnpm tauri:build` | release EXE 与 NSIS 均构建成功 |
| `git diff --check` | 通过 |

最终产物：

- `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 6,716,416 bytes
  - SHA-256:
    `9C2D227D9558F7FAE0985190EC83C7CE99955D2C027E3D72DFCF9742B43CCBEC`
- `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 2,922,567 bytes
  - SHA-256:
    `6A2861840F040C7D6EC98E9D21FF83BB898668B972A2292247C65D11EFFA52D4`

## 8. 手动真实项目验收

验收副本：

```text
tmp/storyforge-gate-a-project-20260727
```

它由脱敏 `fixtures/legacy-projects/10-full` 精确复制，包含 2 卷、6 章和 5 个
资料资源。最终发行版首次启动后打开 `脱敏测试作品 10 / 第1章 示例`，目录和
32 字正文正常呈现。

随后受控停止应用，保留 PID `26760` 的运行锁以模拟异常退出。第二次启动
PID `46916` 自动识别旧锁、重新取得读写锁并恢复同一作品和章节。第二次截图
与首次截图内容一致。此路径同时验证 recent-project 持久化和旧锁恢复。

正常退出的锁清理由 Rust `release_all_removes_the_current_process_lock` 测试
覆盖，并由 Tauri `Exit` / `ExitRequested` 事件调用。

## 9. 数据兼容结果

- 验收前后受管理文件：17 / 17
- SHA-256 差异：0
- 总大小（排除运行锁）：7,120 bytes
- `.writing-buddy/project.json` SHA-256：
  `BCFF2896E08EDBA5D3E3A6EF76A1EF2F03FE287929737F7E41049E15F521FE96`
- 运行时只创建或更新 `.writing-buddy/runtime/project.lock`
- 原始 fixture 与真实作者项目均未修改

## 10. 性能结果

以进程开始到读写锁落盘作为可重复的项目打开完成代理指标：

- 首次启动并打开：1,104 ms
- 第二次启动、清理旧锁并恢复：1,452 ms

截图在启动后 5 秒与 4 秒采集。上述数值不是首帧绘制指标，但包含项目读取、
兼容迁移扫描和锁获取。

## 11. 安全与隐私结果

- 公共错误只包含固定错误码、阶段、能力、安全路径和随机诊断编号。
- Windows `C:\Users\<name>` 路径在 Rust 与 TypeScript 两层脱敏为
  `C:\Users\***`。
- 诊断编号不包含用户名、锁 PID、正文或 API Key。
- 对未知或非结构化异常使用固定 `projectOpenFailed`，不回显原始异常文本。
- 修复动作只处理不存在、损坏或已失效的 `project.lock`，不改清单和正文。
- 只读打开不取得写锁。

## 12. 已知问题

- 真实 DeepSeek Key 和 AI 自动审校仍是之前里程碑的人工门禁，不属于 Gate A。
- 本轮未自动点击系统目录选择器；真实打开通过独立 WebView 配置恢复路径完成，
  避免干扰用户鼠标键盘。目录选择本身已有现有桥接测试覆盖。
- 进程到首帧的精确绘制时间尚未加入产品遥测；本报告使用锁落盘时间。
- Gate A 仍需人工评审确认，才能进入 Story Kernel。

## 13. git status

Task 1 将以独立 commit 提交。提交后预期工作树干净；本报告最终回复记录精确
commit 与 push 结果。

## 14. commits

- `d2556ed` — `docs: freeze storyforge source map and baseline`
- Task 1 — `fix: make project opening diagnosable and recoverable`

## 15. 是否建议进入下一 Gate

建议在人工审阅本报告、三张实机截图和 Task 1 diff 后批准 Gate A。未获得明确
批准前，不进入 Gate B。
