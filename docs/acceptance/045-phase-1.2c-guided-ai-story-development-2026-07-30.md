# Phase 1.2C guided AI story development acceptance

Date: 2026-07-30

Branch: `codex/phase-1.2c-guided-development`

Baseline: `4eda09c9c73b91e1ca3014ff3edc015f7a98ffa9`

## Outcome

Phase 1.2C is accepted. The author can ask one explicit story question,
choose one of exactly three answers or write a custom answer, lock decisions,
see the exact downstream impact of an upstream edit, and keep or regenerate
one affected target at a time.

The implementation preserves all existing downstream drafts. It never starts
AI on page entry, chooses for the author, unlocks a decision, applies a whole
stage, rewrites a materialized chapter manuscript, or resolves an impact
without an explicit action.

## Contract and persistence

- Journey schema version 2 persists guidance answers, locks, exact impact
  records, audit status, and stale flags.
- Version 1 migrates deterministically without losing author content, stable
  IDs, revision, or timestamps.
- Repeated upstream edits deduplicate pending work by exact target.
- Keep and update resolve one row only. Materialized chapters expose keep-only
  handling.
- The existing expected-hash store remains the only journey write path.
- Rust rejects corrupt version 2, orphan locks, duplicate or missing targets,
  stale/impact mismatch, and invalid materialization.

## AI boundary

The shared TypeScript and Rust contract adds:

- `generate-guidance-question`: one question and exactly three distinct
  options;
- `regenerate-part`: one matching, unlocked direction, outline node, or
  unmaterialized chapter target.

Inputs contain only bounded story context, confirmed guidance answers, and
locked decisions. Paths, credentials, project metadata, unknown outline
sources, extra targets, mismatched IDs, prose-wrapped JSON, and malformed
counts fail before state mutation.

## Real Edge acceptance

The deterministic Edge runner completed the visible new-project path:

1. six truthful starts and the default idea route;
2. three author-entered elements with zero automatic AI;
3. one explicit question with exactly three choices and one persisted answer;
4. author locks on an element and core field;
5. editable story core, three directions, reordered outline, and three
   chapter proposals;
6. one atomic three-chapter materialization and first-chapter open;
7. dashboard return to the saved creation journey;
8. a core edit producing exactly 3 direction, 5 outline, and 3 chapter
   impacts;
9. one keep and one exact-target regeneration, leaving 9 pending records;
10. Escape close with exact focus restoration.

The run made 6 explicit AI fixture calls in total and reported zero browser
exceptions. Materialized chapter IDs remained attached and no chapter exposed
an AI replacement action.

| Surface | Viewport | Theme / motion | Overflow | Clipped | Minimum control |
| --- | ---: | --- | ---: | ---: | ---: |
| Elements | 1536×992 | Paper | 0 | 0 | 44 px |
| Outline | 1280×800 | Midnight / reduced | 0 | 0 | 44 px |
| Chapters | 1024×720 | Paper | 0 | 0 | 44 px |
| Impact dialog | 1280×800 | Midnight / reduced | 0 | 0 | 44 px |

Machine-readable evidence:
`docs/acceptance/phase-1.2c-guided-development-metrics.json`.

Key screenshots:

- `docs/acceptance/screenshots/phase-1.2c-guided-development/02a-one-question-three-options-paper-1536x992.png`
- `docs/acceptance/screenshots/phase-1.2c-guided-development/07-impact-dialog-midnight-reduced-1280x800.png`
- `docs/acceptance/screenshots/phase-1.2c-guided-development/08-impact-pending-paper-1280x800.png`

The in-app browser client could not initialize because the protected host
already defines `process`. The repository's isolated real-Edge CDP runner was
used instead; it drove the visible UI, captured screenshots, checked browser
exceptions, and used fresh browser profiles.

## Automated gates

- Node `24.14.0`, pnpm `10.32.1`
- ESLint: passed with zero warnings
- TypeScript: passed
- Vitest: 135 files, 502 tests passed
- Production Vite build: passed
- Cargo format: passed
- Rust: 60 passed, 2 explicit external-fixture/performance gates ignored
- Change-aware full self-test: passed
- Change-aware release self-test: passed
- Tauri release compilation: passed
- NSIS packaging: passed
- Portable EXE startup smoke: passed

The release report is written to the ignored local path
`artifacts/self-test/latest.json`.

## Windows delivery

Both files are x64 internal builds and are not digitally signed.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `artifacts/release/phase-1.2c/Writing-Buddy-Phase-1.2C.exe` | 7,980,032 | `60F23DDBAEADB12CFDEB13F1B861D9BE850E826ECDFC264CBCF70320E9E0EE80` |
| `artifacts/release/phase-1.2c/Writing-Buddy-Phase-1.2C-x64-setup.exe` | 3,529,208 | `942FDB279D9F874E12469B902AA899CD3132756978C2AE1092B1FB16A4372951` |

## Remaining external validation

- Real DeepSeek model quality, billing, streaming, cancellation, and account
  behavior require a user-provided key and were not simulated as account
  acceptance.
- The two ignored Rust gates require an external real-project fixture and the
  dedicated release performance command.
- Human cutover gates remain intentionally manual.

Phase 1.2D is not started.
