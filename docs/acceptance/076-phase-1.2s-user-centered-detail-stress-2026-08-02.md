# Phase 1.2S user-centered detail and stress acceptance

Date: 2026-08-02

Status: **PASS**

Tested source: `3342ca448d8ea313b0adfbb5b386f76ac55bffe6` on
`codex/genre-to-draft-gates-a-c`. The complete regression started with a clean
working tree and completed in 644,991 ms.

## Outcome

The user-centered detail gate and the repeatable stress matrix passed. The
final `pnpm acceptance:full-regression` run completed all 26 recorded steps,
including the new Phase 1.2S browser journey, before the final release bytes
were stressed again.

No reproducible product defect remains open from this cycle.

## User-detail coverage

- First-time author: the welcome task was reachable by keyboard and exposed a
  named primary action.
- Returning and interrupted author: the saved chapter reopened cleanly after
  three reload interruptions. The isolated browser fixture was explicitly
  rehydrated after reload; real disk persistence remained covered by the native
  reopen and recovery gates.
- Long-form author: Monaco accepted a 510-character real input and a
  100,019-character load, then rendered, saved and reopened 100,661 visible
  characters. The final sample took 112 ms to apply, 99 ms to render and 39 ms
  to save.
- Keyboard and compact-screen author: 20 pointer and 20 keyboard splitter
  changes respected the 220–440 px bounds. Quick capture received focus after
  opening and closed with Escape.
- Navigation: 30 transitions covered Writing, Planning, Story Library, Check
  and History. All three Planning views and all eight Story Library views were
  inspected at 1024×720.
- Seventeen UI audits reported zero root overflow, clipped interactive
  controls, unnamed controls, raw implementation errors, duplicate dialogs or
  effective pointer targets below 24 px. The Monaco editing surface exposed a
  labelled textbox in both editor audits.

Machine-readable detail evidence:
[phase-1.2s-user-detail-soak.json](./phase-1.2s-user-detail-soak.json).

## Story Kernel and duplicate-action coverage

- All 11 generatable Story Kernel resource types were staged and confirmed,
  covering valid, partial, null and malformed structures.
- Safe structural defaults remained confirmable; unsafe values stayed visible
  and recoverable instead of leaking schema codes into the author interface.
- One test made 100 rapid generation attempts and proved that only one request
  crossed the service boundary while work was in flight.
- The focused suite passed 2 files / 33 tests. The final full suite passed 167
  files / 690 tests.

## Stress results

The final stress run targeted the exact production portable bytes and passed in
82,070 ms.

| Dimension | Final sample | Result |
| --- | ---: | --- |
| Browser soak | 2 runs, 100,661 characters each | PASS |
| Resize soak | 80 total pointer/keyboard attempts | PASS |
| Workspace switching | 60 transitions and 6 reloads | PASS |
| Large-project performance | 5 samples; interactive P95 452.4253 ms | PASS |
| Recovery | 10/10 cycles; 72 entries and 331 backlinks each | PASS |
| Recovery integrity | maximum unresolved backlinks: 0 | PASS |
| Release launch | 5/5 launches alive for at least 4,032 ms | PASS |

Machine-readable stress evidence:
[phase-1.2s-user-stress.json](./phase-1.2s-user-stress.json).

## Complete regression

- Source: ESLint, TypeScript, 167 Vitest files / 690 tests and production Vite
  build.
- Native: Cargo formatting, 77 Rust tests and two explicitly activated ignored
  performance/recovery gates.
- Browser: all 19 journeys passed, including the Phase 1.2S detail soak.
- Native and author journeys: genre-to-draft gates, complete 12-chapter / 24-scene
  novel, native reopen, sanitized recovery and portable smoke all passed.
- Distribution: the final portable remained alive for the seven-second smoke;
  no acceptance server or release process remained listening afterward.

Machine-readable aggregate:
[full-regression-latest.json](./full-regression-latest.json).

## Failures classified during convergence

1. The in-app browser controller failed initialization twice with
   `Cannot redefine property: process`; the documented isolated Edge/CDP
   fallback completed the same local test scope.
2. The browser fixture intentionally resets on reload. The test now rehydrates
   that fixture after each reload, while native and recovery tests prove actual
   on-disk persistence.
3. An ambiguous selector and a collected CDP evaluation promise were harness
   issues; selectors were narrowed and evaluation was made retryable.
4. Quick capture assigns focus on the next animation frame. Reading focus
   immediately created a flaky assertion; the gate now waits for the promised
   focus state and passed three consecutive focused runs.

None of these four failures reproduced as a product data-loss or author-flow
defect after the harness was aligned with the product contract.

## Deliverables

Directory: `artifacts/release/full-regression-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-Portable.exe` | 8,598,016 | `EE5F71277B0D2EFFCB5C41A26B102CA7EB64050C1E51FEBD2B91E10A6E59B3D1` |
| `Writing Buddy_0.1.0_x64-setup.exe` | 3,737,533 | `FE9836D73B052786B3B1DBA2911B77C773D0F0E9EBA0C85FBABBF8B545B3DD87` |

## Boundaries

- AI journeys use deterministic local responses. They prove schema repair,
  deduplication and handoff behavior without sending manuscripts or credentials
  to a paid provider; they do not claim live-provider availability.
- Browser reload uses the test bridge fixture; native reopen and ten sanitized
  backup/restore cycles provide the real filesystem evidence.
- Performance numbers are release gates for this Windows host, not universal
  hardware guarantees.
- The Windows package is unsigned, so SmartScreen may warn on first launch.
- Vite retains the known Monaco chunk-size warning; it did not affect build,
  launch, editing, save, recovery or the measured journeys.

## Reproduction

```powershell
pnpm acceptance:full-regression
pnpm acceptance:user-stress -- --browser-runs=2 --performance-runs=5 --recovery-runs=10 --release-exe=artifacts/release/full-regression-2026-08-02/Writing-Buddy-Portable.exe --release-runs=5
```
