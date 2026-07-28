# Story Kernel scene grounding acceptance — 2026-07-28

## Outcome

The scene-grounding repair is accepted at implementation commit `9c59601d`
(`fix: ground generated scenes to local manuscript`).

The supplied failure is repaired without weakening the Story Kernel write
boundary:

- scene `chapterId`, `manuscriptRange`, source revision, and
  `narrativeOrder` come from the exact local chapter or selection sent to the
  model;
- model-provided positional values are overwritten even when they are present;
- a mismatched evidence offset is repaired only when its quote occurs exactly
  once in the sent source;
- a scene with absent or unusable AI evidence receives a truthful local
  evidence reference to the authoritative source range;
- repeated quotes remain ambiguous and blocked for non-scene extraction;
- an existing overlapping scene or multiple new scenes for one source range
  remains blocked;
- author selection, safety snapshot, revision checks, strict schema
  validation, atomic commit, and explicit confirmation remain mandatory;
- a failed candidate never triggers an automatic paid repair request.

## Automated verification

All frontend commands ran with Node `24.14.0` and the repository pnpm
`10.32.1`.

| Gate | Result |
| --- | --- |
| Focused service and panel regression | 2 files / 13 tests passed |
| `pnpm acceptance` | ESLint, TypeScript, 97 files / 331 tests, and Vite production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 51 passed / 0 failed / 2 explicit external gates ignored |
| Isolated browser regression | Malformed scene became selectable; old four-field conflict was absent |
| Fresh one-job `pnpm tauri:build` | Portable EXE and NSIS installer built |
| Isolated native startup/normal close | Passed with exit code 0 |

The service regression covers omitted fields, model-invented positional
fields, unique-quote recovery, repeated-quote rejection, overlap rejection,
multiple-scene rejection, repository persistence, and confirmation. The panel
regression proves the repaired candidate can be selected and committed only
after a safety snapshot.

## Browser evidence

The browser fixture deliberately returned a `scene` without `chapterId`,
`manuscriptRange`, or `narrativeOrder`, plus evidence offsets outside the sent
source. It used a sanitized in-memory project and the local browser AI fixture;
no provider request or real manuscript was involved.

| Viewport and theme | Result |
| --- | --- |
| `1440 × 1000`, Paper | One candidate selectable; confirm action enabled; no document overflow |
| `390 × 844`, Midnight | Candidate readable; document and body scroll width exactly 390 |

The candidate checkbox was selected to verify the confirmation state, but the
final write button was not clicked. The local-grounding explanation was
visible, the reported evidence/schema conflict was absent, the smallest
candidate action measured 44 pixels, and the console reported zero errors.

Evidence:

- [Paper repaired candidate at 1440 × 1000](./screenshots/story-kernel-scene-grounding/01-paper-1440x1000.png)
- [Midnight repaired candidate at 390 × 844](./screenshots/story-kernel-scene-grounding/02-midnight-390x844.png)
- [Measured visual metrics](./story-kernel-scene-grounding-visual-metrics.json)

The in-app browser connector could not initialize in its protected runtime.
Local Playwright with installed Microsoft Edge supplied the equivalent
isolated DOM, interaction, screenshot, overflow, and console checks.

## Windows artifacts

The final portable build launched with an isolated
`WEBVIEW2_USER_DATA_FOLDER`. PID `52500` reached input idle, remained
responsive with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally within twenty seconds with code `0`; no forced termination was
required.

- Portable EXE:
  `tmp/story-kernel-scene-grounding-target/release/writing-buddy-next.exe`
  - 7,403,008 bytes
  - SHA-256:
    `760990A1B1864E8F24C373FA5CC0F61D23CF2499BEB8DAFBEC03EE6376F42E7C`
- NSIS installer:
  `tmp/story-kernel-scene-grounding-target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,209,171 bytes
  - SHA-256:
    `B5A98EAD219AF5EA7E9D785B8D8232A69A218424C1ED46288B9DD70ADDF6015C`

## Safety boundary

- Automated verification never read or exposed a DeepSeek API key.
- No real provider request or automatic retry was made.
- The browser fixture and native smoke used sanitized or isolated state.
- The legacy repository remained read-only.
- Real-account output quality remains a separate human/provider acceptance
  gate.
