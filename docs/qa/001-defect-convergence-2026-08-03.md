# Defect convergence run — 2026-08-03

- Tested source: `8c36b41639ef3da741407488e916baef0c8a54f2`
- Branch: `codex/full-regression-gates-a-e-v2`
- Execution status: `PASS`
- Product conclusion: `PARTIAL`
- Release decision: `BLOCKED`

The executable test surface passed, including the highest-risk author journeys.
The product conclusion remains `PARTIAL` because strict feature/control/state
traceability is still incomplete. This run did not build or approve a release
package and did not call a real AI provider.

## Defects fixed

### QA-STORY-KERNEL-RELATIONSHIP-SHAPE-003

The reported AI response combined three hazards in one candidate: it returned
`relationship` even though that type was not selected, used the string
`"childhood"` for the required `effectiveFrom` object, and used free text for
the required `history` array. These values cannot be safely coerced without
inventing a chapter position or relationship changes.

QA now contains a sanitized deterministic four-candidate response with exactly
that shape. Service and UI contracts prove that the malformed relationship is
visible for diagnosis but cannot be selected or written, while the other three
candidates remain selected and are committed through exactly one snapshot and
one atomic write. The TypeScript and Rust generation prompts now also forbid
unselected resource types and spell out the exact relationship position/history
shapes, reducing recurrence without weakening the final Story Kernel Schema.

The continuation pass adds lifecycle and pressure coverage around the same
fixture. A mixed selection containing one valid and one blocked candidate is
rejected before any repository write; component reopen restores all field-level
diagnostics without another AI request; and the 24-candidate upper bound writes
21 valid character resources in one transaction while retaining three malformed
relationships as pending, disabled candidates. No new production defect was
found in these follow-up boundaries.

### QA-TEST-DISCOVERY-PARAMETERIZED-001

The static inventory used a regular expression that counted a parameterized
test declaration once and missed statically generated loop cases. Before the
fix it found 667 frontend cases while Vitest collected 716, leaving an
unexplained difference of 49.

The scanner now uses the TypeScript AST. It expands literal and identifier-backed
`it.each` tables and statically bounded object loops, records declaration and
case metadata, and exposes unresolved dynamic parameterization instead of
inventing a count. The current inventory finds 726 frontend cases, including 50
parameterized instances; Vitest also collects 726. The difference and unresolved
declaration count are both zero.

### QA-WINDOWS-PNPM-SHELL-002

The Node 24 acceptance runner launched `pnpm.cmd` with `shell: true`, producing
Node `DEP0190` argument-escaping warnings. It now resolves pnpm's JavaScript
entry point and invokes it directly with the pinned Node executable. The final
acceptance report contains zero engine and zero unsafe-shell warnings; either
warning now fails the gate.

Rust formatting/test execution and convergence ledger updates also have their
own machine-readable runners, so current evidence no longer depends on copied
console claims.

## User-centered execution

| Layer | Result |
| --- | --- |
| Reported malformed relationship boundary | Initial 4 files / 80 tests; continuation 2 files / 41 tests passed |
| Node 24 frontend acceptance | ESLint, TypeScript, 172 files / 726 tests and production build passed |
| Static/runtime test reconciliation | 726 / 726; difference 0; unresolved parameterization 0 |
| Rust | format passed; 79 collected, 77 passed, 2 reasoned ignores, 0 failed |
| Browser detail soak | standalone run passed all 11 stages |
| Browser stress | 2 runs, 100,661 characters each, 80 resizes, 60 workspace transitions |
| Large-project performance | 5 runs; worst project-interactive time 405.953 ms |
| Backup/recovery | 10/10 cycles; 10 second launches; 0 unresolved backlinks |

The browser path covered first open, keyboard entry, long manuscript insertion
and save, pointer/keyboard pane resizing, workspace switching and reload,
Planning and Story Library compact layouts, quick-capture focus/dismissal,
Settings, persisted reopen, and project-style chapter fact extraction through
author confirmation. No raw `invalidStory...` error appeared.

The reported Story Kernel field variants are covered by focused contracts:

- scene `chapterId`, `manuscriptRange`, and `narrativeOrder` are rebuilt from the
  authoritative chapter selection;
- optional `mapPoint: null` is omitted without weakening required-field checks;
- known character `role` aliases are canonicalized while non-text corruption
  remains blocked;
- omitted item `unique` and `restrictions` receive conservative `false` and `[]`
  defaults, while explicitly wrong types remain blocked.

The invalid candidate remains fail-closed. Product prompt behavior changed only
after the deterministic case demonstrated that the earlier relationship wording
did not fully specify `targetTypes`, position objects or history arrays.

## Evidence

- `artifacts/qa/current-convergence-report.json`
- `artifacts/qa/node24-acceptance.json`
- `artifacts/qa/cargo-acceptance.json`
- `artifacts/qa/inventory-summary.json`
- `artifacts/qa/regression-ledger.json`
- `artifacts/qa/incremental-test-plan.json`
- `docs/acceptance/phase-1.2s-user-detail-soak.json`
- `docs/acceptance/phase-1.2s-user-stress.json`

## Remaining gates

- Strict traceability remains `REGRESSION_INCOMPLETE`: 10,334 aggregate mappings
  are open and 223 interactive declarations lack stable selectors.
- The production Monaco chunk is 3,287.13 kB before gzip and remains above the
  configured 3,000 kB warning boundary.
- Rust emitted four localized MSVC linker-output warnings while producing test
  libraries; tests and formatting passed.
- Real-provider AI smoke, installer/portable packaging, and release approval did
  not run in this convergence cycle.
