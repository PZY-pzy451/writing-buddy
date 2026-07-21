# Windows Code-OSS Build Baseline

## Result

- Overall status: Passed for the Phase 0.1 local Windows source-build baseline.
- Build status: Passed. `npm install` exited 0; the first complete `npm run watch` build finished with 0 TypeScript or extension errors, and the watch process remained alive.
- Launch status: Passed. The first isolated Code-OSS development instance opened its Electron workbench and kept the main, extension-host, and agent-host processes alive.
- Second launch status: Passed. After a UI close, `scripts\code.bat` started a new instance, reopened the test workspace, and opened the persisted Chinese file without reinstalling dependencies.
- Chinese input status: Passed. No missing characters, duplicate input, cursor displacement, or line-break problem was observed.
- File save status: Passed. The required text exists at `D:\develop_tool\writing-buddy-test-workspace\中文输入测试.txt`, is 109 bytes, decodes as UTF-8, and matches the expected CRLF text exactly.
- CLI status: Passed. `scripts\code-cli.bat --version` exited 0 and returned `1.129.1`, `Unknown commit`, and `x64`.
- Fatal console errors: None. Developer Tools showed one non-fatal built-in extension proposal error and a non-fatal language-detection worker warning. During a 15-second observation, Console stayed at 14 messages, the worker warning stayed at 12 repeats, and fatal/crash/unresponsive markers stayed at 0.

## Environment

- Date: 2026-07-21 (Asia/Shanghai).
- Windows: Windows Home China 25H2, build 26200.8875. The registry `ProductName` value is `Windows 10 Home China`; the build/display-version values are recorded verbatim.
- Architecture: x64 (`AMD64`).
- Code-OSS tag: `1.129.1`.
- Git branch: `writer/baseline-1.129.1`.
- Git commit: `8a7abeba6e03ea3af87bfbce9a1b7e48fed567b8` (frozen upstream source before the documentation-only baseline commit).
- Node: `v24.18.0` from fnm, matching `.nvmrc`.
- npm: `11.16.0`.
- Python: `3.14.3` x64 at `C:\Users\Admin\AppData\Local\Python\pythoncore-3.14-64\python.exe`.
- Visual Studio Build Tools: Visual Studio Community 2022 17.14.27 (`17.14.37012.4`), MSVC v143 toolset `14.44.35207`, Native Desktop recommended components, and Spectre/ATL/MFC Spectre libraries.
- Windows SDK: `10.0.22621.0` and `10.0.26100.0`.

## Commands

- Dependency install: `npm install` with `npm_config_msvs_version=2022`, `npm_config_python` and `NODE_GYP_FORCE_PYTHON` pointing at Python 3.14.3.
- Build: `npm run watch`.
- Launch: `scripts\code.bat` with isolated `--user-data-dir`, `--extensions-dir`, `--shared-data-dir`, the test workspace, and a temporary remote-debugging port.
- CLI: `scripts\code-cli.bat --version`.

## Paths

- Repository: `D:\develop_tool\writing-buddy`.
- Build logs: `D:\develop_tool\writing-buddy\build-logs` plus environment/installer logs under `D:\develop_tool\build-logs`.
- Test workspace: `D:\develop_tool\writing-buddy-test-workspace`.

## Issues Encountered

| Issue | Root cause | Handling | Result |
| --- | --- | --- | --- |
| System Node did not match `.nvmrc` | The machine default was Node 25.2.1; source requires 24.18.0 | Installed Node 24.18.0 with fnm and used its stable installation directory first in `PATH` | Build and launch used Node 24.18.0 |
| Windows SDK and Spectre components were missing | Existing VS 2022 installation had MSVC but not the required SDK/Spectre component set | Modified the existing VS installation to add Native Desktop recommended components, Windows SDK 22621/26100, and Spectre/ATL/MFC Spectre libraries | `vswhere`, SDK directories, and Spectre directories all verify present |
| First VS installer command exited 87 | Installer 4.3 does not support the supplied `--wait` argument | Removed only `--wait` and reran the same component modification in quiet mode | Installer exited 0 |
| First Code-OSS launch stopped with a SideBySide error | The temporary fnm multishell `node.exe` path produced an invalid manifest parse event | Used the identical stable fnm Node binary from the version installation directory | Prelaunch scripts ran normally |
| First Electron extraction lacked four runtime files | The verified ZIP extraction stopped at the archive tail; Defender reported no quarantine | Kept the checksum-verified archive and reran the official `npm run electron` task | Complete patched `Code - OSS.exe` runtime was produced |
| Initial `npm install` transcript missed child output | PowerShell 5.1 `Start-Transcript` did not capture native child-process streams | Preserved the successful exit result and reran an idempotent install with direct stdout/stderr redirection | Second install exited 0 and produced `build-logs\npm-install.log` |
| Save As initially derived the filename from the first text line | UI automation focus selected the default name generated from editor content | Renamed the already-saved file within the same temporary workspace without rewriting its contents, then opened it from Explorer on the second launch | Required `中文输入测试.txt` exists and content matches exactly |
| Console reported non-fatal development-build messages | Built-in Mermaid proposal configuration and browser-worker language-detection packaging emitted diagnostics | Opened Developer Tools, inspected Console, and observed counts for 15 seconds | No persistent fatal loop; workbench, editing, save, reopen, and CLI remained functional |

## Remaining Risks

- The complete upstream unit/integration test suites were not run. Phase 0.1 verification is limited to dependency installation, full watch compilation, two source launches, editor persistence, Developer Tools inspection, and CLI operation.
- Windows packaging, code signing, updater behavior, and distributable installation were not tested; this is a development-runtime baseline only.
- The development CLI reports `Unknown commit`; the frozen source identity is therefore anchored by Git tag `1.129.1` and source commit `8a7abeba6e03ea3af87bfbce9a1b7e48fed567b8`, not the runtime version string alone.
- The language-detection worker warning means automatic language detection may be degraded in this development build. It was bounded at 12 repeats and did not affect the required plain-text Chinese editing workflow.

## Verification Evidence

- Initial environment inventory: `D:\develop_tool\build-logs\environment.txt`.
- Final environment inventory: `D:\develop_tool\build-logs\environment-final.txt`.
- fnm installation: `D:\develop_tool\build-logs\fnm-node-install.log`.
- Visual Studio installer attempt and successful retry: `D:\develop_tool\build-logs\vs-installer-attempt-1.log`, `D:\develop_tool\build-logs\vs-installer.log`.
- Dependency installation: `D:\develop_tool\writing-buddy\build-logs\npm-install.log`.
- Watch build: `D:\develop_tool\writing-buddy\build-logs\watch.log`.
- Launch investigation: `D:\develop_tool\writing-buddy\build-logs\code-launch-attempt-1.log`, `code-launch-attempt-2.log`, and `electron-redownload.log`.
- Successful first launch: `D:\develop_tool\writing-buddy\build-logs\code-launch.log`.
- Successful second launch: `D:\develop_tool\writing-buddy\build-logs\code-second-launch.log`.
- CLI version: `D:\develop_tool\writing-buddy\build-logs\code-oss-version.txt`.
- Persisted UTF-8 test file: `D:\develop_tool\writing-buddy-test-workspace\中文输入测试.txt`.
