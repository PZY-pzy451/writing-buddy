# Windows Writing Buddy Branding Baseline

## Result

Phase 0.2 passed on Windows. The Code-OSS 1.129.1 source baseline was converted into a local downstream repository, the approved Windows product identity was applied only in `product.json`, the Electron runtime was regenerated as `Writing Buddy.exe`, a complete main-source plus built-in-extension Watch build finished with zero blocking errors, and the isolated runtime passed two launches, CLI, Developer Tools, workspace recovery, and Chinese-file hash checks.

This report covers a source-development runtime. It does not claim packaged installers, code signing, cross-platform branding, update/Marketplace changes, or Phase 0.3 author-workbench behavior.

## Repository Topology

- Repository: `D:\develop_tool\writing-buddy`
- Frozen upstream version: `1.129.1`
- Frozen source commit: `8a7abeba6e03ea3af87bfbce9a1b7e48fed567b8`
- Phase 0.1 baseline commit: `9f626f7e2ef574c265a53317b18e704545a4c99f`
- Phase 0.2 starting/design commit: `89e244476702f63f9b7283e0f08fbd7e93a799d4`
- Branch: `writer/phase-0.2-minimal-branding`
- Upstream: `https://github.com/microsoft/vscode.git`
- Local bare origin: `D:\develop_tool\writing-buddy-downstream.git`
- Final annotated tag target: `baseline-writing-buddy-0.2-windows`

The source checkout is shallow. Before the initial downstream push, all 98 Git LFS objects reachable from `1.129.1` were fetched from upstream. The local bare origin was configured with `receive.shallowUpdate=true` so the verified shallow downstream history could be received without changing or pushing to Microsoft upstream.

## Product Identity

Only the following `product.json` fields changed:

| Field | Value |
| --- | --- |
| `nameShort` | `Writing Buddy` |
| `nameLong` | `Writing Buddy` |
| `applicationName` | `writing-buddy` |
| `dataFolderName` | `.writing-buddy` |
| `sharedDataFolderName` | `.writing-buddy-shared` |
| `win32MutexName` | `writingbuddy` |
| `win32DirName` | `Writing Buddy` |
| `win32NameVersion` | `Writing Buddy` |
| `win32RegValueName` | `WritingBuddy` |
| `win32AppUserModelId` | `WritingBuddy.Desktop` |
| `win32ShellNameShort` | `Writing &Buddy` |
| `urlProtocol` | `writing-buddy` |

The approved four Windows AppId fields also changed. No global Code-OSS string replacement, icon replacement, workbench change, source change, extension metadata change, package manifest change, update behavior change, or telemetry behavior change was made.

## Generated Windows AppIds

| Field | Value |
| --- | --- |
| `win32x64AppId` | `{{94022C55-8340-4119-84FD-40D321AD9EB8}` |
| `win32arm64AppId` | `{{4B40CB09-CA9D-4D1E-8D69-99740C497EAD}` |
| `win32x64UserAppId` | `{{F2B6BC26-EFC4-42EB-85A9-CB6D8122F127}` |
| `win32arm64UserAppId` | `{{EBAB242E-2896-4B64-B825-C985D9C9761B}` |

All four GUID bodies are valid uppercase GUIDs, pairwise distinct, different from the original Code-OSS AppIds, and preserve each original field's exact `{{` prefix and `}` suffix.

## Environment

- Windows 11 Home China, display version 25H2, build 26200, x64
- Node.js `v24.18.0` from the stable fnm installation, matching `.nvmrc`
- npm `11.16.0`
- Python `3.14.3`
- Visual Studio Community 2022 `17.14.27`
- MSVC v143 with Windows SDK `10.0.22621.0` and `10.0.26100.0`
- Electron development runtime version `1.129.1`, x64
- Recovery boot time: `2026-07-21T13:54:41.5000000+08:00`
- Commit limit/free space before the successful resumed Watch: `32.79 GB` / `16.14 GB`

## Commands

The principal commands were:

```powershell
git lfs fetch --all upstream 1.129.1
npm run electron
npm run watch
.\scripts\code.bat --user-data-dir "D:\develop_tool\writing-buddy-runtime\user-data" --extensions-dir "D:\develop_tool\writing-buddy-runtime\extensions" --shared-data-dir "D:\develop_tool\writing-buddy-runtime\shared-data" --remote-debugging-port 55612 --skip-welcome --skip-release-notes "D:\develop_tool\writing-buddy-test-workspace"
.\scripts\code-cli.bat --version
.\scripts\code.bat --user-data-dir "D:\develop_tool\writing-buddy-runtime\user-data" --extensions-dir "D:\develop_tool\writing-buddy-runtime\extensions" --shared-data-dir "D:\develop_tool\writing-buddy-runtime\shared-data" --remote-debugging-port 55613 --skip-welcome --skip-release-notes "D:\develop_tool\writing-buddy-test-workspace"
```

The complete Watch used the repository's full `npm run watch` task. No built-in extensions or compiler tasks were skipped, and no source or build-task changes were used to lower the acceptance standard.

## Runtime Isolation

The fixed isolated runtime root is `D:\develop_tool\writing-buddy-runtime`:

- User data: `D:\develop_tool\writing-buddy-runtime\user-data`
- Shared data: `D:\develop_tool\writing-buddy-runtime\shared-data`
- Extensions: `D:\develop_tool\writing-buddy-runtime\extensions`
- Logs: `D:\develop_tool\writing-buddy-runtime\logs`

`--shared-data-dir` is supported by the current source in `src/vs/platform/environment/node/argv.ts` and consumed by the environment service. Runtime evidence confirmed `D:\develop_tool\writing-buddy-runtime\shared-data\sharedStorage\state.vscdb` was created. Both launch command lines used the fixed isolated paths and did not use a Phase 0.1 Code-OSS profile.

The regenerated executable is `D:\develop_tool\writing-buddy\.build\electron\Writing Buddy.exe`. Its Windows ProductName and FileDescription are `Writing Buddy`; required runtime files including `d3dcompiler_47.dll`, `snapshot_blob.bin`, `ffmpeg.dll`, `version`, and `resources\default_app.asar` were present. The obsolete generated `Code - OSS.exe` launch target was absent.

## First Launch

- Launcher PID: `10824`
- Main PID: `33152`
- Remote debugging port: `55612`
- Window title after opening the test file: `中文输入测试.txt - writing-buddy-test-workspace - Writing Buddy Dev [Administrator]`
- Renderer process: present
- Extension host PID: `32408`
- UI result: the existing Chinese file opened and visibly displayed the required three paragraphs without editing or saving
- CLI result: exit code `0`, version `1.129.1`, commit `Unknown commit`, architecture `x64`
- Close result: Developer Tools and the first workbench were closed normally; PID `33152` and port `55612` exited while the Watch process remained alive

## Second Launch

- Launcher PID: `35360`
- Main PID: `4216`
- Remote debugging port: `55613`
- Restored title: `中文输入测试.txt - writing-buddy-test-workspace - Writing Buddy Dev [Administrator]`
- Restore result: the same test workspace, active Chinese-file editor, Explorer entry, and visible three-paragraph content restored automatically with the same isolated profile
- Runtime result: renderer and four Node utility processes were present, the extension-host log was created, Chrome DevTools Protocol returned page targets, and the complete Watch remained alive

## Chinese File SHA-256

- File: `D:\develop_tool\writing-buddy-test-workspace\中文输入测试.txt`
- Before: `8B8ADF29F89F4763B6451F5419C9B4E52273BE0AD2D835CE8136996B20B66AFA`
- After the second launch: `8B8ADF29F89F4763B6451F5419C9B4E52273BE0AD2D835CE8136996B20B66AFA`
- Result: exact ordinal equality; Phase 0.2 did not rewrite the test file

## Developer Tools

Developer Tools opened undocked on the first Writing Buddy instance. The Console showed one bounded built-in extension error:

```text
[vscode.mermaid-markdown-features] CANNOT use legacyToolReferenceFullNames without the chatParticipantPrivate API proposal enabled
```

The Console error count was `1` initially and remained `1` after 15 seconds. There was no increasing fatal, crash, or unresponsive loop. Other visible entries were initialization information and unauthenticated GitHub token messages. The workbench, file editor, CLI, renderer, extension host, and Watch all remained functional.

## Issues Encountered

| Issue | Root cause | Resolution | Final result |
| --- | --- | --- | --- |
| Initial local-origin push reported missing LFS objects | The shallow source checkout did not contain every LFS object reachable by the pushed history | Fetched all 98 reachable LFS objects from upstream `1.129.1` | Initial downstream branch push passed |
| Bare origin rejected shallow updates | The source repository is intentionally shallow and bare receive default rejected the boundary update | Set `receive.shallowUpdate=true` only in the validated local bare origin | Branch updates are accepted locally; upstream is unchanged |
| Three initial Watch attempts failed with `spawn UNKNOWN` or `write ENOMEM` | Windows commit memory was exhausted | Preserved all logs, made no source/build-scope workaround, increased pagefile capacity, and rebooted | Full Watch passed after restart with 16.14 GB free commit space at start |
| First resumed Watch still failed with `spawn UNKNOWN` after constrained `tsgo` resources | The machine still lacked adequate Windows commit space | Stopped retrying and waited for the external pagefile/reboot correction | No reduced compilation scope was accepted |
| Recovery preflight assertion rejected the known `product.json` status | The diagnostic string comparison omitted Git's leading status column space | Inspected the actual output, preserved the diagnostic log, and corrected only the evidence parser | Repository state was valid and unchanged |
| A process-discovery probe could match the nested Copilot executable | Both the main runtime and a nested process use the same executable filename | Required the no-`--type` main command line plus the phase-specific debug port | Correct main PIDs were recorded |
| A PowerShell regex probe treated `\u` unexpectedly | The test used an unnecessary regex escape | Replaced it with literal string containment | The underlying source evidence was unchanged |
| Initial CLI evidence parser assumed fixed output line positions | Built-in extension synchronization and debugger messages precede version output | Validated required version, commit, architecture, and exit-code lines by containment | CLI acceptance passed |
| npm printed unknown-project-config and deprecation warnings | Current npm reports repository compatibility settings that will change in a future major version | Recorded warnings; did not alter package configuration | Electron and Watch commands completed successfully |
| Windows Jump List reported access denied | System privacy settings disallow the Recent Folders custom category | Recorded as an environment warning | No workbench or persistence impact |

## Remaining Risks

- The development build reports `Unknown commit`, which is expected for this source runtime and was accepted by the contract.
- The bounded Mermaid proposal error remains part of the current upstream development configuration.
- Packaging, installer registration, code signing, icons, non-Windows branding, update services, Marketplace behavior, telemetry behavior, full test suites, and Phase 0.3 features were not tested or changed.
- The downstream origin is a local shallow bare repository intended for this Windows development baseline, not a hosted backup.

## Verification Evidence

Evidence is stored under `D:\develop_tool\writing-buddy-runtime\logs`:

- `preflight.txt`
- `product-before.json`
- `chinese-file-sha256-before.txt`
- `generated-appids.json`
- `product-validation.txt`
- `initial-origin-push.log`
- `initial-origin-push-retry.log`
- `lfs-fetch-dry-run.log`
- `lfs-fetch-upstream.log`
- `lfs-fetch-upstream-all.log`
- `electron.log`
- `watch-attempt-1.log`, `watch-attempt-2.log`, and `watch-attempt-3.log`
- `watch-pid-attempt-1.txt`, `watch-pid-attempt-2.txt`, and `watch-pid-attempt-3.txt`
- `watch-environment.txt`
- `watch-blocker-evidence.txt`
- `phase-0.2-resume-preflight.txt`
- `phase-0.2-watch-resume.log`
- `phase-0.2-watch-resume-pid.txt`
- `phase-0.2-watch-resume-failure.txt`
- `phase-0.2-resume-2-preflight.txt`
- `phase-0.2-watch-resume-2.log`
- `phase-0.2-watch-resume-2-pid.txt`
- `phase-0.2-watch-validation.txt`
- `shared-data-option-evidence.txt`
- `launch-first.log`
- `launch-first-pid.txt`
- `launch-first-processes.txt`
- `cli-version.txt`
- `first-launch-ui-devtools.txt`
- `launch-second.log`
- `launch-second-pid.txt`
- `second-launch-restore.txt`
- `chinese-file-sha256-after.txt`
- `runtime-acceptance.txt`
- `precommit-acceptance.txt` (created by the final acceptance gate)

The final Git evidence is the clean `writer/phase-0.2-minimal-branding` branch, the annotated `baseline-writing-buddy-0.2-windows` tag, and matching branch/tag references in `D:\develop_tool\writing-buddy-downstream.git`.
