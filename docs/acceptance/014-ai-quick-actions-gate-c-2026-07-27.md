# AI Quick Actions Gate C acceptance

Date: 2026-07-27

Branch: `codex/ai-quick-actions-gate-c`

## Outcome

The selected-text toolbar is now a real author-controlled entry point instead
of a collection of visual placeholders.

- **AI 润色** opens the writing assistant on the grounded `polish` workflow.
- The assistant exposes **润色、精简、扩写、语病、对话、节奏** as explicit
  actions over the current selection.
- **创建人物、地点、物品、信息揭示、伏笔** open Story Kernel generation with
  the current selection, an author-visible instruction, and one preset resource
  type.
- Clicking an action does not automatically start a paid request.
- Rewrite output remains a Diff candidate with full accept, edited accept,
  reject, stale protection, cancellation, and Undo.
- Story resources remain pending candidates until a safety snapshot and atomic
  author confirmation succeed.

## Architecture and safety

Gate C reuses the accepted boundaries:

- `ChapterEditor` owns the Monaco selection.
- A transient assistant intent routes UI actions without creating a second AI
  runtime.
- `DeterministicContextPackBuilder` remains the source of visible grounded
  context.
- The fixed `selection-rewrite` request now also accepts `expand` in TypeScript
  and Rust.
- `StoryKernelGeneratorPanel` consumes selection presets but never begins
  generation during preset application.
- Existing `EditTransactionService`, Story Kernel transactions, safety
  snapshots, revision checks, and author-secret exclusion remain authoritative.

No project path, credential, API key, or author-secret content was added to an
AI request contract. A secret-shaped DeepSeek key scan returned no matches.

## UI and accessibility

The toolbar and assistant preserve the warm-paper visual language while
improving hierarchy and control clarity:

- the toolbar is a 72px floating surface with a distinct gold AI action;
- every actionable toolbar, rewrite, and resource-type target is at least 44px;
- active rewrite actions have a visible selected state;
- selection, Context Pack, candidate, safety, and confirmation regions use
  clearer card boundaries and spacing;
- generation can be cancelled from both rewrite and Story Kernel workflows;
- keyboard focus uses the existing visible global focus ring;
- no page-level horizontal or vertical overflow was introduced.

Visual evidence:

- [Selection toolbar at 1536](./screenshots/gate-ai-actions-c/01-selection-toolbar-1536x992.png)
- [AI polish workflow at 1536](./screenshots/gate-ai-actions-c/02-ai-polish-1536x992.png)
- [Create-character workflow at 1536](./screenshots/gate-ai-actions-c/03-create-character-1536x992.png)
- [AI polish workflow at 1280](./screenshots/gate-ai-actions-c/04-ai-polish-1280x800.png)
- [Create-character workflow at 1024](./screenshots/gate-ai-actions-c/05-create-character-1024x720.png)
- [Machine-readable visual metrics](./gate-ai-actions-c-visual-metrics.json)

| Viewport / workflow | Page overflow X/Y | Clipped controls | Controls below 44px |
| --- | ---: | ---: | ---: |
| 1536×960 toolbar | 0 / 0 | 0 | 0 |
| 1536×960 AI polish | 0 / 0 | 0 | 0 |
| 1536×960 create character | 0 / 0 | 0 | 0 |
| 1280×768 AI polish | 0 / 0 | 0 | 0 |
| 1024×688 create character | 0 / 0 | 0 | 0 |

Native 18px checkboxes are wrapped by 44px labels and are measured by their
effective label target.

## Automated verification

| Command | Result |
| --- | --- |
| Targeted selection/rewrite/preset tests | 5 files / 13 tests passed |
| `pnpm acceptance` | ESLint, TypeScript, 62 files / 181 tests, Vite passed |
| `cargo fmt --check` | passed |
| `cargo test` | 35 passed / 0 failed / 2 release gates ignored |
| `git diff --check` | passed |
| Secret-shaped DeepSeek key scan | no matches |
| `pnpm tauri:build` | release EXE and NSIS installer built |

The current shell uses Node `25.2.1` while the repository requests Node 24.
pnpm emitted an engine warning; lint, typecheck, tests, Vite, Rust, packaging,
and smoke verification still passed.

## Desktop smoke and artifacts

The isolated production executable launched as PID `44584`, remained alive and
responsive for five seconds with title `Writing Buddy`, accepted
`CloseMainWindow`, and exited normally.

- Portable EXE:
  `tmp/ai-quick-actions-gate-c-target-final/release/writing-buddy-next.exe`
  - 7,001,600 bytes
  - SHA-256:
    `AFA348D762F13ADB5D212810616D635FB42A54B6FFA017574CEBA6C24C4D635E`
- NSIS installer:
  `tmp/ai-quick-actions-gate-c-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,048,115 bytes
  - SHA-256:
    `FD91DF6D0BC23724CA31C3BB82D89DC27846CFE6702E7BF6A05159EBEDE99322`

## Known manual gates

- A real DeepSeek key was not used. Provider model discovery, balance,
  real-account streaming quality, billed cancellation, and generation quality
  remain author-account checks.
- Human approval remains required for generated text and Story resources.

## Completion decision

Gate C meets the handoff definition for editor quick actions: the highlighted
toolbar entries now route to complete grounded workflows, responsive and
accessible visual evidence is recorded, regression suites pass, and fresh
Windows artifacts were built and smoke-tested.
