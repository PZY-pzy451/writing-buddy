# Windows Code-OSS Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify that upstream Code-OSS 1.129.1 can be installed, compiled, launched twice, and used for UTF-8 Chinese text editing on Windows, then record a recoverable Git baseline.

**Architecture:** Keep the upstream source unchanged. Treat generated dependencies, compiler output, runtime profiles, test files, and logs as disposable evidence; commit only durable project documentation after every acceptance check passes.

**Tech Stack:** Windows 11, PowerShell, Git, fnm, Node.js 24.18.0 from `.nvmrc`, npm, Python, Visual Studio 2022 Build Tools, Code-OSS/Electron.

## Global Constraints

- Repository: `D:\develop_tool\writing-buddy` from `https://github.com/microsoft/vscode.git`.
- Frozen version: `1.129.1`.
- Development branch: `writer/baseline-1.129.1`.
- Baseline tag: `baseline-code-oss-1.129.1-windows`.
- Do not change branding, product behavior, built-in extensions, or novel-writing features.
- Do not delete or overwrite user work; never use `git clean -xfd` or `git reset --hard`.
- Do not commit `node_modules`, generated output, large logs, or the temporary test workspace.

---

### Task 1: Capture Repository and Environment Baseline

**Files:**
- Create: `D:\develop_tool\build-logs\environment.txt`
- Modify: `docs/progress.md`
- Modify: `docs/memory/2026-07-21.md`

**Interfaces:**
- Consumes: the existing checkout, Windows registry/tool discovery, and Visual Studio Installer metadata.
- Produces: exact tool paths and versions used by every later task.

- [x] **Step 1: Verify repository identity, cleanliness, branch, tag, and commit**

Run `git remote -v`, `git status --short`, `git branch --show-current`, `git describe --tags --always`, and `git rev-parse HEAD`.

- [x] **Step 2: Capture Windows and toolchain inventory**

Run the environment commands from the Phase 0.1 specification, including `Get-ComputerInfo`, `py --list-paths`, `vswhere.exe`, Windows SDK discovery, and Spectre library discovery; save all output to `D:\develop_tool\build-logs\environment.txt`.

- [x] **Step 3: Verify the fixed Node requirement**

Run `Get-Content .nvmrc`, initialize fnm, then compare `node --version` with `.nvmrc`.

### Task 2: Install Dependencies

**Files:**
- Create: `build-logs/npm-install.log`
- Modify: `docs/progress.md`
- Modify: `docs/memory/2026-07-21.md`

**Interfaces:**
- Consumes: Node 24.18.0, npm, Python, MSVC v143, Spectre libraries, and a Windows SDK.
- Produces: `node_modules/` and a complete install transcript.

- [x] **Step 1: Set the build environment**

Set `npm_config_msvs_version=2022`, `npm_config_python` to the discovered Python executable, and `NODE_GYP_FORCE_PYTHON` to the same path.

- [x] **Step 2: Install dependencies and preserve the exit code**

Run `npm install` under a PowerShell transcript at `build-logs\npm-install.log`; require exit code 0.

- [x] **Step 3: Verify installation output**

Run `Test-Path .\node_modules` and `git status --short`; investigate the first root error if installation failed.

### Task 3: Complete the First Watch Build

**Files:**
- Create: `build-logs/watch.log`
- Modify: `docs/progress.md`
- Modify: `docs/memory/2026-07-21.md`

**Interfaces:**
- Consumes: installed dependencies and the fixed Node toolchain.
- Produces: compiled main sources and built-in extensions plus a live watch process.

- [x] **Step 1: Start `npm run watch` with durable output capture**

Launch the watch process from the repository root and redirect stdout/stderr to `build-logs\watch.log` without blocking later UI validation.

- [x] **Step 2: Wait for an explicit full-build completion marker**

Require the current-version equivalent of `Finished compilation`, confirm the process is still alive, and scan the entire log for TypeScript or extension build errors.

- [x] **Step 3: Resolve the first root cause and rerun if needed**

Do not hide errors or treat chained failures as independent causes.

### Task 4: Launch and Validate Code-OSS Twice

**Files:**
- Create: `build-logs/code-launch.log`
- Create: `build-logs/code-oss-version.txt`
- Create: `D:\develop_tool\writing-buddy-test-workspace\中文输入测试.txt`
- Modify: `docs/progress.md`
- Modify: `docs/memory/2026-07-21.md`

**Interfaces:**
- Consumes: compiled Code-OSS runtime and its native Windows launch scripts.
- Produces: runtime process/UI evidence, CLI version evidence, and persisted UTF-8 Chinese content.

- [x] **Step 1: Launch the first isolated development instance**

Run `.\scripts\code.bat` with explicit temporary `--user-data-dir`, `--extensions-dir`, and the test workspace; capture launcher output and verify the Electron main and extension-host processes remain alive.

- [x] **Step 2: Verify CLI and visible workbench state**

Run `.\scripts\code-cli.bat --version`, require exit code 0, and save output to `build-logs\code-oss-version.txt`; inspect the window using browser/UI automation or Windows UI control.

- [x] **Step 3: Enter and save the required Chinese text**

Create `中文输入测试.txt` through the Code-OSS editor, save it, and verify exact UTF-8 disk content with `Get-Content -Encoding UTF8`.

- [x] **Step 4: Inspect Developer Tools**

Open `Developer: Toggle Developer Tools` and confirm there is no continuously repeating fatal console error.

- [x] **Step 5: Close and launch a second time**

Stop only the test instance, run `.\scripts\code.bat` again with the same isolated profile and workspace, and confirm the saved file reopens without reinstalling dependencies.

### Task 5: Document, Verify, Commit, and Tag the Baseline

**Files:**
- Create: `docs/build/windows-code-oss-baseline.md`
- Modify: `docs/progress.md`
- Modify: `docs/memory/2026-07-21.md`

**Interfaces:**
- Consumes: fresh logs and acceptance evidence from Tasks 1-4.
- Produces: the durable Windows baseline commit and annotated baseline tag.

- [x] **Step 1: Write the baseline report from actual evidence**

Populate every required section, naming concrete failures, fixes, remaining risks, and evidence paths.

- [x] **Step 2: Run the complete acceptance checklist**

Re-run Git/tool versions, CLI version, exact file-content verification, watch-log error scan, and process/window checks. Confirm upstream source files are unmodified.

- [x] **Step 3: Commit only durable documentation**

Stage the reviewed documentation only and run `git commit -m "docs: record Windows Code-OSS build baseline"` after all acceptance conditions pass.

- [x] **Step 4: Create and verify the annotated tag**

Create `baseline-code-oss-1.129.1-windows` only if absent, then verify its target, `git log -1 --oneline`, and final `git status`.
