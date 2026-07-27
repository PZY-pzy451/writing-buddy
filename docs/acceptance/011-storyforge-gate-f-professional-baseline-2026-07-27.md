# StoryForge Gate F professional baseline acceptance

Date: 2026-07-27

Branch: `codex/phase-1.0a-deepseek-ai-foundation`

Scope: Tasks 21-24, Performance + Recovery + Final Acceptance

## Outcome

Gate F passed. The professional editor baseline meets the frozen performance,
responsive-layout, accessibility, migration, backup/recovery and vertical-slice
contracts. A fresh Windows release and NSIS installer were built from the
current source in an isolated target directory.

The first final-release process accepted a normal Windows close request and
exited within ten seconds. A second final-release process restored the
sanitized six-chapter project as `project-0000000a`, acquired its read-write
lock and rebuilt/loaded the Story Index. That second process remains running.

No further implementation Gate exists in the supplied plan. This report is the
stop point for explicit product direction.

## Gate F commits

| Task | Commit | Result |
| --- | --- | --- |
| 21, index and scale gates | `6591786` | passed |
| 22, responsive and accessible layouts | `8c254a4` | passed |
| 23, migration and recovery | `f76c64e` | passed |
| 24, final slice and documentation | `docs: record storyforge professional editor acceptance` | passed |

## Task 24 vertical slice

`apps/desktop/tests/e2e/storyforge-professional-slice.spec.ts` proves one
author-controlled flow:

1. open an isolated project gateway;
2. create a scene, two characters, location, item, timeline event and directed
   relationship through the strict repository;
3. transfer the unique item between non-overlapping holders;
4. run timeline and item consistency review;
5. build a grounded Context Pack;
6. create an AI rewrite candidate;
7. accept the candidate and Undo to the exact original manuscript;
8. snapshot, mutate and restore;
9. serialize a backup, restart through a new gateway and restore after Trash.

The slice passed 1/1 and is part of the complete 146-test suite. Real filesystem
snapshot, archive, restart and restore behavior is additionally exercised by
the Rust sanitized-project recovery gate rather than simulated UI data.

## Automated verification

Toolchain:

- Node.js `24.14.0`
- pnpm `10.32.1`
- TypeScript `5.9.3`
- Vitest `4.1.10`
- Rust/Cargo `1.97.1`

Results:

| Gate | Result |
| --- | --- |
| ESLint, zero warnings | passed |
| TypeScript `--noEmit` | passed |
| Vitest | 50 files, 146 tests passed |
| Vite production build | passed, 2,708 modules |
| Cargo format check | passed |
| Rust normal suite | 33 passed, 0 failed, 2 release gates ignored |
| Release performance gate | passed separately |
| Sanitized recovery gate | passed separately |
| Tauri Windows release | passed |
| NSIS x64 installer | passed |

The only compiler messages are MSVC linker notices that import libraries were
created; Cargo reports them as warnings and both the application and installer
finish successfully.

## Performance

The deterministic fixture contains:

- 1,000 chapters;
- 10,000 scenes;
- 5,000 formal resources;
- 50,000 events/states;
- 200,000 mentions;
- 266,001 indexed records after the measured update.

| Metric | Result | Threshold | Status |
| --- | ---: | ---: | --- |
| Project interactive | 443.8303 ms | 2,500 ms | passed |
| Resource switch | 0.6427 ms | 200 ms | passed |
| Single-resource save | 0.0065 ms | 300 ms | passed |
| Timeline feedback | 4.8962 ms | 100 ms | passed |
| Filtered graph | 0.1969 ms | 1,000 ms | passed |

Machine-readable evidence:
[`storyforge-performance.json`](./storyforge-performance.json).

## Responsive and accessibility evidence

Eight sanitized real-project captures cover the six supplied prototypes plus
1280 and 1024 breakpoints:

1. [Workspace overview](./screenshots/gate-f/01-workspace-overview-1536x992.png)
2. [Character center](./screenshots/gate-f/02-character-center-1536x992.png)
3. [Directed relationship graph](./screenshots/gate-f/03-relationship-graph-1536x992.png)
4. [Multi-track timeline](./screenshots/gate-f/04-timeline-1536x992.png)
5. [Story assets](./screenshots/gate-f/05-story-assets-1536x992.png)
6. [Grounded AI Context Pack](./screenshots/gate-f/06-ai-grounded-context-1536x992.png)
7. [Workspace at 1280x800](./screenshots/gate-f/07-workspace-overview-1280x800.png)
8. [Timeline at 1024x720](./screenshots/gate-f/08-timeline-1024x720.png)

All captures have:

- zero page-level horizontal or vertical overflow;
- zero clipped interactive controls;
- zero visible StoryForge controls below the 44px target;
- full-height internal scrolling at compact widths;
- no assistant column reserved while the assistant is closed at 1280px.

Modal focus enters, traps, escapes and restores correctly. Story navigation,
relationship matrices and timeline alternatives are keyboard accessible.
Muted text meets WCAG AA contrast and reduced-motion preference is honored.

The final Tauri process created the expected real window, but an unrelated
exclusive full-screen process occluded `Windows.Graphics.Capture`. To avoid
interacting with that application, no further screenshot clicks were issued.
This is recorded as an evidence-environment limitation, not a Writing Buddy
render assertion. Earlier real Tauri gates and the eight Gate F browser
captures cover visual proof; process, project-lock and index evidence cover the
final binary run.

## Data compatibility and recovery

| Check | Result |
| --- | --- |
| Frozen legacy fixtures | 10/10 passed |
| Blocking differences | 0 |
| Sanitized backup entries | 47 |
| Restored entries | 47 |
| Formal Story files | 30 |
| Chapter hashes | 6/6 unchanged |
| Story backlinks | 89/89 resolved |
| Restored project first open | passed, read-write |
| Restored project second open | passed, same ID |
| Derived cache in archive | absent |
| Incomplete AI job in archive | absent |

The v0-to-v1 migration stages a strict candidate without mutating input,
preserves an exact rollback object and rejects unsupported versions. Restore
verifies archive hashes and safe paths, clears derived caches, invalidates the
Story Index and rebuilds it from canonical files.

Evidence:

- [`compatibility-report.json`](./compatibility-report.json)
- [`storyforge-data-recovery.md`](./storyforge-data-recovery.md)
- [`storyforge-data-recovery.json`](./storyforge-data-recovery.json)

## Final Windows artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `tmp/gate-f-target-final/release/writing-buddy-next.exe` | 6,961,152 | `C0EF9675640698F92169E4894B04A915CAD99A1EEB7947280F0E38E67016AEE7` |
| `tmp/gate-f-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe` | 3,028,633 | `85B569DDB747E772438E434D7A4869503908092F8BD92072F369BAFDD651748D` |

Machine-readable launch/close evidence:
[`storyforge-final-desktop.json`](./storyforge-final-desktop.json).

## Compile and run

Development:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Desktop development:

```powershell
pnpm tauri:dev
```

Production:

```powershell
$env:CARGO_TARGET_DIR = "$PWD\tmp\gate-f-target-final"
pnpm tauri:build
.\tmp\gate-f-target-final\release\writing-buddy-next.exe
```

The repository requires Node 24.x and pnpm 10.32.1. On this machine the Node 24
runtime is available from the Codex desktop runtime directory.

## Known limitations

The accepted baseline intentionally has no:

- cloud synchronization;
- real-time collaboration;
- whole-book automatic generation;
- advanced fictional-calendar engine;
- complex visual map editor.

A user-provided DeepSeek key is still required to validate live model
discovery, account balance, network streaming, cancellation/restart and
automatic chapter review against the real external service. Local/manual
review and the author-confirmation workflow are available without that key.

## Recommendation

Create and push
`baseline-writing-buddy-storyforge-professional-v1` on the final Task 24
commit. Gate F is accepted; do not begin another implementation phase without
new product scope.
