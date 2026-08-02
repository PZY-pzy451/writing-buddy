# Phase 1.2R full regression and bug convergence acceptance

Date: 2026-08-02

Status: **PASS**

Tested source: `f96951277a4763ed07c3a785964d29c79ac776b7` on
`codex/genre-to-draft-gates-a-c`. The one-command run started with a clean
working tree and completed in 653,272 ms.

## Outcome

`pnpm acceptance:full-regression` completed all 25 recorded steps. It built and
preserved the production Windows package, exercised an isolated native
acceptance executable, restored the production executable byte-for-byte and
then kept the production portable process alive for a seven-second smoke test.

No reproducible product defect remains open from this cycle.

## Coverage

- Source: ESLint, TypeScript, 167 Vitest files / 689 tests and the production
  Vite build.
- Native core: Cargo formatting and 77 Rust tests; the two ignored external
  gates were then activated explicitly.
- Browser: Gate G, five-profile Gate H, Phase 1.2B, 1.2C and 1.2E through 1.2Q,
  plus the current StoryForge Gate C journey. All 18 browser steps passed.
- Story Kernel: partial invalid candidate recovery, author-readable repair
  guidance, rapid double-click deduplication, retry return to idle, and no raw
  schema/settings error leakage.
- Responsive UI: 1536, 1440, 1280, 1024 and 820 px product profiles, plus the
  complete-novel native 390 px probe where applicable.
- Native journeys: genre-to-draft Gates A-D and a complete 12-chapter,
  24-scene, 29,770-character deterministic novel. Native reopen reported zero
  integrity, runtime and console errors.
- Scale: 1,000 chapters, 10,000 scenes, 5,000 resources, 50,000 events/states
  and 200,000 mentions. Project interactive time was 423.8807 ms against a
  2,500 ms threshold; every recorded performance metric passed its threshold.
- Recovery: 72 backup entries restored, 331 backlinks checked, zero unresolved
  backlinks and a successful second launch.
- Distribution: production Tauri Release, NSIS, production-byte restoration,
  no remaining application/test process and portable EXE smoke.

Machine-readable aggregate: [full-regression-latest.json](./full-regression-latest.json).

## Defects converged

1. The compact daily-goal popover extended beneath the fixed project sidebar,
   so sidebar controls won pointer hit testing at 820 px. Compact header mode
   now opens the popover rightward inside the manuscript surface.
2. The timeline grid retained its intrinsic minimum width and allowed event
   buttons to be clipped by the page root at 1024 px. The canvas/scroll grid
   item now permits shrinkage so the intended internal scroller owns overflow.
3. The legacy StoryForge capture recorded clipping but did not fail. It now
   rejects page overflow, clipped interactive controls and scoped controls
   below 44 px; its final five profiles report zero violations.
4. Several browser journeys had drifted from current navigation labels and
   welcome-page promises. Their routes now follow the current Writing Home,
   Planning, Story Library, import and export contracts.
5. Hidden-window Edge did not deliver real keyboard input reliably. The
   keyboard acceptance profiles now use isolated headless Edge and genuine CDP
   Space/key events.
6. Gate G could observe the old document immediately after `Page.reload` and
   randomly time out on the next editor assertion. It now waits for the actual
   CDP load event; the focused gate passed three consecutive runs before the
   final complete matrix.
7. Native automation waited for a debugging endpoint on the secure production
   EXE, which correctly exposes none. The full runner now archives production
   bytes first, builds a bundle-disabled acceptance executable with a local CDP
   port, runs native journeys, and always restores the production EXE before
   smoke testing.

## Deliverables

Directory: `artifacts/release/full-regression-2026-08-02/`

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-Portable.exe` | 8,598,016 | `A45AC8CD7DAD652F843048A4BDB0A8CE89976860CFA135672EAFE24EDDD8F3DA` |
| `Writing Buddy_0.1.0_x64-setup.exe` | 3,737,959 | `66F4D0F67DAE1EA0C0C527B8C20B5E9FED5D418071586CED068519616AB6C511` |

The same directory contains `full-regression-latest.json`,
`self-test-release.json`, `complete-novel-acceptance.json`,
`storyforge-performance.json`, `storyforge-data-recovery.json` and a SHA-256
manifest covering all seven deliverables.

## Boundaries

- AI browser journeys use deterministic local responses. This proves schema
  repair, deduplication and handoff behavior without sending manuscripts,
  credentials or prompts to an external provider; it is not a live-provider
  availability claim.
- Recovery uses the repository's deterministic, non-copyrighted novel fixture,
  not a private user project.
- The package is validated on this Windows host and remains unsigned, so
  SmartScreen may warn on first launch.
- Vite still reports the known Monaco chunk-size warning. It did not affect
  build, startup or the measured product journeys.

## Reproduction

```powershell
pnpm acceptance:full-regression
```
