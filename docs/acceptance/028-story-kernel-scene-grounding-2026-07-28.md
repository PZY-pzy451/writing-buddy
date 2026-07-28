# Story Kernel scene grounding acceptance — 2026-07-28

## Outcome

The Story Kernel response repair is accepted at implementation commits
`9c59601d` (`fix: ground generated scenes to local manuscript`) and
`73f633f7` (`fix: normalize optional null Story Kernel fields`).

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
- when a model returns JSON null for an optional field such as
  `location.mapPoint`, only paths identified by the strict Schema as type
  errors are tried as omitted;
- the retry is accepted only if the same strict Schema fully passes; required
  nulls, unknown null fields, null array entries, and malformed non-null values
  remain blocked;
- author selection, safety snapshot, revision checks, strict schema
  validation, atomic commit, and explicit confirmation remain mandatory;
- a failed candidate never triggers an automatic paid repair request.

## Automated verification

All frontend commands ran with Node `24.14.0` and the repository pnpm
`10.32.1`.

| Gate | Result |
| --- | --- |
| Focused service and panel regression | 2 files / 17 tests passed |
| `pnpm acceptance` | ESLint, TypeScript, 97 files / 335 tests, and Vite production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 51 passed / 0 failed / 2 explicit external gates ignored |
| Isolated browser regression | Malformed scene and optional-null location became selectable; reported conflicts were absent |
| Final one-job `pnpm tauri:build` | Portable EXE and NSIS installer built |
| Isolated native startup/normal close | Passed with exit code 0 |

The service regression covers omitted fields, model-invented positional
fields, unique-quote recovery, repeated-quote rejection, overlap rejection,
multiple-scene rejection, repository persistence, and confirmation. The panel
regressions prove the repaired scene and location candidates can be selected
and committed only after a safety snapshot. Negative cases cover required
nulls, unknown null properties, and null array entries.

## Browser evidence

The browser fixtures deliberately returned:

- a `scene` without `chapterId`, `manuscriptRange`, or `narrativeOrder`, plus
  evidence offsets outside the sent source;
- a `location` with `mapPoint: null`, matching the second supplied screenshot.

They used a sanitized in-memory project and the local browser AI fixture; no
provider request or real manuscript was involved.

| Viewport and theme | Result |
| --- | --- |
| `1440 × 1000`, Paper | One candidate selectable; confirm action enabled; no document overflow |
| `390 × 844`, Midnight | Candidate readable; document and body scroll width exactly 390 |
| `1440 × 1000`, Paper, optional null | Location selectable; no mapPoint or generic Schema conflict |
| `390 × 844`, Midnight, optional null | Location readable; document and body scroll width exactly 390 |

The candidate checkbox was selected to verify the confirmation state, but the
final write button was not clicked. The local-grounding explanation was
visible, the reported evidence/schema conflict was absent, the smallest
candidate action measured 44 pixels, and the console reported zero errors.

Evidence:

- [Paper repaired candidate at 1440 × 1000](./screenshots/story-kernel-scene-grounding/01-paper-1440x1000.png)
- [Midnight repaired candidate at 390 × 844](./screenshots/story-kernel-scene-grounding/02-midnight-390x844.png)
- [Paper optional-null location at 1440 × 1000](./screenshots/story-kernel-scene-grounding/03-optional-null-paper-1440x1000.png)
- [Midnight optional-null location at 390 × 844](./screenshots/story-kernel-scene-grounding/04-optional-null-midnight-390x844.png)
- [Measured visual metrics](./story-kernel-scene-grounding-visual-metrics.json)

The in-app browser connector could not initialize in its protected runtime.
Local Playwright with installed Microsoft Edge supplied the equivalent
isolated DOM, interaction, screenshot, overflow, and console checks.

## Windows artifacts

The final portable build launched with an isolated
`WEBVIEW2_USER_DATA_FOLDER`. PID `48556` reached input idle, remained
responsive with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally within twenty seconds with code `0`; no forced termination was
required.

- Portable EXE:
  `tmp/story-kernel-scene-grounding-target/release/writing-buddy-next.exe`
  - 7,403,008 bytes
  - SHA-256:
    `6ECBEDDEC734FC49663DE12623A4867F2992055F9A1256B047D7BBDB4C9C1C78`
- NSIS installer:
  `tmp/story-kernel-scene-grounding-target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,209,271 bytes
  - SHA-256:
    `9F66E6315546E449863D3A973D47B7CE8D218AE0C704B44C1AA5FEBA1553FF1E`

## Safety boundary

- Automated verification never read or exposed a DeepSeek API key.
- No real provider request or automatic retry was made.
- The browser fixture and native smoke used sanitized or isolated state.
- The legacy repository remained read-only.
- Real-account output quality remains a separate human/provider acceptance
  gate.
