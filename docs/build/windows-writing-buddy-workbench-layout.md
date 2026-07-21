# Writing Buddy Phase 0.3 Windows Workbench Layout Baseline

## Result

Phase 0.3 — Writer Workbench Layout Prototype: **PASS**.

- Baseline: annotated tag `baseline-writing-buddy-0.2-windows`, dereferenced commit `af858884cd982b88019c30fc76014c3ba0d921a5`.
- Branch: `writer/phase-0.3-writer-workbench-layout`.
- Implementation head before acceptance documentation: `8dab9726`.
- Product executable: `D:\develop_tool\writing-buddy\.build\electron\Writing Buddy.exe`.
- Repository topology: `origin` is `D:\develop_tool\writing-buddy-downstream.git`; `upstream` is `https://github.com/microsoft/vscode.git`.

The implementation is an in-tree, UI-kind built-in extension. The only core build-system change registers `extensions/writing-buddy`; no workbench core source was changed. The extension provides the novel tree, native Markdown editor defaults, static scene assistant, native status items, focus-mode command, sample bootstrap, live counts, and state restoration.

## Source and Scope

The Phase 0.3 range contains the frozen contract and plan, one extension registration change in `build/gulpfile.extensions.ts`, and the new `extensions/writing-buddy` source, tests, localization, and sample fixtures. Generated `out`, `.build`, runtime profiles, logs, and screenshots are not tracked.

Implementation commits before this report:

```text
52695c89 docs: freeze phase 0.3 writer workbench contract
8ef52b95 docs: plan phase 0.3 writer workbench implementation
11a18e97 feat: add Writing Buddy workbench extension skeleton
b3f9943e feat: establish writer-oriented startup layout
06bd1b57 feat: add novel structure and chapter switching
d7bdb9a3 feat: add static scene writing assistant
58461898 feat: add live chapter and novel word counts
42b14810 feat: restore writer workbench state and status
8dab9726 fix: resolve local sample storage URI
```

Explicit exclusions remained untouched: no LLM calls, semantic index, custom rich-text editor, cloud/account/payment work, publishing, icon replacement, updater/installer work, or Phase 0.4 feature implementation.

## Build and Automated Verification

All final expensive gates ran alone, with no Writing Buddy GUI process. The final complete Watch used the unchanged task graph at `BelowNormal` priority to reduce UI contention.

| Check | Result | Evidence |
| --- | --- | --- |
| Node | PASS | `v24.18.0`, matching `.nvmrc` |
| Focused compile | PASS | `compile-extension:writing-buddy`, 0 errors |
| Unit tests | PASS | 43 passing |
| Focused ESLint | PASS | exit 0 |
| Complete Watch | PASS | main/client, no-emit, transpile, Copilot, extension media, and every built-in extension completed; Writing Buddy reported 0 errors; process stayed alive after initial compilation |
| Official Electron regeneration | PASS | exit 0; executable size 232,757,248 bytes |

Final Watch log: `D:\develop_tool\writing-buddy-runtime\logs\phase-0.3-watch-final-low-priority.txt`.

Final Electron log: `D:\develop_tool\writing-buddy-runtime\logs\phase-0.3-electron-final-low-priority.txt`.

The Watch peak temporarily reduced free commit space to about 9.63 GB. After normal termination, all repository Watch children exited and committed memory returned to a stable 14.74–14.79 GB used of a 32.79 GB limit; available physical memory was about 24.5 GB. The only remaining Node process was the Codex tool server at about 0.04 GB working set. This was a bounded full-build peak and delayed Windows reclamation, not a retained Writing Buddy process or growing Node leak.

## Runtime Layout and Interaction

Both application launches used only these isolated paths:

```text
D:\develop_tool\writing-buddy-runtime\user-data
D:\develop_tool\writing-buddy-runtime\shared-data
D:\develop_tool\writing-buddy-runtime\extensions
D:\develop_tool\writing-buddy-runtime\logs
```

The launch path was `scripts\code.bat` with the exact `--user-data-dir`, `--shared-data-dir`, and `--extensions-dir` values above. The accepted second launch also used `--remote-debugging-port=55633`. Application processes were set to `BelowNormal` priority and were never run concurrently with the final Watch.

The first pre-fix activation exposed a real desktop URI mismatch: extension global storage arrived as `vscode-userdata:` although its desktop provider maps to the local file system. The failure was preserved in the earlier runtime log. A focused regression test was added first, then `vscode-userdata:` was mapped to the equivalent `file:` URI before create-only fixture publication. The next launch activated the extension successfully without overwriting existing files.

The previously failed activation had already recorded the one-time sample-open state, so the first successful post-fix run used the visible `Writing Buddy: Open Sample Novel` command once. Subsequent launches restored the workspace automatically.

Runtime checks passed:

- Wide capture at 2560×1392 and substantially narrower capture at 1457×904 both kept the novel tree, native editor, and assistant usable without severe overlap.
- The left side showed `My Novel`, `Volume 01`, three chapters, Characters, Worldbuilding, Timeline, and Notes; the user did not need file-system paths to switch chapters.
- Chapter 001, 002, and 003 each opened in the native Markdown editor without duplicate-tab growth.
- Assistant metadata followed the active chapter: Chapter 002 showed Platform Three / 23:52 / Xu Qing; Chapter 003 showed Signal Tower / 00:06 / Lin Mo.
- Markdown line numbers, folding gutter, glyph margin, and minimap were hidden. Wrapping, 30-pixel line height, and vertical padding remained active while native editing, selection, copy/paste, find/replace, undo, redo, and save remained available.
- Initial counts were Chapter 170 / Novel 532 for Chapter 001, Chapter 171 / Novel 532 for Chapter 002, and Chapter 191 / Novel 532 for Chapter 003.
- Appending the acceptance sentence changed the live Chapter 001 count to 185 and Novel count to 547, with `Unsaved`; undo returned 170/532 and `Saved`; redo returned 185/547 and `Unsaved`; save returned `Saved`.
- The focus status command entered native Zen Mode. The default `Ctrl+K`, `Z` chord restored the full three-column layout, counts, and saved state.

The frozen word-count rule is implemented exactly: each CJK character counts as one; a contiguous ASCII letter/digit sequence counts as one; whitespace, punctuation, and Markdown markers count as zero. The active TextDocument overrides its disk snapshot; the novel total otherwise uses exactly the three catalog chapters. Revision guards prevent stale asynchronous refreshes from publishing.

Whole-branch review found that the initial snapshot adapter decoded raw bytes as UTF-8. This would bypass Code-OSS encoding semantics. A failing adapter test was added first, then snapshot reads were changed to `workspace.openTextDocument(...).getText()`. The final focused suite contains 43 passing tests.

## Persistence, Hot Exit, and Hash Safety

The intentional Chapter 001 delta was entered through the native editor and saved as UTF-8:

```text
【Phase 0.3 验收】夜雨之后，故事仍在继续。
```

PowerShell console rendering was not used as a correctness oracle because its default decoding displayed mojibake. A Node UTF-8 read verified the exact sentinel and tail text.

| File | Initial SHA-256 | Final SHA-256 | Result |
| --- | --- | --- | --- |
| Chapter 001.md | `6FFF56968EFE47BB0D6B69644363DCFFB3850D112D5EE5CB0530780274BFF5BD` | `0999A4553924B77BDBABA1776E5B469D8831AE9D7FFB96C022DD654152466D2D` | Expected intentional edit only |
| Chapter 002.md | `158A0A5B6DD66FF9DBE300E94CE81289443FAB007D48ECCF9AE1B9F8738B5228` | same | Untouched control |
| Chapter 003.md | `80AFD388F62F7A312D2120A905B0B6ABA5E190B2FD0D21AF69A05D880E4A2C68` | same | Untouched control |

For Hot Exit, an unsaved Chinese sentence was added to Chapter 003. The window closed normally without changing the Chapter 003 disk hash. The second launch with the same isolated directories restored the sample workspace, Chapter 003 as active, the cursor/view state, the three-column layout, assistant metadata, the unsaved sentence, Chapter 208 / Novel 564, and `Unsaved`. The sentence was then removed and saved; Chapter 003 returned to 191, Novel remained 547 because of the saved Chapter 001 delta, and the original Chapter 003 hash remained unchanged.

Undo/redo was verified inside the editing session. The cross-restart Hot Exit buffer restored correctly; restoring an undo stack across process restart is not a Phase 0.3 requirement.

## CLI, Logs, and Isolation

The branded CLI used the same isolated user-data, shared-data, and extension directories. It exited 0 and reported:

```text
1.129.1
Unknown commit
x64
```

`Unknown commit` remains the accepted development-build baseline and is not introduced by this phase. The shared-data database exists under the isolated runtime root, and no normal VS Code profile was used for the sample or acceptance state.

The accepted second extension-host log contains the Writing Buddy activation and zero Writing Buddy activation failures. Renderer/extension-host inspection through the debug endpoint and persisted logs found no new blocking Writing Buddy error. The known Mermaid proposal/tool registration errors remained bounded at one occurrence per launch. A single renderer lock-registration error appeared during normal shutdown and did not affect persistence or restart.

The workspace trust banner is expected because the locally generated sample folder is initially untrusted; the extension explicitly supports untrusted workspaces. Yellow accessibility outlines visible during automation came from the screen-reader optimized automation mode, not the product theme.

## Git Baseline Gate

The branch is eligible for the annotated `baseline-writing-buddy-0.3-windows` tag only after the documentation commit, whole-branch review, fresh focused verification, clean worktree check, local bare-origin branch push, tag creation, tag push, and exact bare-ref comparison all pass. The tag must dereference to the same commit as the pushed branch. Runtime logs and temporary execution ledgers are excluded from Git.
