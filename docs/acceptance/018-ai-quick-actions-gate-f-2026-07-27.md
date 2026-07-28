# AI Quick Actions Gate F acceptance

Date: 2026-07-27

Branch: `codex/ai-quick-actions-gate-f`

## Outcome

The original Gate F Tasks 18–21 are complete.

- Timeline exposes **AI 从正文提取** for current chapter, current volume,
  selected chapters, or chapters without analyzed events.
- Authors can extract events, generate goal-based events, compare exactly
  three next directions, and review typed causal links independently.
- Plot Board exposes **AI 剧情线与伏笔** for plot generation, consequences,
  progress extraction, foreshadowing, payoff, and grounded extraction.
- No candidate writes before explicit author selection and confirmation.

## Architecture and safety

- TypeScript and Rust both recognize fixed `timeline-analysis` and
  `plot-analysis` purposes.
- Strict schemas reject unknown fields, unbounded sources, unknown entity
  identities, malformed causal endpoints, missing extraction evidence, and
  invalid action counts.
- Requests contain a P0 author instruction and one to twelve explicitly
  selected, bounded P1 chapter sources. Project paths, credentials, keys, logs,
  and unselected manuscript content remain forbidden.
- Existing foreshadowing `trueMeaning` is excluded by default. The UI opt-in is
  off by default, and Rust rejects secret-bearing input unless it is enabled.
- Candidate staging deduplicates normalized titles and aliases, makes
  same-name merges explicit, and separates AI rationale from deterministic
  timeline/plot lifecycle checks.
- Apply rechecks source hashes and matched resource revisions, creates one
  safety snapshot, and commits the selected batch atomically.
- Accepted causal edges persist predecessor/consequence links
  bidirectionally; rejected dashed edges never alter the Story Kernel.

## UI and accessibility

The UI/UX review guidance shaped both warm-paper drawers: Lucide icons, clear
hierarchy, visible keyboard focus, explicit loading/cancel/error/conflict/
success states, independently scrollable review content, reduced-motion
handling, and effective targets of at least 44px.

- Timeline candidates show result, impact, evidence, merge conflicts, local
  checks, and dashed causal edges as separately selectable units.
- The event inspector now shows predecessors, direct results, later impacts,
  plot/foreshadowing links, evidence, and deterministic checks.
- Plot and foreshadowing cards distinguish AI suggestions from local lifecycle
  warnings and never rely on color alone.
- At 1024px the review drawer remains readable and scrollable above the
  underlying Story workspace.

Visual evidence:

- [Grounded timeline extraction at 1536](./screenshots/gate-ai-actions-f/01-timeline-extraction-1536x960.png)
- [Exactly three timeline directions at 1280](./screenshots/gate-ai-actions-f/02-timeline-three-directions-1280x768.png)
- [Plot-thread generation and default-off secret control at 1536](./screenshots/gate-ai-actions-f/03-plot-thread-1536x960.png)
- [Grounded foreshadowing extraction at 1024](./screenshots/gate-ai-actions-f/04-foreshadowing-extraction-1024x688.png)
- [Machine-readable visual metrics](./gate-ai-actions-f-visual-metrics.json)

| Viewport / workflow | Page overflow X/Y | Clipped controls | Controls below 44px |
| --- | ---: | ---: | ---: |
| 1536×960 timeline extraction | 0 / 0 | 0 | 0 |
| 1280×768 three directions | 0 / 0 | 0 | 0 |
| 1536×960 plot generation | 0 / 0 | 0 | 0 |
| 1024×688 foreshadowing extraction | 0 / 0 | 0 | 0 |

## Automated verification

| Command | Result |
| --- | --- |
| Timeline/plot contract, service, rule, and page target tests | passed |
| `pnpm acceptance` | ESLint, TypeScript, 71 files / 222 tests, Vite passed |
| `cargo fmt --check` | passed |
| `cargo test` | 43 passed / 0 failed / 2 release gates ignored |
| `git diff --check` | passed |
| Secret-shaped key scan across 36 changed text files | no matches |
| `pnpm tauri:build` with one Cargo job | release EXE and NSIS installer built |

The shell uses Node `25.2.1` while the repository requests Node 24. pnpm
emitted an engine warning; lint, typecheck, tests, Vite, Rust, packaging, and
desktop smoke still passed.

## Desktop smoke and artifacts

The production executable launched as PID `15504`, remained responsive for
five seconds with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally.

- Portable EXE:
  `tmp/ai-quick-actions-gate-c-target-final/release/writing-buddy-next.exe`
  - 7,190,016 bytes
  - SHA-256:
    `277A054DA8D0AF2E6364FA8B58259621012C49331904C1C996AB54B8DB8B1108`
- NSIS installer:
  `tmp/ai-quick-actions-gate-c-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,114,963 bytes
  - SHA-256:
    `6A984E9CF84CB35E476FCE64D3F55B0736CDC48028C22B3C6D964B8D179F8061`

## Known manual gates

- A real DeepSeek key was not used. Provider quality, billing behavior, and
  account-specific generation remain author-account checks.
- Generated story progress, causality, plot, and foreshadowing candidates still
  require human approval by design.

## Completion decision

Gate F meets the original story-progress, causality, plot-thread, and
foreshadowing definition: candidates are typed and grounded when extracted,
AI suggestions remain distinct from deterministic rules, secrets are
default-private, writes are selected-only/revision-safe/snapshot-backed, and
the responsive review UI has fresh automated, visual, native, and smoke
evidence.
