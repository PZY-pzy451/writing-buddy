# AI 提示契约一致性修复验收 — 2026-07-28

## 结论

用户截图中的 **模型已经正常使用，但 Story Kernel 没有生成候选** 已定位并
修复。问题不在 DeepSeek 模型、API Key 或账户：生成请求尚未发往 DeepSeek，
就在 Rust 本地安全校验阶段被错误拒绝为 **AI 配置不完整。**

实现提交：`9716f473`（`fix: keep ai prompt contracts in sync`）。

## 根因

连接测试只验证凭据、模型列表和余额，因此能够正常通过。真正生成前还有一道
安全契约：TypeScript 构造的系统提示必须与 Rust 允许的提示逐字一致。

提交 `830deedd` 为 Story Kernel 的剧情线、伏笔和信息资源增加了更严格的字段
约束，但只更新了 TypeScript 提示，Rust 副本仍为旧文本。结果是：

1. 设置页显示凭据和模型正常；
2. 前端构造合法的 Story Kernel 请求；
3. Rust 发现两端系统提示不相等；
4. 请求在联网前以 `invalid_configuration` 终止；
5. DeepSeek 没有收到请求，因此没有候选。

## 修复

- Rust `STORY_KERNEL_GENERATION_SYSTEM_PROMPT` 已与 TypeScript 完全一致。
- 没有移除或放宽本地提示、输入、隐私和结构校验。
- 新增跨语言仓库测试，逐字比较全部 14 个 TypeScript/Rust 系统提示。
- 新测试在修复前只复现 Story Kernel 一项失败；修复后 14 项全部通过。
- 依据 UI/UX 错误状态一致性原则，本轮修复真实状态来源，没有要求用户重复
  保存本来就有效的密钥或模型，也没有增加静默重试。

## 自动化验证

| 验证 | 结果 |
| --- | --- |
| TypeScript（测试前） | 通过 |
| 提示契约初始回归 | 14 项中仅 Story Kernel 失败，准确复现 |
| 提示契约修复后回归 | 14 / 14 通过 |
| Story Kernel 聚焦测试 | 3 文件 / 23 项通过 |
| Rust Story Kernel 请求校验 | 通过 |
| `pnpm acceptance` | ESLint、TypeScript、92 文件 / 309 项、Vite 全部通过 |
| `cargo fmt --all -- --check` | 通过 |
| `cargo test` | 49 通过 / 0 失败 / 2 个外部门禁忽略 |

首次全量运行中，一个与本修复无关的关联编排测试偶发读取到空夹具。该测试
单独复跑通过，随后完整 `pnpm acceptance` 也通过；没有为此修改关联编排代码。

当前 shell 使用 Node `25.2.1`，仓库声明 Node 24，因此 pnpm 显示 engine
warning；编译、测试、生产构建和原生打包仍全部成功。

## 安全边界

- 本轮没有读取、记录、替换或显示用户的 API Key。
- 自动化验证没有发起真实 DeepSeek 请求，也没有产生付费调用。
- Rust 仍会在联网前拒绝未知提示、越界上下文、敏感路径和不合法结构。
- AI 返回结果仍只能先进入候选区，通过 Schema 并由作者确认后才能写入。

## Windows 交付物

实现提交 `9716f473` 使用单 Cargo 任务完成 fresh Release 链接和 NSIS 打包。
隔离原生 smoke 启动 PID `14960`，成功进入 input-idle，进程保持响应，窗口
标题为 `Writing Buddy`；正常关闭成功，退出码为 `0`。

- 便携版：
  `tmp/ai-prompt-contract-parity-delivery/writing-buddy-next.exe`
  - 大小：7,352,832 bytes
  - SHA-256：
    `4FE33EF375DB004864EC1FE34A31937F165DF26B27393DBD6849343EB092B645`
- NSIS 安装版：
  `tmp/ai-prompt-contract-parity-delivery/Writing Buddy_0.1.0_x64-setup.exe`
  - 大小：3,194,008 bytes
  - SHA-256：
    `9E9CE1F3F486347CB6422AB14A1B4696FA2D9171A9168B5DFF75B19784EB0E8E`

## 用户复验

安装新版或直接运行本次便携版后，原有 Windows 凭据和 AI 偏好无需重新输入。
在相同章节、相同选区和人物目标下再次点击 **生成 Story Kernel 候选**；请求
现在会通过本地安全契约并进入 DeepSeek 生成阶段。真实模型输出质量和账户计费
只有用户主动点击生成时才会发生，本轮验收没有代替该人工门禁。
