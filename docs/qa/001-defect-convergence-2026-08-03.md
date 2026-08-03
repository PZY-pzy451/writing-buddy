# Defect convergence run — 2026-08-03

- Tested source: `81f94e36271bfb6dc3e87b87cba604159c998544`
- Branch: `codex/full-regression-gates-a-e-v2`
- Execution status: `PASS`
- Product conclusion: `PARTIAL`
- Release decision: `BLOCKED`

The executable test surface passed, including the highest-risk author journeys.
The product conclusion remains `PARTIAL` because strict feature/control/state
traceability is still incomplete. This run did not build or approve a release
package and did not call a real AI provider.

## Defects fixed

### QA-STORY-KERNEL-ACTION-REENTRANCY-005

The Story Kernel generation button already had a synchronous guard, but author
confirmation and rejection relied only on React's asynchronous `busyAction`
state. A deterministic UI test dispatched 100 confirmation clicks before the
first safety-snapshot Promise resolved. Before the fix, all 100 handlers entered
and started 100 snapshots, creating a path to repeated commits or repeated
collision errors.

Confirmation and rejection now share a synchronous action guard that is acquired
before the first awaited operation and released in `finally`. The focused panel
suite proves 100 confirmation clicks create exactly one snapshot and one atomic
commit, while 100 rejection clicks create exactly one candidate-state write.
It also proves a rejected snapshot leaves the candidate pending, shows a
localized message, releases the guard, and succeeds on the next author retry.
The complete 18-test panel suite and wider 731-test frontend run pass.

### QA-STORY-KERNEL-CANCEL-REENTRANCY-006

The stop-generation action had no synchronous guard. A deterministic native
bridge test held the first cancellation Promise open and dispatched 100 stop
clicks in the same render turn. Before the fix, the panel sent 100 cancellation
commands for one job.

The panel now acquires a dedicated cancellation guard before calling the native
bridge and shows a disabled `正在取消` control while the request is pending. A
successful command remains guarded until the generation stream reports its real
terminal event. A thrown command or a `false` job-not-found result releases the
guard and restores the stop action for retry. Three focused contracts cover all
of these paths; the complete panel suite passes 21 tests and never claims that
generation stopped before receiving the cancellation event.

### QA-AI-CANCEL-SURFACE-REENTRANCY-007

The same stop-generation boundary remained open in 13 adjacent user-facing
paths. The failing selection-rewrite reproduction sent 100 native cancellation
commands for 100 same-tick clicks. Manuscript extraction had a second defect:
one click called cancellation through its runner and then called the native
bridge again from the page, producing two commands without any rapid clicking.

Ten direct AI controls now use one shared cancellation component with a
synchronous per-job guard, explicit `正在取消` feedback, a stable selector and
stale-job result isolation. Genre generation, whole-work consistency scanning
and manuscript extraction retain their composite stop semantics behind
equivalent synchronous locks. Failed commands and missing native jobs release
the relevant guard for retry; unknown internal command errors are replaced by
stable author-facing copy. Extraction now gives the runner sole ownership of
the active native cancellation callback.

Four shared-control contracts plus deterministic selection-rewrite,
whole-work-scan, extraction and genre tests form a 21-test focused cancellation
suite. All pass, as do 32 affected-page tests covering the panels that consume
the shared control.

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

### QA-STORY-KERNEL-SCHEMA-MUTATION-MATRIX-004

The deterministic mock now includes one valid control candidate and one
explicitly wrong field for every generatable Story Kernel resource type:
character, scene, location, faction, item, world rule, timeline event,
relationship, plot thread, foreshadowing and information. All 11 target types
are selected, so a target-selection conflict cannot hide a Schema defect.

Parser replay, service and component tests prove the 11 malformed resources are
visible with field-specific diagnostics but disabled and absent from the atomic
write. Reload preserves the same quarantined state without a second AI call.
The relationship mutation correctly has both `invalid-schema` and
`blocked-dependency`, because its endpoint is the malformed character from the
same batch; the other ten mutations have only `invalid-schema`. Confirming the
single valid control creates exactly one snapshot, one commit and one character,
with zero resources written for the other ten types. This extension found no
production-code defect; it closed an all-type regression coverage gap.

### QA-TEST-DISCOVERY-PARAMETERIZED-001

The static inventory used a regular expression that counted a parameterized
test declaration once and missed statically generated loop cases. Before the
fix it found 667 frontend cases while Vitest collected 716, leaving an
unexplained difference of 49.

The scanner now uses the TypeScript AST. It expands literal and identifier-backed
`it.each` tables and statically bounded object loops, records declaration and
case metadata, and exposes unresolved dynamic parameterization instead of
inventing a count. The current inventory finds 742 frontend cases, including 50
parameterized instances; Vitest also collects 742. The difference and unresolved
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
| Story Kernel confirmation/rejection pressure | Initial reproduction: 100 clicks / 100 snapshots; fixed panel suite: 18/18 passed |
| Story Kernel cancellation pressure | Initial reproduction: 100 clicks / 100 native commands; fixed panel suite: 21/21 passed |
| Adjacent AI cancellation pressure | 13 paths audited; selection rewrite 100 clicks / 100 commands and extraction 1 click / 2 commands before fixes; 21 focused and 32 impacted-page tests passed |
| Reported malformed relationship boundary | Initial 4 files / 80 tests; continuation 2 files / 41 tests passed |
| All-type Story Kernel mutation matrix | 3 files / 52 tests passed; 1 valid control and 11 quarantined mutations |
| Node 24 frontend acceptance | ESLint, TypeScript, 173 files / 742 tests and production build passed |
| Static/runtime test reconciliation | 742 / 742; difference 0; unresolved parameterization 0 |
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

- Strict traceability remains `REGRESSION_INCOMPLETE`: 10,191 aggregate mappings
  are open and 223 interactive declarations lack stable selectors.
- The production Monaco chunk is 3,287.13 kB before gzip and remains above the
  configured 3,000 kB warning boundary.
- Rust emitted two localized MSVC linker-output warnings while producing test
  libraries; tests and formatting passed.
- Real-provider AI smoke, installer/portable packaging, and release approval did
  not run in this convergence cycle.
