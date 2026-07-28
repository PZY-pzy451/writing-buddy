# AI Quick Actions Gate D acceptance

Date: 2026-07-27

Branch: `codex/ai-quick-actions-gate-d`

## Outcome

The original Gate D character and relationship AI workflows are complete.

- Character Center now exposes a dedicated **AI 人物助手** entry from both the
  header and empty state.
- Character generation returns exactly three reviewable candidates. Backstory,
  arc, and voice actions return one candidate.
- Grounded extraction can propose character facts and dynamic state from one
  explicitly selected chapter with exact evidence.
- Same-name matches require an explicit merge choice; conflicts are deselected
  by default and no candidate writes automatically.
- Relationship Graph now exposes **生成双向关系** and **从正文分析变化**.
- Directed relationship candidates remain independent, including opposite
  directions between the same two characters.
- Pending relationships appear as offset dashed edges until the author accepts
  one edge.

## Architecture and safety

- TypeScript and Rust both recognize fixed `character-analysis` and
  `relationship-analysis` purposes.
- Strict response schemas reject unknown fields, invalid action shapes,
  missing extraction evidence, and unknown character IDs.
- Requests contain a P0 author instruction and a bounded, author-selected P1
  chapter; paths, credentials, and author secrets remain forbidden.
- Character apply rechecks the source hash and resource revision, creates a
  safety snapshot, and persists only selected fields.
- Dynamic inventory and knowledge are stored as confirmed Character
  `StateRecord` values.
- Relationship apply rechecks source and revision, snapshots first, then uses
  create-safe or expected-revision repository commits.
- The browser fixture uses the non-secret `browser-fixture` marker. No real
  DeepSeek key or real user project was used.

## UI and accessibility

The warm-paper review drawers use Lucide icons, clear selected/loading/error/
success states, visible keyboard focus, and interaction targets of at least
44px.

- Character candidates group profile, state, conflict, and evidence controls.
- Relationship candidates show direction, confidence, strength, summary,
  conflicts, and one-edge acceptance.
- At 1024px the review drawer stays above the underlying inspector and remains
  independently scrollable.
- Reduced-motion users do not receive pending-edge animation.

Visual evidence:

- [Three character candidates at 1536](./screenshots/gate-ai-actions-d/01-character-three-candidates-1536x960.png)
- [Directed relationship candidates at 1536](./screenshots/gate-ai-actions-d/02-relationship-virtual-edges-1536x960.png)
- [Grounded character extraction at 1280](./screenshots/gate-ai-actions-d/03-character-extraction-1280x768.png)
- [Relationship review at 1024](./screenshots/gate-ai-actions-d/04-relationship-virtual-edges-1024x688.png)
- [Machine-readable visual metrics](./gate-ai-actions-d-visual-metrics.json)

| Viewport / workflow | Page overflow X/Y | Clipped controls | Controls below 44px |
| --- | ---: | ---: | ---: |
| 1536×960 character generation | 0 / 0 | 0 | 0 |
| 1536×960 relationship generation | 0 / 0 | 0 | 0 |
| 1280×768 character extraction | 0 / 0 | 0 | 0 |
| 1024×688 relationship generation | 0 / 0 | 0 | 0 |

## Automated verification

| Command | Result |
| --- | --- |
| Character and relationship service/UI target tests | passed |
| `pnpm acceptance` | ESLint, TypeScript, 66 files / 199 tests, Vite passed |
| `cargo fmt --check` | passed |
| `cargo test` | 39 passed / 0 failed / 2 release gates ignored |
| `git diff --check` | passed |
| Secret-shaped key scan across 27 changed text files | no matches |
| `pnpm tauri:build` with one Cargo job | release EXE and NSIS installer built |

The shell uses Node `25.2.1` while the repository requests Node 24. pnpm
emitted an engine warning; lint, typecheck, tests, Vite, Rust, packaging, and
desktop smoke still passed.

## Desktop smoke and artifacts

The production executable launched as PID `8276`, remained alive and
responsive for five seconds with title `Writing Buddy`, accepted
`CloseMainWindow`, and exited normally.

- Portable EXE:
  `tmp/ai-quick-actions-gate-c-target-final/release/writing-buddy-next.exe`
  - 7,061,504 bytes
  - SHA-256:
    `9EC73CCDB456251409E5F8A82F05CA5F4D17BB7C4C7D0879B88BA6BAA1B353D7`
- NSIS installer:
  `tmp/ai-quick-actions-gate-c-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,076,701 bytes
  - SHA-256:
    `F0BA5C99459B5AB39BE4998E74BCBC6057D14323252B0E053C5D8EA22D155673`

## Known manual gates

- A real DeepSeek key was not used. Provider quality, billed cancellation, and
  account-specific generation remain author-account checks.
- Generated character facts and directed relationships still require human
  approval by design.

## Completion decision

Gate D meets the original character and relationship definition: candidates
are grounded when derived from manuscript text, conflicts and same-name merges
are explicit, directed edges remain independent, writes are revision-safe and
snapshot-backed, and the responsive review UI has fresh automated, visual,
native, and smoke evidence.
