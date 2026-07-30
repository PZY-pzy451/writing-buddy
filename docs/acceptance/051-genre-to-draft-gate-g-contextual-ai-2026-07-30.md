# Phase 1.2B Genre-to-Draft Gate G acceptance report

Date: 2026-07-30

## Gate

Gate G connects contextual AI to scene drafting without introducing a second
editor, AI runtime, candidate store, snapshot system, or project model.

Baseline commit: `3ae3b0e1 feat: optimize editor for outline guided drafting`

Branch: `codex/genre-to-draft-gates-a-c`

## Status

**PASS**

Gate G passed automated frontend and Rust regression, real browser interaction,
responsive measurement, Tauri Release/NSIS packaging, and native Windows
startup/normal-close verification. Gate H is not included.

## Delivered experience

- A low-weight Continue action appears at a valid paragraph-end cursor and the
  AI tool defaults to continuation when no text is selected.
- The author can optionally tell AI what should happen next. The committed
  guidance is included in the bounded continuation request.
- Continuation returns exactly three visibly distinct directions. Each
  candidate shows its proposed insertion point, grounded context titles, and
  the explicit `未使用作者秘密` privacy statement.
- Candidate batches remain stable while the author inspects the editor.
  Same-tick repeated generation clicks share one request.
- Every candidate provides `插入`, `查看差异`, and `拒绝`. Rejection is local to
  the selected candidate and does not mutate the manuscript.
- The compact, accessible diff renders original and suggested text without
  creating disposable Monaco diff models.
- AI insertion creates and verifies a canonical
  `beforeDestructiveOperation` snapshot before any manuscript mutation.
  Snapshot or save failure leaves the manuscript unchanged.
- Accepted text receives a temporary AI insertion highlight. The author can
  safely undo only while the document still matches the accepted transaction.
- Selection rewrite uses the same snapshot-before-write and safe-undo rules.
- Undo treats CRLF/LF normalization as equivalent while continuing to reject
  real content drift.
- Candidate actions remain above editor overlays at all supported widths,
  retain 44 px targets, visible focus, reduced-motion behavior, and readable
  disabled states.

## Privacy and safety

- Continuation reuses the existing contextual action, grounding pack, AI job,
  candidate review, project save, snapshot, and transaction services.
- Author secrets are forcibly excluded from continuation requests.
- Project paths, credentials, unrelated resources, and full-project dumps are
  not added to the request.
- Save, session, root, resource, dirty-state, and snapshot checks all complete
  before the first editor mutation.
- Undo is revision-aware and becomes unavailable after a genuine intervening
  content edit.

## Automated validation

- ESLint: PASS
- TypeScript: PASS
- Vitest: 150 files / 569 tests passed
- Production build: PASS
- Full self-test: PASS
- Release self-test: PASS
- `cargo fmt --check`: PASS
- Rust: 66 passed / 0 failed / 2 ignored external gates
- Tauri Release: PASS
- NSIS installer: PASS

Self-test report: `artifacts/self-test/latest.json`

## Browser acceptance

The visible browser workflow passed:

- paragraph-end Continue trigger;
- optional author guidance;
- exactly three directions;
- insertion position and grounding disclosure;
- author-secret exclusion;
- per-candidate rejection;
- compact diff;
- snapshot before insertion;
- two visible AI highlight fragments immediately after insertion;
- available safe Undo and exact original-text restoration;
- zero browser console warnings or errors.

Responsive measurements:

| Viewport | Page overflow | Assistant width | Minimum action height |
| --- | ---: | ---: | ---: |
| 1024 × 720 | 0 px | 360 px | 44 px |
| 1280 × 800 | 0 px | 360 px | 44 px |
| 1536 × 960 | 0 px | 360 px | 44 px |

Metrics: `docs/acceptance/genre-to-draft-gate-g-metrics.json`

Screenshots:

- `docs/acceptance/screenshots/genre-to-draft-gate-g/03-three-directions-diff-1024x720.png`
- `docs/acceptance/screenshots/genre-to-draft-gate-g/04-three-directions-diff-1536x960.png`
- `docs/acceptance/screenshots/genre-to-draft-gate-g/05-snapshot-insert-highlight-undo-1536x960.png`

The browser pass found and fixed two interaction defects not exposed by the
focused tests:

1. Monaco newline normalization disabled Undo after a valid insertion.
2. A responsive z-index override allowed the editor grounding popover to cover
   candidate actions.

## Native Windows acceptance

The final portable executable:

- opened one main window titled `Writing Buddy`;
- exposed a non-zero main-window handle;
- remained responsive;
- accepted a normal close request;
- exited within the bounded wait with code 0.

## Deliverables

Directory: `artifacts/release/genre-to-draft-gate-g/`

- `Writing-Buddy-0.1.0-genre-to-draft-gate-g-portable.exe`
  - 8,298,496 bytes
  - SHA-256:
    `980DFCF13F434C510EDB86CA2DB65A6FECDA80E6EE34F58F6301DA0296F99B86`
- `Writing-Buddy-0.1.0-genre-to-draft-gate-g-setup.exe`
  - 3,609,811 bytes
  - SHA-256:
    `664AA2394C4DBCFAA891A95C2B8F9E6FC4C69203BA83F3D5DC17D85855A451AA`

Checksums: `artifacts/release/genre-to-draft-gate-g/SHA256SUMS.txt`

The release build used Node 24.14.0.

## Known issues

- The Windows artifacts are unsigned and may show a SmartScreen warning.
- Vite still reports the existing large Monaco chunk warning. It does not
  affect Gate G behavior, tests, packaging, or startup.
- Gate H has not started.

## Git

Commit message: `feat: connect contextual ai to scene drafting`
