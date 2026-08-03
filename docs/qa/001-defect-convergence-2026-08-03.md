# Defect convergence run — 2026-08-03

- Tested source: `d9700cc8971ae9d7fe4bd3cad9925f9de6ad8a5c`
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

### QA-AI-CANDIDATE-WRITE-REENTRANCY-008

The same asynchronous-state boundary affected AI candidate adoption. A
deterministic continuation test held the safety-snapshot Promise open and sent
100 insert events in one React event batch. Before the fix, all 100 handlers
entered and requested 100 safety snapshots. The structured-outline adoption
path had the equivalent repeated-apply risk, and per-candidate busy state still
allowed another candidate in the same panel to start writing concurrently.

All 11 user-facing candidate-write surfaces were audited. Nine adjacent panels
now acquire a synchronous, panel-wide guard before any read, snapshot or store
operation; Story Kernel and selection rewrite already had equivalent guards.
Every new guard releases in `finally`, including snapshot and persistence
failures. While one write is active, all candidate adoption controls in that
panel are disabled rather than only the candidate that started it.

Two UI pressure contracts dispatch 100 same-tick accept events. Continuation
creates one snapshot and one insertion; structured outline invokes one apply.
The continuation failure contract also proves that a rejected snapshot performs
no write and a second author attempt succeeds. The nine affected test files pass
34 tests, followed by the complete 743-test frontend acceptance run.

### QA-AI-GENERATION-SURFACE-REENTRANCY-009

The same asynchronous-state boundary remained at AI generation entry points.
Deterministic reproductions sent 100 actions in one render turn to the character
panel, AI Playground, generic AI drawer and chapter review. Each surface started
100 native or provider requests before React rendered its queued/busy state.
Implicitly cancelling the active request did not solve the problem: it multiplied
provider traffic and allowed results from competing requests to replace each
other.

Eleven user-facing generation surfaces now acquire a synchronous request guard
before their first read or provider operation. While a request is active, inputs
that define the request are locked, including target/action selectors, chapter
scope, instructions, author-secret opt-in and context-pack selection. Duplicate
actions return without starting or cancelling another job. Ten dynamic pressure
scenarios now send 100 same-tick actions and observe exactly one native/provider
request and zero implicit cancellations.

Unknown provider-start errors are normalized to stable author-facing copy rather
than rendering raw `invalidStory...` or provider text. The generic drawer no
longer treats a prior error as a permanent start prohibition, and a character
panel contract proves that a failed provider start re-enables the action and the
next explicit attempt succeeds. The focused generation suite passes 12 files / 45
tests, followed by the complete 747-test frontend acceptance run.

### QA-PENDING-FACT-ACTION-REENTRANCY-010

The final adjacent persistence audit found that pending-fact acceptance and
rejection also depended only on React's asynchronous `busy` state. Both actions
now share a synchronous guard acquired before persistence and released in
`finally`. A 100-click acceptance pressure contract observes one acceptance
write; staging plus acceptance therefore produces exactly two storage writes.
The complete pending-fact suite passes 4 tests, including malformed output,
oversized input and atomic-write conflict behavior.

### QA-AI-ASYNC-RESULT-ISOLATION-011

The remaining AI Playground, generic drawer and chapter-review stores had the
same cancellation race below the React layer. Holding one native cancellation
Promise open and issuing 100 same-tick actions produced 100 native cancellation
commands in each store. The drawer also allowed an old action that was still
validating provider/context state to start after a different chapter action had
already replaced it, attaching old prompt work to the new visible context.

Each store now owns a synchronous per-job cancellation guard. After the awaited
native result, it verifies that the same job is still current and active before
changing state; a late cancellation or provider-start failure from an old job
cannot mark a newer job cancelled or failed. The drawer uses a generation-attempt
version that is invalidated by opening or resetting an action, so work that has
not yet received a job ID cannot cross chapter/action boundaries.

Failure contracts also reject raw native cancellation details, keep the active
job stoppable, release the guard for one explicit retry and clear the obsolete
error after that retry succeeds. Seven new deterministic contracts bring the
three focused files to 27 tests. The complete Node 24 acceptance run passes 173
files / 754 tests.

### QA-AI-SETTINGS-REENTRANCY-012

The AI settings page disabled controls only after React rendered its queued
`loading` state. Deterministic store tests held each first Promise open and sent
100 same-tick actions. Before the fix, key save, connection test, model refresh,
balance refresh and active-job credential deletion each issued 100 bridge calls;
the delete path also sent 100 cancellation commands. Rapid preference choices
were persisted concurrently, so an older completion could replace the author's
latest choice in both memory and native storage.

The store now owns one synchronous settings-operation boundary. Repeated actions
share one Promise, different actions queue without being dropped or multiplied,
and credential mutation blocks new generation. Preference writes use a coalescing
serial worker: the visible choice updates immediately, the latest queued value is
persisted last, and a final failure restores the last value that actually reached
storage. Credential removal records a successful cancellation before attempting
deletion, keeps the key configured if deletion fails, presents a retry path and
locks destructive confirmation plus all preference controls while pending.

Fourteen contracts bring the AI experience suite to 22 tests. They cover 600
same-tick settings actions, 100 generation attempts during deletion, queued
cross-action deduplication, failed-delete retry, truthful cancelled state and
latest-preference success/failure ordering. The complete Node 24 acceptance run
passes 174 files / 771 tests.

### QA-AI-PROVIDER-ACTION-FEEDBACK-013

Real browser QA reproduced a separate settings defect after a successful key
save. Clicking `测试连接` completed, but the page retained the stale
`API Key 已安全保存` notice, so the author could not tell whether the new action
had run. Model-list and balance refreshes also completed without an explicit
nearby outcome. The store swallowed those three failures, preventing the page
from reliably selecting success versus recovery copy.

Connection test, model refresh and balance refresh now each clear stale copy and
publish an action-specific success or failure result. Store failures are still
normalized for display but reject to the UI boundary, which keeps the relevant
button enabled for an explicit retry. Two deterministic component contracts
cover success replacement and sanitized failure/retry behavior; the focused AI
experience suite passes 22 tests.

The corrected flow was repeated through the running local application. Desktop,
620 px and 420 px widths passed; the 420 px document and body scroll widths
matched their client widths, the credential-removal confirmation cancelled
without deletion, and the browser console contained zero warnings or errors.
Only the deterministic browser bridge was used; no real provider key or request
was involved.

### QA-LEDGER-INVENTORY-RECONCILIATION-014

The final evidence audit compared inventory and ledger objects directly. Static
discovery and Vitest both contained 771 frontend cases, and Cargo contained 79,
but the regression ledger still held 848 total entries: the two new provider-
feedback cases had executed and passed without receiving ledger rows. Inventory
and supported acceptance refresh their own evidence, while dependency planning
owns ledger reconstruction; the convergence recorder previously did not reject
that missing workflow step.

The ledger was rebuilt through `pnpm qa:plan` and now contains all 850 cases:
771 frontend plus 79 native, with 848 passes and two reasoned native skips. The
convergence recorder now compares total, frontend and native ledger counts with
inventory/runtime evidence and fails closed with an instruction to run
`qa:plan` when any count differs. This prevents a stale evidence ledger from
being labelled `PASS` after new tests are added.

### QA-PROJECT-CREATION-REENTRANCY-015

Project creation used React's rendered `busy` state as its only duplicate-action
boundary. Directory selection, draft import, dirty-manuscript confirmation and
the final create action could therefore re-enter before the disabled state was
painted. The final write path already had native atomicity and no-overwrite
protection, but repeated preflights, dialogs and failed duplicate attempts were
still observable work rather than one author action.

The wizard now owns a synchronous action guard covering all three external
action boundaries. Automated pressure sends 100 same-tick directory choices,
100 import choices, 100 dirty-draft submissions and 100 final submissions; each
produces exactly one relevant bridge call, confirmation or project write. A
separate contract forces the first atomic save to fail, verifies localized
recovery copy and then succeeds from the unchanged final step.

Live browser QA completed a new blank project from the project menu, including
required-field errors, preflight summary and a final double-click. At 620 px and
420 px the document, dialog, content and footer had no horizontal overflow, and
the console contained zero warnings or errors. This run also found that Esc
returned focus to the document body because the originating menu item had
unmounted. The project menu now explicitly owns focus restoration; automated
and live 420 px checks both return focus to `项目菜单`.

### QA-PROJECT-OPEN-LIFECYCLE-016

Project switching and lock-recovery actions also relied on state that became
visible only after React rendered. The deterministic reproduction sent 100
same-tick actions: the directory chooser opened 100 times, read-only recovery
performed 100 project opens, and a dirty manuscript changed projects without
any author confirmation.

The app store now owns synchronous single-flight guards for the chooser and
project open lifecycle. Read-only open, lock repair and directory reveal also
use their synchronous recovery action state as a lock. Under 100-action pressure
each external boundary now executes exactly once; chooser failure releases for
an explicit retry. A dirty manuscript asks once, cancellation performs zero
bridge opens and preserves the current project and edit, while acceptance opens
the target exactly once. Project creation passes its already-confirmed dirty
state into the same lifecycle, avoiding a second prompt after the new project
has been safely created.

Live browser QA opened and edited the first chapter, confirmed the dirty state,
then exercised project switching and repeated switching at desktop, 620 px and
420 px. The accepted switch restored the fixture's original 94-word chapter;
the 420 px document measured 420 px client and scroll widths, and the browser
reported zero warnings or errors. The browser runtime automatically accepted
the native confirmation, so the cancellation path is evidenced by the 100-call
deterministic contract rather than a synthetic browser override.

### QA-RESOURCE-OPEN-LIFECYCLE-017

Opening a chapter or another project resource committed the target tab before
its file read had succeeded and did not protect the active dirty manuscript.
The deterministic reproduction sent 100 same-tick actions: reopening the active
chapter performed 100 disk reads and replaced the draft, switching away saved
zero times, a failed target read ran 100 times after already changing the active
target, and one delayed second-chapter read followed by 100 third-chapter intents
performed 101 reads with no reliable latest-intent boundary.

Resource opening is now a store-owned single-flight queue. Reopening the active
resource is a no-op; a dirty source is saved once before a switch; the target
tab, active resource, editor session and restored cursor commit together only
after a successful read. A newer queued target prevents a late read from
committing, while save/read failures preserve the source chapter and expose
localized recovery copy. A post-read save check also protects text typed while
the target is loading. Under the same 100-action pressure the contracts now
observe zero active-chapter reads, one save plus one target read for a dirty
switch, one failed read, and two total reads for the delayed second-to-third
latest-intent sequence. The focused store suite passes 10 tests and the wider
writer-session/workspace impact set passes 34.

Live browser QA typed into the first chapter, switched to the second, returned
to verify the saved text, and rapidly traversed the second and third chapters.
Heading, active tab and editor content remained paired with the final chapter.
The same transition passed at 420 px with document client and scroll widths both
420 px; the console contained zero warnings or errors.

### QA-RESOURCE-CLOSE-LIFECYCLE-018

Closing an active dirty tab had two conflicting meanings. The confirmation told
the author that unsaved text would be discarded, but the subsequent automatic
resource switch still saw the dirty session and could write it to disk. The
same close path also had no synchronous lock: 100 same-tick cancellations or
acceptances each opened 100 confirmations. The exit dialog's save-copy action
likewise opened 100 native save dialogs, and a failed read of the next tab could
leave a resource that was no longer in the tab list presented as active.

Tab close now acquires a per-resource synchronous lock before confirmation. A
cancel releases after the current event burst so an explicit later retry still
works. Accepted discard clears the active document before opening the next tab,
so it performs zero writes and the next resource commits only after one
successful read. A failed next read leaves no closed resource active, while a
background-tab close performs no confirmation, read or write and cannot disturb
the active dirty draft. `saveAs` now has its own single-flight promise; 100
save-copy exit actions share one native dialog and the dialog exits exactly once.
Cancelled save-copy actions release for an explicit retry. The 17-test store
suite and 3-test exit-dialog suite pass; the wider four-file impact run passes
44 tests.

Live browser QA replaced the first chapter with a 10-character unsaved marker,
closed it through the real tab control, and verified that the second chapter
became active without saving the marker. `Ctrl+Shift+T` restored the first
chapter from disk at its original 94-character count. At 420 px, `Ctrl+W`
closed the restored tab and left the third chapter heading and selected tab
aligned. Document client and scroll widths were both 420 px, with zero browser
warnings or errors. The browser runtime accepted the native confirmation, so
the cancellation path is evidenced by the deterministic 100-action contract.

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
inventing a count. The current inventory finds 769 frontend cases, including 50
parameterized instances; Vitest also collects 769. The difference and unresolved
declaration count are both zero.

### QA-WINDOWS-PNPM-SHELL-002

The Node 24 acceptance runner launched `pnpm.cmd` with `shell: true`, producing
Node `DEP0190` argument-escaping warnings. It now resolves pnpm's JavaScript
entry point and invokes it directly with the pinned Node executable. The final
acceptance report contains zero engine and zero unsafe-shell warnings; either
warning now fails the gate.

The continuation run found the same unsafe fallback in full self-test and the
complete regression runner when they were invoked directly through Node without
`npm_execpath`. Self-test still reported success while emitting `DEP0190`. Both
runners now share fail-closed pnpm JavaScript-entry resolution and never use a
shell. Three command-resolution contracts cover explicit, PATH-owned and missing
pnpm entries; the repeated full self-test passes all steps with zero `DEP0190`.

Rust formatting/test execution and convergence ledger updates also have their
own machine-readable runners, so current evidence no longer depends on copied
console claims.

## User-centered execution

| Layer | Result |
| --- | --- |
| Story Kernel confirmation/rejection pressure | Initial reproduction: 100 clicks / 100 snapshots; fixed panel suite: 18/18 passed |
| Story Kernel cancellation pressure | Initial reproduction: 100 clicks / 100 native commands; fixed panel suite: 21/21 passed |
| Adjacent AI cancellation pressure | 13 paths audited; selection rewrite 100 clicks / 100 commands and extraction 1 click / 2 commands before fixes; 21 focused and 32 impacted-page tests passed |
| AI candidate write pressure | 11 surfaces audited; continuation and outline each received 100 same-tick accepts and performed exactly 1 write; 9 files / 34 focused tests passed |
| AI generation pressure | 11 surfaces guarded; 10 dynamic scenarios send 100 same-tick actions and start exactly 1 request with 0 implicit cancellations; 12 files / 45 tests passed |
| Pending-fact persistence pressure | 100 same-tick accepts produce exactly 1 acceptance write; complete 4-test suite passed |
| AI cancellation/result ordering | Playground, drawer and review each reproduced 100 clicks / 100 commands; now 1 command, old validation/results isolated, failure retry verified; 3 files / 27 tests passed |
| AI settings and credential lifecycle | Five settings actions reproduced 100 bridge calls each; now 1 request per action, cross-action queueing, latest-preference ordering, deletion retry, generation blocking and explicit provider-action feedback pass 22/22 focused tests |
| Live AI settings journey | Save/test/model/balance outcomes verified; 620 px and 420 px widths have no horizontal overflow; removal confirmation cancelled; 0 console warnings/errors |
| Project creation action pressure | Four 100-action same-tick boundaries each produce one chooser, confirmation or write; first atomic-save failure remains retryable |
| Live project creation journey | Required errors, preflight, double-click creation and Esc focus return verified; 620 px / 420 px have no overflow; 0 console warnings/errors |
| Project open and recovery pressure | Five 100-action boundaries produce one chooser/open/confirmation/repair/reveal; dirty-switch cancellation performs 0 opens and preserves the draft |
| Live project switching journey | Dirty edit and accepted switch verified; repeated switch remains stable; 620 px / 420 px have no overflow; 0 console warnings/errors |
| Resource open lifecycle pressure | Six contracts cover 100 repeated actions, dirty saves, failed reads, delayed reads and loading-time edits; 10 focused and 34 impacted tests passed |
| Live chapter switching journey | Saved draft, return-open and rapid latest-intent switching verified at 1280 px / 420 px; heading/tab/editor remain paired; 0 console warnings/errors |
| Resource close lifecycle pressure | Eight contracts cover 100 confirmations/save-copy actions, discard semantics, retry, failed next reads and background closes; 20 focused and 44 impacted tests passed |
| Live chapter close/restore journey | Unsaved marker discarded, original 94-character chapter restored, 420 px Ctrl+W result aligned; no overflow; 0 console warnings/errors |
| Ledger/inventory reconciliation | 871 / 871 cases; 792 frontend + 79 native; 869 passed + 2 reasoned skips; stale ledgers fail closed |
| Reported malformed relationship boundary | Initial 4 files / 80 tests; continuation 2 files / 41 tests passed |
| All-type Story Kernel mutation matrix | 3 files / 52 tests passed; 1 valid control and 11 quarantined mutations |
| Node 24 frontend acceptance | ESLint, TypeScript, 174 files / 792 tests and production build passed |
| Static/runtime test reconciliation | 792 / 792; difference 0; unresolved parameterization 0 |
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

- Strict traceability remains `REGRESSION_INCOMPLETE`: 10,102 aggregate mappings
  are open and 221 interactive declarations lack stable selectors.
- The production Monaco chunk is 3,287.13 kB before gzip and remains above the
  configured 3,000 kB warning boundary.
- Rust emitted two localized MSVC linker-output warnings while producing test
  libraries; tests and formatting passed.
- Real-provider AI smoke, installer/portable packaging, and release approval did
  not run in this convergence cycle.
