# 013 — AI Quick Actions Gate A/B acceptance, 2026-07-27

## Status

`PASSED — READY FOR HUMAN APPROVAL`

This execution is intentionally limited to Gate A and Gate B from
`Writing_Buddy_StoryForge_AI_Quick_Actions_Handoff_v1.0`. It stops before
selection writing, character, relationship, world, timeline, item, plot, or
foreshadowing actions.

## Baseline and commits

- Baseline: `3af0462` — `feat: add AI Story Kernel generation`
- Gate A: `3305500` — `feat: add reusable ai action foundation`
- Gate B: `962b713` — `feat: add unified ai generation drawer`
- Branch: `codex/ai-quick-actions-gate-ab`

## Reused runtime

No second AI runtime was introduced. The implementation reuses:

- `@writing-buddy/ai` provider, job, prompt, event, usage, and error contracts;
- the existing Rust DeepSeek provider, SSE parser, retry/cancellation policy,
  single-active-job registry, Credential Manager storage, and usage metadata;
- the existing Story Kernel Context Pack token estimator and adapter surface;
- the existing DesktopBridge generation/cancellation boundary;
- existing Version snapshots and repository/transaction ports for later
  concrete action adapters.

## New shared modules

- `AiActionDefinition` and `AiActionRegistry`
- versioned `PromptRegistry`
- strict JSON/fenced-JSON `validateAiOutput`
- privacy-aware `AiContextPack` and `buildAiContextPack`
- Story Kernel Context Pack adapter
- `AiPreviewTransaction` and `AiApplyService`
- global Zustand generation state machine
- reusable `ContextPreview`
- unified `AiGenerationDrawer`

The public action ID union contains the complete handoff taxonomy. Only
`review.consistency` is registered in this Gate as the real integration action.
All editor and Story module actions remain unregistered until their approved
later Gate.

## Prompt and Schema versions

The active integration uses:

- action: `review.consistency`
- prompt: `review.consistency` version 1
- output: `ChapterReviewResponse` version 1
- model class: `reasoning`
- existing Rust job type: `chapter-review`

Job metadata contains action ID, prompt version, Schema version, output Schema
name, and model ID. It does not contain the prompt body, manuscript, output, API
key, or project path.

## Context and privacy behavior

- Required and optional records are derived from an action policy.
- Required records cannot be unchecked.
- Optional author-secret records are excluded by default and require explicit
  consent.
- Token trimming is deterministic and fails when required context alone
  exceeds the budget.
- Missing modules produce explicit exclusions instead of invented data.
- Windows paths and secret-shaped keys are redacted before serialization.
- Serialized context rejects project-root, credential, API-key, and
  absolute-path fields.

The first real adapter preserves the fixed Rust `chapter-review` contract. Its
Context Preview therefore shows exactly one required current-chapter record,
matching the JSON request body byte-for-byte. Project and scene summaries are
not claimed as sent when the fixed contract does not send them.

## Preview transaction behavior

AI output remains in a preview transaction. Automated tests cover:

- strict revision equality before apply;
- transition to `stale` after the source revision changes;
- all/partial selection metadata;
- rejection without a write;
- mandatory safety snapshot before the write;
- successful completion after the write;
- snapshot restoration after an apply failure.

The unified drawer does not create a second repository or write directly to
the manuscript or Story Kernel.

## UI and accessibility

The global header exposes **AI 快速生成**. The drawer is mounted once at the app
shell so route changes do not discard a preview. It supports keyboard focus
containment/restoration, Escape close, visible focus, disabled async controls,
44px interaction targets, scrolling, cancellation, error/repair feedback,
raw-output inspection, and reduced motion.

Visual evidence:

- [1536 drawer](./screenshots/gate-ai-actions/01-unified-ai-drawer-1536x992.png)
- [1280 overlay drawer](./screenshots/gate-ai-actions/02-unified-ai-drawer-1280x800.png)
- [1024 full-height context preview](./screenshots/gate-ai-actions/03-context-preview-1024x720.png)
- [Machine-readable visual metrics](./gate-ai-actions-visual-metrics.json)

| Viewport | Drawer | Page overflow X/Y | Clipped controls | Controls below 44px |
| --- | --- | ---: | ---: | ---: |
| 1536×960 | 380×852 | 0 / 0 | 0 | 0 |
| 1280×768 | 380×660 overlay | 0 / 0 | 0 | 0 |
| 1024×688 | 520×580 full-height overlay | 0 / 0 | 0 | 0 |

## Automated verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | passed |
| Targeted AI Actions/Context/Drawer tests | 8 files / 23 tests passed |
| `pnpm acceptance` | ESLint, TypeScript, 60 files / 176 tests, Vite passed |
| `cargo fmt --check` | passed |
| `cargo test` | 35 passed / 0 failed / 2 release gates ignored |
| `git diff --check` | passed |
| Secret-shaped DeepSeek key scan | no matches |
| `pnpm tauri:build` | release EXE and NSIS installer built |

The current shell is Node `25.2.1`; the repository requests Node 24, so pnpm
emitted an engine warning. TypeScript, tests, Vite, Rust, and packaging still
passed.

## Desktop smoke and artifacts

The final isolated release was launched for five seconds. PID `50596` remained
alive and responsive with title `Writing Buddy`, accepted `CloseMainWindow`,
and exited normally.

- Portable EXE:
  `tmp/ai-quick-actions-target-final/release/writing-buddy-next.exe`
  - 6,997,504 bytes
  - SHA-256:
    `B394954047D93C59810E69D7CD14F9BAA982E0A9D4A4481607E02D7E2F4B67EE`
- NSIS installer:
  `tmp/ai-quick-actions-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,047,105 bytes
  - SHA-256:
    `D113B25481544DF747AC381C399C8A594628CAFBBA8C07729B7A45768594CBC2`

## Known manual gates

- A real DeepSeek API key was not used; provider `/models`, balance, streaming
  quality, and billed cancellation remain user-account checks.
- The drawer currently proves the shared runtime with consistency review.
  Concrete writing and Story resource actions are intentionally outside this
  Gate.
- Human approval is required before Gate C.

## Completion decision

Gate A and Gate B meet the handoff completion definition: Source Map, current
capability matrix, shared contracts, visible Context Pack, unified Drawer,
streaming state machine, strict output validation, guarded transactions,
responsive evidence, full regression tests, fresh desktop artifacts, and
separate Git commits are present. Stop here for human approval.
