# AI Quick Actions Gate C2 acceptance

Date: 2026-07-27

Branch: `codex/ai-quick-actions-gate-c2`

## Outcome

The remaining original Gate C workflows are complete.

- The chapter header exposes **AI 续写** with **继续本段、完成场景、三种走向**.
- Continuation uses a bounded, author-visible Context Pack and captures the
  cursor offset, manuscript revision, and local text anchor.
- DeepSeek output remains a candidate. Nothing is inserted until the author
  chooses one direction.
- Accepted continuation supports Undo; cancelled, rejected, or stale
  candidates cannot modify the manuscript.
- The writing assistant now has a **细纲** tab with **生成目标、生成细纲、提取细纲、
  情绪节拍**.
- Scene-plan output is selectable field by field. Apply creates a safety
  snapshot, rechecks manuscript and StoryScene revisions, and saves only the
  selected fields.
- `emotionBeats` is an optional backward-compatible StoryScene field.

## Architecture and safety

Gate C2 extends the existing runtime instead of creating another provider or
write path.

- TypeScript and Rust both recognize the fixed `manuscript-continuation` and
  `scene-plan-generation` purposes.
- Both request boundaries require a P0 author instruction and a bounded P1
  manuscript source; paths, keys, credentials, and absolute paths are rejected.
- Continuation reuses `EditTransactionService`.
- Scene planning reuses `DesktopStoryRepository`, expected revisions, and
  `desktopBridge.createSnapshot`.
- Existing author-secret exclusion and explicit Context Pack consent remain
  authoritative.
- The browser acceptance fixture uses a non-secret `browser-fixture` marker;
  no real DeepSeek key was requested or stored.

## UI and accessibility

The warm-paper editor now has a compact header menu, a rewrite/continuation
mode switch, and a fifth assistant tab for scene planning.

- all new interactive targets are at least 44px;
- selected, loading, disabled, cancelled, stale, rejected, accepted, error,
  success, and Undo states are visible;
- candidate prose uses the manuscript serif stack while metadata remains
  compact and scannable;
- 1536, 1280, and 1024 layouts have zero page overflow and zero unscrollable
  clipped controls.

Visual evidence:

- [Continuation entry at 1536](./screenshots/gate-ai-actions-c2/01-continuation-entry-1536x992.png)
- [Three continuation directions at 1536](./screenshots/gate-ai-actions-c2/02-three-directions-1536x992.png)
- [Scene-plan field selection at 1536](./screenshots/gate-ai-actions-c2/03-scene-plan-fields-1536x992.png)
- [Continuation candidate at 1280](./screenshots/gate-ai-actions-c2/04-continuation-candidate-1280x800.png)
- [Scene-plan field selection at 1024](./screenshots/gate-ai-actions-c2/05-scene-plan-fields-1024x720.png)
- [Machine-readable visual metrics](./gate-ai-actions-c2-visual-metrics.json)

| Viewport / workflow | Page overflow X/Y | Clipped controls | Controls below 44px |
| --- | ---: | ---: | ---: |
| 1536×960 continuation entry | 0 / 0 | 0 | 0 |
| 1536×960 three directions | 0 / 0 | 0 | 0 |
| 1536×960 scene-plan fields | 0 / 0 | 0 | 0 |
| 1280×768 continuation candidate | 0 / 0 | 0 | 0 |
| 1024×688 scene-plan fields | 0 / 0 | 0 | 0 |

## Automated verification

| Command | Result |
| --- | --- |
| Targeted AI/context/continuation/scene-plan tests | 5 files / 23 tests passed |
| `pnpm acceptance` | ESLint, TypeScript, 64 files / 188 tests, Vite passed |
| `cargo fmt --check` | passed |
| `cargo test` | 37 passed / 0 failed / 2 release gates ignored |
| `git diff --check` | passed |
| Secret-shaped DeepSeek key scan | no matches |
| `pnpm tauri:build` with one Cargo job | release EXE and NSIS installer built |

The shell uses Node `25.2.1` while the repository requests Node 24. pnpm
emitted an engine warning; lint, typecheck, tests, Vite, Rust, packaging, and
desktop smoke still passed.

## Desktop smoke and artifacts

The production executable launched as PID `48200`, remained alive and
responsive for five seconds with title `Writing Buddy`, accepted
`CloseMainWindow`, and exited normally.

- Portable EXE:
  `tmp/ai-quick-actions-gate-c-target-final/release/writing-buddy-next.exe`
  - 7,012,352 bytes
  - SHA-256:
    `359C58D1907A77E164A70759E6AB35329A798E34D265F0EC7CC2405D0BE14BB2`
- NSIS installer:
  `tmp/ai-quick-actions-gate-c-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,057,428 bytes
  - SHA-256:
    `FA0EF48B27DA14D327B421BC304F9A1CE4B796302D4AEE13C1975710E0D48032`

The first cold release attempt exhausted memory during parallel dependency
compilation. The successful build used `CARGO_BUILD_JOBS=1` and the accepted
incremental dependency cache; the failure and prevention rule are recorded in
`docs/postmortem/004-cargo-release-memory-pressure.md`.

## Known manual gates

- A real DeepSeek key was not used. Provider quality, billed cancellation, and
  account-specific generation remain author-account checks.
- Generated prose and scene-plan fields still require human approval.

## Completion decision

Gate C2 meets the original continuation and scene-planning definition: both
workflows are grounded, author-controlled, revision-safe, cancellable,
responsive, and backed by fresh automated, visual, native, and smoke evidence.
