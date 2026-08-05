# Defect convergence run — 2026-08-03

- Tested source: `209db2938d28d6205d4168f6f46693b365cdd76a`
- Branch: `codex/full-regression-gates-a-e-v2`
- Execution status: `PASS`
- Product conclusion: `PARTIAL`
- Release decision: `BLOCKED`

The executable test surface passed, including the highest-risk author journeys.
The product conclusion remains `PARTIAL` because strict feature/control/state
traceability is still incomplete. This run did not build or approve a release
package and did not call a real AI provider.

Latest fixed source: `72e1147`. The current executable ledger contains 1,020
cases: 1,018 passes and two reasoned skips. Frontend discovery and runtime both
contain 941 tests; Rust passes 77 with two reasoned ignores. Stable-selector
debt is 140 and aggregate traceability debt is 11,065.

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

### QA-STORY-RESOURCE-OPEN-LIFECYCLE-019

Opening Story Kernel resources from search, editor peeks, routes and the writer
navigator called the Story service directly. That bypassed the manuscript-save
and latest-intent queue used by chapter resources. The deterministic baseline
therefore observed zero saves for a dirty chapter, 100 repository reads for 100
same-tick Story opens, a late Story result overwriting 100 newer chapter intents,
and a restored Story tab remaining in recently-closed history. Text entered
while the Story read was pending was also vulnerable to the late commit.

Story loading is now side-effect free until the app store commits it. Every UI
entry delegates to the same resource-open queue, which saves a dirty manuscript,
deduplicates repeated targets, checks project and latest intent after the read,
and runs a second save check for edits typed while loading. Only then are the
Story tab, active resource, result and writer session committed together. A
failed save performs zero Story reads, a newer chapter intent wins, and a
successful restore consumes its recently-closed entry. Five red-first lifecycle
contracts plus the service contract pass in the 27-test focused run; the wider
writer-session/workspace impact set passes 51 tests.

Live browser QA appended an unsaved marker to the third chapter, opened the
`信号塔` location from the author navigator and observed the manuscript change
to `已保存` before the Story tab became active. Closing that tab and pressing
`Ctrl+Shift+T` restored it once; a second shortcut did not duplicate the tab and
showed `没有可恢复的标签`. At 420 px the document client and scroll widths were
both 420 px, with zero browser warnings or errors.

### QA-STORY-RESOURCE-RECOVERY-LIFECYCLE-020

The next recovery boundary exposed seven user-visible failures. Rechecking the
active missing resource was swallowed as a no-op; 100 restore clicks performed
100 native restore calls; a slow restore could overwrite a newer chapter
choice; raw restore failures leaked into the UI; a repository read exception
escaped; restore mutated tabs before the caller validated intent; and one
transient Story read aborted the entire persisted-project reopen.

Missing and unavailable resources now remain explicit, retryable states. A
same-resource recheck reloads any non-ready result. Trash restore is
single-flight, side-effect free until the store validates project and latest
intent, and a failed restore releases its lock for a later retry. Transient read
errors render a localized `资料暂时无法读取` view with only the truthful
`重新检查` action; they do not claim the resource is in Trash or prevent the
rest of the project from opening. A stale restore result is discarded rather
than changing the author's newer chapter selection.

The red baseline contained 7 failures in a 36-test focused set. After the fix,
all 36 focused tests and all 66 impacted project-open/workspace tests pass. The
live browser reopened the same project with the existing `黄铜钥匙` Story tab
persisted, reactivated it from the tab strip by keyboard, and kept tab, heading
and content aligned at 420 px with no horizontal overflow and zero warning/error
logs. The current fixture exposes no product delete action, so the actual
missing/Trash setup is covered by deterministic store/service pressure tests
and the rendered missing/unavailable component contracts rather than by a
hidden browser-only test backdoor.

### QA-MONACO-EXTERNAL-CONFLICT-LIFECYCLE-021

The external-manuscript boundary exposed eight failures in a 35-test red
baseline. One hundred same-tick verification requests performed 100 disk reads;
a delayed read from an old chapter could attach a conflict to the new chapter;
a pre-save read could revive a conflict after a newer successful save; and one
hundred explicit overwrites could perform 100 native writes. The conflict dialog
also dismissed itself after a cancelled or failed save-copy, and allowed reload,
copy, overwrite, cancel and close actions to overlap while one action was active.

External verification is now single-flight per project/resource/path and keeps
at most one latest-resource follow-up. Every asynchronous result revalidates the
active project, resource, writer session, path and disk baseline before it can
change conflict, reload or offline state. Explicit overwrite is single-flight,
serializes edits typed during an in-flight write into one latest-payload follow-up,
and releases after failure. The dialog keeps both versions available until copy
or overwrite actually succeeds and makes all resolution actions mutually
exclusive while native work is pending.

All 35 focused tests and 70 impacted save/project/workspace/editor tests pass.
The full Node 24 gate passed 176 files / 815 tests plus lint, typecheck and the
production build; Rust passed 77 tests with two reasoned ignores. In-app browser
control was attempted after the deterministic UI contracts, but its runtime
failed while installing its process shim before page control. The live conflict
journey is therefore recorded as blocked test infrastructure, not a product
pass, and no product-only browser backdoor was added.

### QA-MONACO-UNDO-RESOURCE-ISOLATION-022

The AI manuscript commit notice exposed a cross-resource undo hazard. Its receipt
stored only post-insertion text and UI copy, and its enabled state compared only
the active session text. A behavior-preserving extraction produced a three-failure
red baseline: another chapter with identical text, a recreated Monaco model and
another project with colliding values were all accepted as valid undo targets.
One hundred same-tick clicks could also enter the asynchronous handler before a
rendered busy state disabled the button.

The receipt now binds project, resource, Monaco model URI and committed content.
The rendered banner dismisses itself when identity changes, leaves ordinary text
edits to Monaco's native undo stack, and acquires a synchronous action lock before
the first awaited operation. One hundred clicks perform one undo action; a failed
action shows localized retry feedback and releases the lock. The parent validates
the live editor model again before triggering undo and removes the one-click
receipt before its restored content enters normal save recovery.

The four predicate tests moved from three failures to green; the complete focused
set passed 7/7 and the seven-file editor/save/session/workspace/shortcut impact set
passed 81/81. Full Node 24 acceptance passed 178 files / 822 tests, lint,
typecheck and the production build. Rust passed 77 tests with two reasoned ignores.
Inventory caught the dynamic undo text as one new missing stable selector; an
explicit `aria-label="撤销 AI 正文写入"` restored the global count from 222 to 221,
and the full frontend gate was rerun after that correction.

### QA-SAVE-RETRY-SINGLE-FLIGHT-023

The manuscript save boundary exposed a failure-amplification defect. One hundred
same-tick Save/Retry calls correctly shared the first native write, but every
waiting caller interpreted the still-dirty manuscript after a failure as a new
request. The red baseline therefore performed 100 writes for one retryable
offline failure and 100 writes for one non-retryable permission failure. A
force-save failure could feed the same hidden normal-save retry path.

Waiting callers now schedule a follow-up only when the completed write succeeded
and the author entered newer text while it was in flight. Failed, offline and
conflict states stop after one write and require a later explicit author action.
The identity audit also found that normal save validated only the resource ID:
a late failure could change the new project's recovery state, and a late success
could replace the disk baseline of a same-ID chapter in another project. Save
results and delayed conflict reads now revalidate project root, project ID,
resource ID, path and writer session before mutating state.

The focused save suite passes 38/38 and the ten-file save/editor/session/workspace
impact set passes 93/93. Full Node 24 acceptance passes 178 files / 829 tests,
lint, typecheck and production build. Rust collects 79, passes 77 and retains
two reasoned ignores. The converged ledger contains 908 cases: 906 passes and
two reasoned skips.

### QA-PROJECT-OPEN-LATEST-INTENT-024

The project-open store used one active promise as a global duplicate guard.
While project A was loading, choosing project B returned A's promise and silently
lost B. A second red boundary showed that simply adding a queue was insufficient:
the superseded A snapshot became visible while the latest B target was still
loading. Failure of A also had to release the queue without dropping B.

Project opening now deduplicates repeated actions for the same target and keeps
one coalesced latest target when author intent changes. Intermediate choices are
discarded, the superseded project never becomes active, and the latest target
continues after an earlier open failure. If the author already accepted the
dirty-manuscript discard confirmation for this switch burst, the queued target
reuses that decision instead of prompting again.

The focused project-open experience passes 12/12 and the seven-file
project-open/save/session/workspace/Story-resource impact set passes 89/89. Full
Node 24 acceptance passes 178 files / 834 tests, lint, typecheck and production
build. Rust collects 79, passes 77 and retains two reasoned ignores. The
converged ledger contains 913 cases: 911 passes and two reasoned skips.

### QA-PROJECT-REPAIR-LATEST-INTENT-025

Project repair ran outside the project-open latest-intent queue. If repair of A
was delayed while the author opened B, successful repair A opened A again after
B, reversing the author's newer choice. A late repair failure also replaced B
with A's stale recovery error, and successful A repair could hide B's real open
failure.

Repair and open now share a monotonically increasing author-intent version. A
repair may open its target or publish its error only while its version is still
current. Once a newer open begins, the old repair clears only its own busy state;
it cannot mutate the active project, pending root or recovery dialog. The native
repair itself remains single-flight, so one hundred clicks still perform one
repair.

The red baseline failed exactly three of 15 project-open contracts. The repaired
focused suite passes 15/15 and the seven-file project-open/save/session/workspace/
Story-resource impact set passes 92/92. Full Node 24 acceptance passes 178 files /
837 tests, lint, typecheck and production build. Rust collects 79, passes 77 and
retains two reasoned ignores. The converged ledger contains 916 cases: 914 passes
and two reasoned skips.

### QA-AI-DRAFT-COMMIT-RESOURCE-ISOLATION-026

AI selection rewrites and continuations stored a temporary insertion target with
project ID, chapter ID and resource ID, then decided whether it was stale from
resource ID, revision and anchored content. A copied project can legitimately
share all of those values. Four red contracts proved that another project root,
another project ID, a changed resource path and a recreated Monaco model all
remained incorrectly actionable.

The target now binds project root, project ID, resource ID, resource path and
Monaco model URI. Candidate visibility, pre-save, post-save, post-snapshot and
final-save verification all require that exact identity and the captured Monaco
model object. Failure rollback calls `undo()` on that captured model, rather than
the currently mounted editor model, so switching projects during a delayed
operation cannot undo prose in the replacement project. Store rollback is
published only while the original target is still current.

The focused candidate/card/rollback suite passes 11/11 and the ten-file AI draft,
save, session and workspace impact set passes 98/98. Full Node 24 acceptance
passes 179 files / 842 tests, lint, typecheck and production build. Rust collects
79, passes 77 and retains two reasoned ignores. The converged ledger contains 921
cases: 919 passes and two reasoned skips.

### QA-AI-DRAWER-STALE-CONTEXT-ISOLATION-027

The global AI quick-action drawer bound a preview only to its source revision.
Four red contracts proved that changing project root, project ID, resource path
or Monaco model while keeping the same revision left the old preview valid. A
fifth failure showed that an in-flight job was neither cancelled nor invalidated
when the source changed, so delayed output could still become a preview in the
replacement project.

The drawer now binds project root, project ID, resource ID, path, model URI and
revision. App-level observation includes every scalar, so an equal revision
cannot suppress the change notification. Source changes invalidate the attempt,
issue at most one cancellation across 100 notifications, detach the old job,
drop delayed events, scrub Context Pack/output and block retry until the author
opens a fresh action from the current chapter.

The audit also found that `reset()` merged only four initial fields and retained
the old job, scope and Context Pack; a queued 40 ms stream flush could repopulate
output after reset. One red pressure contract now proves 100 resets cancel once,
clear every optional field and never revive buffered output. The repaired Store
suite passes 15/15 and the nine-file AI/drawer/app/session/save impact set passes
113/113. Full Node 24 acceptance passes 179 files / 850 tests, lint, typecheck and
production build. Rust collects 79, passes 77 and retains two reasoned ignores.
The converged ledger contains 929 cases: 927 passes and two reasoned skips.

### QA-AI-DRAWER-CLOSE-CANCELLATION-028

Closing the global AI quick-action drawer changed only its visible `open` flag.
Five red instances proved that Close button, Escape and backdrop dismissal left
validation or streaming active in the background, issued no cancellation and
retained the old job, Context Pack, output and pending 40 ms stream buffer.

All dismissal paths now use the hardened full reset boundary. One hundred
repeated closes issue exactly one native cancellation, invalidate the attempt,
clear transaction/context/output state and detach delayed events. A rejected
cancellation remains hidden after close, and a fresh quick action opens against
the current chapter without reviving prior state.

The repaired Store and rendered-dialog suites pass 22/22 and the nine-file AI,
drawer, App, session and save impact set passes 118/118. Full Node 24 acceptance
passes 179 files / 855 tests, lint, typecheck and production build. Rust collects
79, passes 77 and retains two reasoned ignores. The converged ledger contains
934 cases: 932 passes and two reasoned skips.

### QA-AI-DRAWER-REOPEN-CANCELLATION-029

An author can press Stop and immediately reopen quick actions from another
chapter while the first cancellation Promise is still pending. Two red
success/failure instances proved that explicit Stop acquired the cancellation
guard, but `openAiAction()` bypassed it and sent a second native cancellation
for the same job.

Reopen, stale-source invalidation and reset now share one guarded silent
cancellation helper while explicit Stop retains its visible feedback behavior.
One hundred repeated reopens issue one cancellation, preserve the latest
chapter context and discard buffered or delayed output from the first chapter.
Late cancellation success or failure cannot mutate the reopened action, and a
fresh request can complete normally against the current chapter.

The repaired drawer suites pass 25/25 and the nine-file AI, drawer, App, session
and save impact set passes 121/121. Full Node 24 acceptance passes 179 files /
858 tests, lint, typecheck and production build. Rust collects 79, passes 77 and
retains two reasoned ignores. The converged ledger contains 937 cases: 935
passes and two reasoned skips.

### QA-AI-DRAWER-CONTEXT-FREEZE-030

The generic AI drawer captured a Context Pack when generation started but kept
optional records editable throughout the request. Five state-matrix failures
proved 100 toggles changed the displayed pack during validation, queueing,
connection, streaming and output validation. The rendered streaming control was
also enabled, and changing context after preview left output and its transaction
actionable. A follow-up rendered-state audit found the same unlocked control
during candidate application.

The Store now rejects context changes through all six request/application
states, and Context Preview exposes the same disabled contract. Application is
locked separately from the cancellable generation states, so the Stop control
does not become misleadingly enabled. Changing optional context after preview
atomically clears raw/parsed output, transaction, usage and terminal job
identity; the author can then generate a fresh candidate from the new pack.

The repaired Store, drawer and context suites pass 41/41 and the ten-file AI,
drawer, App, session and save impact set passes 137/137. Full Node 24 acceptance
passes 179 files / 871 tests, lint, typecheck and production build. Rust collects
79, passes 77 and retains two reasoned ignores. Static discovery finds all 871
frontend tests, including 77 parameterized instances with zero unresolved
declarations. The converged ledger contains 950 cases: 948 passes and two
reasoned skips.

### QA-AI-DRAWER-REGENERATION-ISOLATION-031

Starting a replacement generation from an existing preview cleared only its raw
text before awaiting provider status and preferences. The old job ID, metadata,
parsed candidate and transaction remained structurally active, so delayed old
events could still match the Store and a failed replacement setup could leave
the superseded preview available.

Five red contracts now cover delayed delta, usage, failure, cancellation and
completion events; missing configuration; provider-status and preference
exceptions; and 100 same-tick regenerate actions. The Store clears every old
job/candidate artifact before the first await. One replacement validation starts
one distinct job, and only that job can produce an actionable preview.

The repaired Store, drawer and context suites pass 46/46 and the ten-file impact
set passes 142/142. The initial full product acceptance passes 179 files / 876
tests plus lint, typecheck and production build.

### QA-VITEST-WORKER-POOL-032

The first fixed-commit baseline did not fail a product assertion, but Vitest's
default Windows fork pool lost one worker after completing 178/179 files and
869/876 tests. A second isolated attempt did not terminate within the bounded
240-second QA command. Neither incomplete run was accepted as release evidence.

The same suite completed 179/179 files and 876/876 tests with two thread workers
before changing configuration. The supported configuration now pins that pool
and has a regression contract. Final fixed-commit acceptance exits normally
with lint, typecheck, production build and 180/180 files / 877/877 tests.

### QA-AI-DRAWER-RETRY-APPLY-EXCLUSION-033

The drawer's only generation button was disabled whenever a localized error was
present, so an author could not retry a failed request without closing and
reopening the action. At the opposite lifecycle edge, candidate application did
not disable Start or guard `startGeneration()`; a direct event could clear the
preview transaction and launch another request while application was active.
The same Store gap also allowed invalid action input to start when the rendered
disabled control was bypassed.

Four red contracts reproduce these behaviors. Failure state now permits one
explicit retry across 100 actions. Applying state disables Start and Stop, and
100 direct Store starts perform zero additional provider checks/jobs while
preserving the transaction. Invalid input performs zero provider calls.
Cancelled and rejected controls prove valid explicit regeneration remains open.

The repaired Store and drawer suites pass 48/48 and the ten-file impact set
passes 147/147. Fixed-commit acceptance passes lint, typecheck, production build
and 180 files / 882 tests. Rust collects 79, passes 77 and retains two reasoned
ignores.

### QA-AI-DRAWER-TERMINAL-EVENT-ISOLATION-034

The drawer filtered stream events by job ID but continued accepting them after
that same job had reached preview, failure or cancellation. Four red contracts
proved delayed same-job events could replace terminal output, usage and error
data, revive a terminal state, and let duplicate early lifecycle events regress
an active stream from `streaming` to `connecting`.

The Store now accepts stream events only in queued, connecting or streaming
states and makes early transitions monotonic. Three terminal-state pressure
cases replay 100 bursts of all eight event variants and preserve the complete
terminal snapshot. The active-stream case rejects duplicate start/connection
events and still reaches preview after an ordered completion.

The repaired Store suite passes 40/40 and the ten-file AI drawer, App, session,
save and error impact set passes 151/151. Fixed-commit acceptance passes lint,
typecheck, production build and 180 files / 886 tests. Rust collects 79, passes
77 and retains two reasoned ignores.

### QA-AI-DRAWER-TERMINAL-COMMAND-RESULT-ISOLATION-035

Stream terminal events and native command Promises finish independently. Six
red contracts proved that a start-command rejection arriving after preview,
failure or cancellation replaced the terminal state/error, while a pending
Stop rejection attached a generic error to each otherwise authoritative stream
result.

Start failures can now update only context validation or active stream states.
Stop failures require the same job to remain queued, connecting or streaming.
Each terminal Stop case dispatches 100 same-tick actions, sends one native
cancellation command and preserves state, output, parsed result, transaction,
usage and error after rejection. Existing active-failure contracts prove live
errors remain localized and retryable.

The repaired Store suite passes 46/46 and the ten-file AI drawer, App, session,
save and error impact set passes 157/157. Fixed-commit acceptance passes lint,
typecheck, production build and 180 files / 892 tests. Rust collects 79, passes
77 and retains two reasoned ignores.

### QA-AI-DRAWER-PREVIEW-REJECTION-SINGLE-COMMIT-036

The Reject candidate action checked only that a transaction existed. Four red
contracts proved that a 100-action burst threw `aiPreviewNotRejectable` on the
second event, while delayed events during applying, completed or stale could
throw or alter the current transaction.

The Store now requires both lifecycle state and transaction status to be
`preview`. One hundred valid actions perform one rejection and every later
action is a no-op. Applying, completed and stale snapshots each survive 100
delayed actions without mutation or exception. Rejection sends no cancellation
and no additional provider request; explicit regeneration after rejection
remains available.

The repaired Store suite passes 50/50 and the ten-file AI drawer, App, session,
save and error impact set passes 161/161. Fixed-commit acceptance passes lint,
typecheck, production build and 180 files / 896 tests. Rust collects 79, passes
77 and retains two reasoned ignores.

### QA-AI-DRAWER-APPLYING-CLOSE-PROTECTION-037

Candidate application was already protected from regeneration, cancellation,
Context Pack changes and rejection, but all four author close paths could still
reset the drawer while the write continued. Four red contracts proved that 100
direct Store closes erased the applying transaction, the close button remained
enabled, and Escape plus backdrop dismissal both unmounted the only visible
transaction evidence.

Author-facing `close()` now rejects the `applying` state synchronously. The
button exposes the same disabled state, while Escape and backdrop remain routed
through the Store boundary. All four paths preserve state, parsed output and the
transaction without issuing a cancellation. Explicit internal `reset()` still
supports application teardown, and idle plus streaming close behavior remains
unchanged.

The first fixed-commit inventory also exposed an old hidden selector collision:
the width toggle had no static accessible name after the close button became a
distinct control. Its stable name is now `切换 AI 抽屉宽度`, while the tooltip
continues to say whether the next action expands or restores the drawer. Missing
stable selectors returned from 222 to the prior 221 before the final baseline.

The repaired Store/drawer suite passes 67/67 and the ten-file AI drawer, App,
session, save and error impact set passes 172/172. Fixed-commit acceptance passes
lint, typecheck, production build and 180 files / 901 tests. Rust collects 79,
passes 77 and retains two reasoned ignores.

### QA-AI-DRAWER-APPLYING-OPEN-ACTION-ISOLATION-038

The public registered-action launcher did not share the applying-state lock.
One red Store contract proved that 100 replacement launches changed the bound
source from chapter 1 to chapter 2, reset the drawer from applying to idle and
erased its parsed output plus transaction. The existing modal shortcut boundary
already ignored 100 `Alt+A` events and is retained as a user-path green control.

`openAiAction()` now rejects applying state before it changes generation
identity, issues cancellation or rebuilds action context. One hundred direct
replacement attempts preserve the original definition, input, source, Context
Pack, parsed output and transaction. They perform one original provider request
and zero cancellation commands. Non-applying reopen, cancellation and explicit
teardown contracts remain green.

The repaired Store/App suite passes 75/75 and the ten-file AI drawer, App,
session, save and error impact set passes 174/174. Fixed-commit acceptance passes
lint, typecheck, production build and 180 files / 903 tests. Rust collects 79,
passes 77 and retains two reasoned ignores.

### QA-STORY-KERNEL-STABLE-CONTROL-SELECTORS-039

The Story Kernel generator exposed useful author-facing dynamic labels, but
five source declarations lacked static selector metadata: the generation
instruction, resource-type selection, Generate/Cancel state control, candidate
selection and structure expansion. The inventory also collapsed Generate and
Cancel into one declaration, preventing deterministic idle/streaming-state
targeting. Two rendered contracts failed red on those exact boundaries.

Static `name` or `data-testid` metadata now supplements rather than replaces
the visible and accessible names. `生成 Story Kernel 候选`, `取消`, title-specific
candidate selection and `查看结构` / `收起结构` remain author-facing, while QA can
target each control independent of localized or stateful text. Generate and
Cancel are now separately inventoried.

The source file moved from eight controls with five unmapped declarations to
nine controls with zero unmapped declarations. Global missing stable selectors
fell from 221 to 216. Correctly separating Generate and Cancel raised global
control inventory from 423 to 424 and derived state coverage from 9,306 to
9,328. The panel suite passes 22/22, the schema/service/diagnostic/fixture impact
set passes 93/93, and fixed-commit acceptance passes lint, typecheck, production
build and 180 files / 904 tests. Rust collects 79, passes 77 and retains two
reasoned ignores.

### QA-PENDING-FACT-EXTRACTION-PREFLIGHT-FEEDBACK-040

The pending-fact extraction handler already rejected duplicate work through a
synchronous ref, but the rendered action remained enabled with its idle name
until the provider emitted the first lifecycle event. Holding provider preflight
open proved that 100 clicks started one request yet gave the author no visual or
accessible acknowledgement. The extraction action and three fact-editing
declarations also lacked static selector metadata on the workflow that had
previously surfaced `invalidStoryExtractionInput`.

Extraction now publishes rendered busy state at the same instant as the ref
guard. During preference lookup or provider validation, the action is disabled
and named `正在提取 · 0 字符`; completion and failure release it for the existing
localized success or retry path. The extraction action, title, statement and
narrative-order controls expose static metadata while preserving the visible
field labels.

Two rendered contracts failed red. The panel passes 6/6 and the panel/service/
parser impact set passes 43/43, including invalid-input localization, malformed-
response quarantine and author-confirmed persistence. The source moved from
four unmapped controls to zero and global missing selectors fell from 216 to
212. The first fixed-commit run correctly stopped on a `Promise<unknown>` test-
fixture type error; after making the held response explicitly `Promise<string>`,
final acceptance passes lint, typecheck, production build and 180 files / 906
tests. Rust collects 79, passes 77 and retains two reasoned ignores.

### QA-MANUSCRIPT-EXTRACTION-RUN-SINGLE-FLIGHT-041

The manuscript extraction page relied on React's later `busyAction` render to
disable Start, and its runner had no active-run authority below the UI. A
same-frame pressure contract invoked the runner 100 times. Direct runner
pressure returned 100 independent Promises, raced the persisted run ledger and
produced 99 `staleWrite` rejections before any additional chapter could safely
start.

The page now claims a synchronous run guard before changing rendered state. The
runner independently owns and returns one shared active Promise, so direct or
future non-React callers receive the same result instead of entering storage or
AI processing again. Both layers release only after settlement; one later
explicit resume receives a new Promise. Stop, completed-chapter preservation,
stale-source handling and failed-chapter resume remain unchanged.

Two pressure contracts failed red. The page/service set passes 15/15 and the
page/service/AI-runner/Story-Kernel-staging/cancellation impact set passes 48/48.
Fixed-commit acceptance passes lint, typecheck, production build and 180 files /
908 tests without unhandled Promise rejections. Rust collects 79, passes 77 and
retains two reasoned ignores.

### QA-MANUSCRIPT-EXTRACTION-EARLY-STOP-042

The extraction runner reset its Stop flag after the asynchronous ledger load.
An author pressing Stop immediately after Start therefore saw the run continue
to completion. A second timing gap after chapter source loading also allowed the
processor to start, and Stop during provider preference lookup still launched
one native paid AI job because no job ID or native cancellation callback existed
yet.

Each run now creates its own `AbortSignal` synchronously before the first await.
Stop aborts that signal without depending on React state or a native job ID.
Runner initialization, source loading and processor completion recheck it, and
the Grounded AI boundary checks before and after preference lookup. Existing
native cancellation remains authoritative after a job ID exists.

Four contracts failed red: immediate Stop ended `completed`, source-load Stop
completed the chapter, and the rendered/direct provider-preflight cases each
started one native job. The extraction/Grounded AI set passes 21/21 and the
thirteen-file shared-AI impact set passes 58/58. Explicit resume processes the
stopped chapter once. Fixed-commit acceptance passes lint, typecheck, production
build and 180 files / 912 tests; Rust collects 79, passes 77 and retains two
reasoned ignores.

### QA-INVENTORY-COMPOSITE-CONTROL-043

The QA scanner treated any JSX tag carrying an event-like prop as a rendered
control. PascalCase React component boundaries such as `DndContext`,
`ResizeHandle`, `TextField` and `ContextPackPreview` were therefore counted a
second time even though their intrinsic DOM controls are discovered in their
own implementation files. This added false selector debt and multiplied each
duplicate into synthetic interaction states.

One integration contract failed red with all 16 composite types. Custom
interaction discovery is now restricted to intrinsic lowercase JSX elements;
native controls and intrinsic elements with handlers remain inventoried. The
result removes 16 false controls, 352 synthetic states and 16 false selector
gaps: inventory moves from 424 controls / 9,328 states / 212 missing selectors
to 408 / 8,976 / 196. Aggregate traceability debt moves from 10,159 to 9,792,
and the genuine remaining debt still fails closed.

The QA-script impact set passes 16/16. Fixed-commit acceptance passes lint,
typecheck, production build and 181 files / 913 tests. Rust collects 79, passes
77 and retains two reasoned ignores.

### QA-CREATION-JOURNEY-STABLE-CONTROLS-044

The zero-to-draft Creation Journey had the largest remaining source-specific
selector debt. Fourteen inventory controls had no static metadata across stage
navigation, guidance, idea fields, direction selection, outline dragging and
chapter confirmation. Several distinct repeated fields also shared the same
structural inventory identity, so the lower control count hid real test surface.

Two contracts failed red: inventory returned all 14 missing IDs and the full
ideas-to-three-chapters journey could not find a stage-navigation anchor. Static
semantic names and test IDs now cover every declaration without replacing
dynamic author-facing labels. The page moves from 22 controls (8 mapped / 14
missing) to 38 controls, all mapped. Global selector debt falls from 196 to 182.

The 16-control and 352-state increase is intentional measurement expansion.
Together with one new contract, strict traceability debt rises from 9,792 to
10,161 until those newly visible states receive behavior mappings. A brittle
three-outline-node assertion was replaced by card/field consistency, and an
unwrapped Store reset in test cleanup was brought under `act`, removing React
stderr from the impact run.

Creation Journey regression passes 19 files / 64 tests and QA scripts pass
17/17. Fixed-commit acceptance passes lint, typecheck, production build and 181
files / 914 tests. Rust collects 79, passes 77 and retains two reasoned ignores.

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
| Story resource open lifecycle pressure | Five red-first contracts cover 100 repeated opens, dirty saves, late results, loading-time edits and restored-history consumption; 27 focused and 51 impacted tests passed |
| Live Story resource open/restore journey | Dirty chapter saved before `信号塔` opened; close and one restore succeeded; second restore did not duplicate; 420 px has no overflow; 0 console warnings/errors |
| Story resource recovery lifecycle pressure | Seven red-first contracts cover missing recheck, 100 restore actions, stale restore intent, localized retry, read exceptions and project reopen; 36 focused and 66 impacted tests passed |
| Live persisted Story reopen journey | Existing `黄铜钥匙` Story tab survived same-project reopen and keyboard activation; tab/heading/content remained aligned at 420 px; no overflow; 0 console warnings/errors |
| External manuscript conflict lifecycle | Eight red-first failures cover 100 verification/overwrite actions, old-resource and post-save stale reads, in-flight edits, retry and truthful save-copy cancellation; 35 focused and 70 impacted tests passed |
| Live external-conflict journey | Blocked before page control by in-app browser runtime initialization; deterministic rendered-dialog contracts pass and no product test backdoor was added |
| AI draft undo resource isolation | Three red identity failures plus 100-click pressure; exact project/resource/model/content targeting, stale dismissal, localized retry and stable accessible name now pass 7 focused and 81 impacted tests |
| Save retry and result isolation | 100-click retryable/non-retryable failures fell from 100 writes to 1; explicit retry, force-save waiting and cross-project late result isolation pass 38 focused and 93 impacted tests |
| Project open latest intent | Same-target bursts remain one open; distinct selections coalesce to the latest target without exposing superseded projects; failure continuation and one dirty-discard confirmation pass 12 focused and 89 impacted tests |
| Project repair latest intent | One hundred Repair actions perform one native repair; a delayed success/failure cannot override a newer project or its actionable error; 15 focused and 92 impacted tests pass |
| AI draft commit resource isolation | Four target-identity collisions fail red; exact project/root/path/model checks and captured-model rollback pass 11 focused and 98 impacted tests |
| AI drawer stale-context isolation | Six red failures cover same-revision identity collisions, delayed output and incomplete reset; 15 focused and 113 impacted tests pass |
| AI drawer close cancellation | Five red failures cover Store close, Close button, Escape and backdrop; 100 closes cancel once; 22 focused and 118 impacted tests pass |
| AI drawer reopen cancellation | Stop plus immediate reopen sent two cancellations; success/failure ordering and 100-reopen pressure now pass 25 focused and 121 impacted tests |
| AI drawer Context Pack freeze | Six request/application states reject 100 toggles each; post-preview changes invalidate old output; 41 focused and 137 impacted tests pass |
| AI drawer preview regeneration | Five red failures cover old delayed events and three replacement setup failures; 100 actions start one replacement; 46 focused and 142 impacted tests pass |
| Windows Vitest worker stability | Default fork pool lost a worker then hung; bounded 2-worker thread pool completes 180 files / 877 tests and exits normally |
| AI drawer retry/apply exclusion | Four red failures cover disabled retry, applying-state reentry and invalid-input bypass; 100-action guards, 48 focused and 147 impacted tests pass |
| AI drawer terminal-event isolation | Four red failures cover terminal revival and active-state regression; three 100-burst terminal matrices, 40 focused and 151 impacted tests pass |
| AI drawer terminal command-result isolation | Six red failures cover late start/Stop rejections after three terminal outcomes; 100-action Stop matrices, 46 focused and 157 impacted tests pass |
| AI drawer preview rejection single-commit | Four red failures cover repeated and delayed Reject actions; four 100-action boundaries, 50 focused and 161 impacted tests pass |
| AI drawer applying close protection | Four red failures cover Store, button, Escape and backdrop dismissal; 100 direct closes preserve one applying transaction, 67 focused and 172 impacted tests pass |
| AI drawer applying open-action isolation | One red Store failure covers 100 replacement launches; the existing modal Alt+A boundary remains green, with 75 focused and 174 impacted tests passing |
| Story Kernel stable control selectors | Two red rendered contracts; source missing selectors 5 -> 0 and global 221 -> 216; 22 focused and 93 impacted tests pass |
| Pending-fact extraction preflight feedback | Two red rendered contracts; 100 preflight clicks start one request with immediate disabled feedback; source missing selectors 4 -> 0 and global 216 -> 212; 6 focused and 43 impacted tests pass |
| Manuscript extraction run single-flight | Two red pressure contracts; 100 starts and 99 stale-write failures become one shared run, one processor and zero rejected callers; 15 focused and 48 impacted tests pass |
| Manuscript extraction early Stop | Four red timing contracts; immediate/source/provider-preflight Stop starts zero processors or native AI jobs, while 100 Stop actions invoke one runner Stop; 21 focused and 58 impacted tests pass |
| Global Create menu lifecycle | Four red failures cover 100 chooser actions, focus-origin corruption, already-open Chapter focus and static inventory; one action per explicit open, stable Escape return and 7/7 mapped source controls pass 18 focused and 73 impacted tests |
| Chapter creation lifecycle | Five red failures cover 100 rendered submits/dismissals, 100 native transactions behind one dirty save, stale project identity and collapsed controls; mutually exclusive dialog/Store transitions and 6/6 mapped controls pass 16 focused and 102 impacted tests |
| QA inventory composite-control boundary | One red integration contract; 16 false controls, 352 synthetic states and 16 false selector findings removed; 16 focused tests pass |
| Creation Journey stable controls | Two red contracts; source 22 controls (8 mapped / 14 missing) becomes 38/38 mapped; 64 journey and 17 QA-script tests pass without React stderr |
| Ledger/inventory reconciliation | 993 / 993 cases; 914 frontend + 79 native; 991 passed + 2 reasoned skips; stale ledgers fail closed |
| Reported malformed relationship boundary | Initial 4 files / 80 tests; continuation 2 files / 41 tests passed |
| All-type Story Kernel mutation matrix | 3 files / 52 tests passed; 1 valid control and 11 quarantined mutations |
| Node 24 frontend acceptance | ESLint, TypeScript, 181 files / 914 tests and production build passed |
| Static/runtime test reconciliation | 914 / 914; 97 parameterized instances; difference 0; unresolved parameterization 0 |
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

- Strict traceability remains `REGRESSION_INCOMPLETE`: 10,161 aggregate mappings
  are open and 182 interactive declarations lack stable selectors. The mapping
  total rose because 16 previously collapsed Creation Journey controls and 352
  derived states are now represented honestly; none was marked covered without
  explicit evidence.
- The production Monaco chunk is 3,287.13 kB before gzip and remains above the
  configured 3,000 kB warning boundary.
- Rust emitted two localized MSVC linker-output warnings while producing test
  libraries; tests and formatting passed.
- Real-provider AI smoke, installer/portable packaging, and release approval did
  not run in this convergence cycle.

## 2026-08-04 addendum — defect 054

- Exact `data-testid` evidence is now retained and conservatively mapped with
  same-page, same-feature and state-intent requirements.
- Event Inspector exposes 7/7 stable controls and deduplicates 100 same-frame
  save or close actions to one transition; rejected saves are visible and
  retryable.
- Fixed-commit execution passed 958 frontend and 77 native tests; two native
  cases retain documented reasons. Traceability gaps fell from 11,108 to 10,489
  and stable-selector gaps from 134 to 130.
- Release remains blocked: strict traceability is incomplete, and real-provider
  plus packaged-EXE acceptance have not run.

## 2026-08-04 addendum — defect 055

- Relationship Inspector now exposes 4/4 stable controls, reduces 100
  same-frame Save actions to one, localizes failure feedback and permits retry.
- Authoritative relationship revision changes reconstruct the mounted draft;
  the next successful edit uses revision one rather than the stale revision
  zero.
- Fixed-commit execution passed 964 frontend and 77 native tests; two native
  cases retain documented reasons. Traceability gaps fell from 10,489 to 10,418
  and stable-selector gaps from 130 to 126.
- Release remains blocked by strict traceability, real-provider smoke and
  packaged-EXE acceptance.

## 2026-08-05 addendum — defect 056

- Story Association now maps 9/9 controls and reduces 100 same-frame
  confirmations to one persistence call while locking cancellation during the
  write and preserving explicit failure retry.
- Loader failures are localized and retryable; 100 retry actions share one
  request, and late results from a superseded project cannot replace the active
  project's data or feedback.
- The full baseline exposed and closed one low-opacity disabled-state visual
  regression before acceptance. Fixed-commit execution passed 970 frontend and
  77 native tests; two native cases retain documented reasons.
- Traceability gaps fell from 10,418 to 10,410 and stable-selector gaps from 126
  to 122 despite six new tests, two new control declarations and 44 new states.
- Release remains blocked by strict traceability, real-provider smoke and
  packaged-EXE acceptance.

## 2026-08-05 addendum — defect 057

- Character AI now exposes 8/8 stable control declarations while preserving the
  existing one-request result under 100 same-frame Generate actions.
- Unknown snapshot, repository and state-store failures no longer expose raw
  paths or persistence details. A rejected candidate remains retryable with its
  field selection intact and can succeed without another paid generation.
- Fixed-commit execution passed 972 frontend and 77 native tests; two native
  cases retain documented reasons. QA infrastructure passed 29/29.
- Traceability gaps fell from 10,410 to 10,379 and stable-selector gaps from 122
  to 118 despite two new tests, one new control declaration and 22 new states.
- Release remains blocked by strict traceability, real-provider smoke and
  packaged-EXE acceptance.

## 2026-08-05 addendum — defect 058

- Item AI now exposes 10/10 stable control declarations while preserving the
  existing one-request result under 100 same-frame Generate actions.
- Malformed item output no longer displays internal schema codes and succeeds
  on explicit retry. Unknown candidate-write failures no longer expose raw
  paths; selected fields survive the retry without a second AI request.
- Ten rendered representative controls are visible, enabled and keyboard
  focusable. Field/state selection and both evidence actions are verified.
- Fixed-commit execution passed 975 frontend and 77 native tests; two native
  cases retain documented reasons. QA infrastructure passed 29/29.
- All three added product tests are strictly mapped; unmapped test cases remain
  flat at 906 rather than increasing through a duplicate QA meta-test.
- Traceability gaps fell from 10,379 to 10,286 and stable-selector gaps from 118
  to 114 despite three new tests, three new controls and 66 new states.
- Release remains blocked by strict traceability, real-provider smoke and
  packaged-EXE acceptance.

## 2026-08-05 addendum — defect 059

- Relationship AI now exposes 9/9 stable control declarations, including
  distinct source and target selectors, while preserving one provider request
  under 100 same-frame Generate actions.
- Malformed output no longer exposes Zod field paths and succeeds on explicit
  retry. Unknown candidate-write failures no longer expose raw snapshot or
  repository paths; the same candidate remains retryable without regeneration.
- Nine representative controls are visible, enabled and keyboard focusable;
  evidence opening is verified by pointer.
- Fixed-commit execution passed 978 frontend and 77 native tests; two native
  cases retain documented reasons. The impact set passed 79/79 and QA
  infrastructure passed 29/29.
- Mapped tests rose from 148 to 152. All three newly added product tests are
  mapped and one existing test gained a valid mapping, reducing unmapped tests
  from 906 to 905.
- Traceability gaps fell from 10,286 to 10,149 and stable-selector gaps from
  114 to 110 despite three new tests, two new controls and 44 new states.
- Release remains blocked by strict traceability, real-provider smoke and
  packaged-EXE acceptance.

## 2026-08-05 addendum — defect 060

- Whole-work consistency AI now exposes 7/7 stable control declarations:
  close, both scope tabs, chapter selection, instruction, Run and Stop.
- One hundred same-frame Run actions start one provider request and publish one
  atomic result set. One hundred Stop actions issue one cancellation command;
  further stops remain disabled while cancellation is pending.
- Selected mode caps at 12 chapters, releases the cap after deselection and
  keeps enabled controls keyboard focusable. A failed later batch persists no
  partial result and succeeds after an explicit full restart.
- Five red contracts converged to 19/19 focused and 86/86 impacted tests. The
  fixed product commit passed 978 frontend and 77 native tests; two native
  cases retain documented reasons. QA infrastructure passed 29/29.
- All four existing panel tests gained strict mappings without adding tests.
  Mapped tests rose from 152 to 156 and unmapped tests fell from 905 to 901.
- Traceability gaps fell from 10,149 to 10,086 and stable-selector gaps from
  110 to 106 despite two newly distinguished controls and 44 derived states.
- Release remains blocked by strict traceability, real-provider smoke and
  packaged-EXE acceptance.

## 2026-08-05 addendum - defect 061

- Selection rewrite now exposes 7/7 stable control declarations: Generate,
  editable draft, Accept all, Save note, Undo and the accessible Accept/Reject
  actions.
- One hundred same-frame Generate actions start one provider request; one
  hundred Stop actions issue one cancellation. Malformed output performs zero
  writes and leaves retry available.
- Unknown snapshot/persistence errors no longer expose private paths. A rejected
  write preserves the candidate and succeeds on explicit retry after two
  snapshot attempts without regeneration.
- Eight red assertions converged to 22/22 focused and 186/186 impacted tests.
  Fixed-source execution passed 978 frontend and 77 native tests; two native
  cases retain documented reasons. QA infrastructure passed 29/29.
- All seven existing selection-rewrite tests are mapped. Globally, mapped tests
  rose from 156 to 162 and unmapped tests fell from 901 to 895.
- Traceability gaps fell from 10,086 to 10,029 and stable-selector gaps from 106
  to 103 despite two newly distinguished controls and 44 derived states.
- Strict coverage is 19.39%, stable-selector coverage is 78.72%, test mapping
  is 15.33% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 062

- Manuscript continuation now exposes 7/7 stable control declarations,
  including distinct Generate, per-candidate Insert and Undo identities.
- One hundred Generate actions start one request. One hundred Insert actions
  start one snapshot and one insertion while the write is pending.
- Unknown snapshot errors no longer expose private paths. A failed write keeps
  the same candidate and succeeds on retry without a second generation.
- Exact mounted insertion content can be undone to the original manuscript.
  Malformed output performs zero writes and retains localized guidance.
- Traceability now prefers co-located product tests over selector-string QA
  meta-tests. All ten existing continuation tests are mapped.
- Six red assertions converged to 25/25 focused, 172/172 impacted and 29/29 QA
  infrastructure tests. Fixed-source execution passed 978 frontend and 77
  native tests; two native cases retain documented reasons.
- Traceability gaps fell from 10,029 to 9,960 and stable-selector gaps from 103
  to 101 despite one newly distinguished control and 22 derived states.
- Strict coverage is 20.10%, stable-selector coverage is 79.18%, test mapping
  is 15.70% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 063

- Character Center now exposes 6/6 stable and strictly mapped control
  declarations, including generated role filters, virtualized character rows,
  generated detail tabs and the previously untested search input.
- The existing rendered test performs search/filter/restore without adding
  test debt. All nine existing Character Center tests are strictly mapped.
- Reselecting the active character no longer opens a false discard prompt or
  clears a dirty draft. Selecting a different character still requires one
  confirmation and refusal preserves the edit.
- Role filters now expose a named accessibility group and pressed state.
- Three red assertions converged to 28/28 focused and 87/87 impacted tests.
  Fixed-source execution passed 978 frontend and 77 native tests; two native
  cases retain documented reasons. QA infrastructure passed 29/29.
- Traceability gaps fell from 9,960 to 9,841, selector gaps from 101 to 98 and
  unmapped tests from 891 to 888.
- Strict coverage is 21.05%, stable-selector coverage is 79.79%, test mapping
  is 15.99% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 064

- Entity Peek now exposes 5/5 stable and strictly mapped control declarations,
  including the dialog, generated overlap candidates and generated manuscript
  backlinks.
- Overlap options support ArrowUp, ArrowDown, Home and End focus movement, then
  native Enter confirmation. Pointer selection, dialog focus, root Enter,
  Escape and exact backlink jumping remain covered.
- Three red assertions converged to 17/17 focused, 38/38 manuscript-impact and
  29/29 QA infrastructure tests. Fixed-source execution passed 978 frontend
  and 77 native tests; two native cases retain documented reasons.
- Both existing component tests gained mappings without adding test debt.
  Mapped tests rose from 169 to 171 and unmapped tests fell from 888 to 886.
- Traceability gaps fell from 9,841 to 9,804 and selector gaps from 98 to 95.
  Against the earlier 11,088 / 136 reference, cumulative reductions are 1,284
  mappings and 41 selectors.
- Strict coverage is 21.35%, stable-selector coverage is 80.41%, test mapping
  is 16.18% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 065

- Selection Action Menu now exposes 7/7 stable and strictly mapped logical
  controls, including the AI disclosure and generated rewrite/resource actions.
- Opening the contextual menu focuses the first item. ArrowUp/ArrowDown wrap,
  Home/End move to the first/last item and Escape returns focus to the
  disclosure. Existing pointer workflows remain verified.
- Three red assertions converged to 17/17 focused, 50/50 manuscript/editor
  impact and 29/29 QA infrastructure tests. Fixed-source execution passed 978
  frontend and 77 native tests; two native cases retain documented reasons.
- Both existing component cases are mapped without adding test debt. Mapped
  tests rose from 171 to 172 and unmapped tests fell from 886 to 885.
- Inventory now exposes one previously collapsed control and 22 derived states.
  Net traceability gaps still fell from 9,804 to 9,786 and selector gaps from
  95 to 92. Against the earlier 11,088 / 136 reference, cumulative reductions
  are 1,302 mappings and 44 selectors.
- Strict coverage is 21.64%, stable-selector coverage is 81.07%, test mapping
  is 16.27% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 066

- The shared workspace Resize Handle now exposes one stable separator identity;
  all four existing pointer, layout, keyboard and reset cases are strictly
  mapped.
- Escape during an active drag restores the exact starting size, releases
  capture and global cursor state, and makes later movement from that pointer a
  no-op. Inverse horizontal/vertical clamping and other reset paths remain
  verified.
- The QA audit found 89 false keyboard-state mappings caused by matching `tab`
  inside `stable`. English keyboard tokens now require word boundaries, Chinese
  intent remains supported, and a dedicated meta-test prevents recurrence.
- Five red failures converged to 24/24 focused, 73/73 impacted and 30/30 QA
  infrastructure tests. Fixed-source execution passed 979 frontend and 77
  native tests; two native cases retain documented reasons.
- Stable-selector gaps fell from 92 to 91. Correcting the historical matcher
  rebases the prior aggregate from 9,786 to 9,875; this round then reduces the
  truthful gap count by 12 to 9,863. Mapped tests are 176/1,058.
- Strict coverage is 21.03%, stable-selector coverage is 81.28%, test mapping
  is 16.64% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 067

- Story Dashboard now catches synchronous loader throws and rejected Promises,
  exits its busy state and shows localized partial-data status without exposing
  private paths. Chapter, planning and review navigation remain usable.
- Creation journey, next-step and recent-chapter actions have distinct stable
  identities. The source inventory expands from two collapsed declarations to
  five real controls; all five are stable and strictly mapped.
- All six existing Dashboard cases gain strict mappings without adding test
  debt. Three red failures converged to 21/21 focused, 59/59 impacted and 30/30
  QA infrastructure tests.
- Fixed-source execution passed 979 frontend and 77 native tests; two native
  cases retain documented reasons, and production build passed.
- The honest inventory adds 3 controls and 66 states while valid mappings grow
  by 75. Strict gaps fall from 9,863 to 9,857, selector gaps from 91 to 90 and
  unmapped tests from 882 to 876.
- Strict coverage is 21.51%, stable-selector coverage is 81.60%, test mapping
  is 17.20% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 068

- Close protection now exposes six distinct stable author actions: icon
  cancel, continue writing, resolve conflict, save copy, discard and save-and-
  exit. Their accessible Chinese names remain unchanged.
- Cancel, continue writing and conflict resolution dismiss safely without
  exit. Explicit discard exits once. One hundred same-frame save-and-exit
  clicks perform one atomic manuscript write and one exit; one hundred save-
  copy clicks open one native dialog and exit once.
- Four red failures converged to 18/18 focused, 79/79 impacted and 30/30 QA
  infrastructure tests. Fixed-source execution passed 979 frontend and 77
  native tests, retained two reasoned native ignores, and passed production
  build.
- The source inventory expands honestly from 3 collapsed declarations to 6
  controls and adds 66 states. All 6 controls, 91 source states and all 3
  existing product tests are strictly mapped without adding test debt.
- Global mapped states rise by 96. Strict gaps fall from 9,857 to 9,822,
  selector gaps from 90 to 89 and unmapped tests from 876 to 874.
- Strict coverage is 22.21%, stable-selector coverage is 81.91%, test mapping
  is 17.39% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 069

- Project-open recovery now exposes seven distinct stable author actions:
  copy safe path, retry, read-only open, repair, open directory, diagnostics
  and close. Their accessible Chinese names remain unchanged.
- One hundred same-frame copy actions produce one clipboard write. Clipboard
  denial is caught as localized, public-safe feedback; explicit retry remains
  available and successful copying announces completion.
- Three red failures converged to 17/17 focused, 49/49 impacted and 30/30 QA
  infrastructure tests. Fixed-source sequential execution passed 979 frontend
  and 77 native tests, retained two reasoned native ignores, and passed the
  production build.
- The initial concurrent gate received Windows exit `3221226505` in ESLint.
  It is classified as infrastructure resource contention, not product
  evidence; the isolated sequential rerun passed completely.
- The source inventory expands honestly from 4 collapsed declarations to 7
  controls and adds 66 states. All 7 controls, 77 source states and both
  existing product tests are strictly mapped without adding test debt.
- Global mapped states rise by 73. Strict gaps fall from 9,822 to 9,812,
  selector gaps from 89 to 88 and unmapped tests from 874 to 873.
- Strict coverage is 22.72%, stable-selector coverage is 82.22%, test mapping
  is 17.49% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 070

- Relationship graph character nodes, existing edges and AI candidate edges
  now expose distinct stable identities. The narrative-position input also has
  an explicit identity; accessible names and keyboard behavior remain intact.
- One hundred same-frame retries start one replacement read. Loader failures
  are localized without exposing private paths, and a late result from an
  older project cannot replace the latest graph or narrative position.
- Four red failures converged to 22/22 focused/inventory, 16/16 relationship-
  domain impact and 30/30 QA infrastructure tests. Fixed-source sequential
  execution passed 189 frontend files / 979 tests, production build and 77
  native tests with two reasoned ignores.
- The source inventory expands honestly from 6 collapsed declarations to 7
  controls and adds 22 states. All 7 controls, 93 source states and all 7
  existing product cases are strictly mapped without adding test debt.
- Global mapped states rise by 32. Strict gaps fall from 9,812 to 9,799,
  selector gaps from 88 to 86 and unmapped tests from 873 to 872.
- Strict coverage is 22.96%, stable-selector coverage is 82.66%, test mapping
  is 17.58% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 071

- Information search, filters, generated facts, narrative position and retry
  now expose five distinct stable identities with accessible Chinese names.
- One hundred same-frame retries start one replacement read. Loader failures
  are localized without exposing private paths, and a late result from an
  older project cannot replace the latest information, selection or narrative
  position.
- Two red failures converged to 16/16 focused/inventory, 2/2 information-domain
  impact and 30/30 QA infrastructure tests. Fixed-source sequential execution
  passed 189 frontend files / 979 tests, production build and 77 native tests
  with two reasoned ignores.
- The first frontend invocation reached its 120-second runner limit and exited
  124 without a product failure. The complete rerun passed in 222.9 seconds and
  is the only run recorded as acceptance evidence.
- The source inventory expands honestly from 3 collapsed declarations to 5
  controls and adds 44 states. All 5 controls, 50 of 110 source states and the
  only existing product case are strictly mapped without adding test debt.
- Global mapped states rise by 50. Strict gaps fall from 9,799 to 9,787,
  selector gaps from 86 to 83 and unmapped tests from 872 to 871.
- Strict coverage is 23.33%, stable-selector coverage is 83.33%, test mapping
  is 17.67% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 072

- Global, quiet-writer, planning/reference and focus top-bar variants now
  expose 16 distinct stable identities, including the More menu container.
- More focuses its first enabled item. ArrowUp/ArrowDown wrap, Home/End move to
  the edges, Escape closes with exact trigger-focus restoration, and an outside
  pointer action dismisses without activating a menu item.
- Five red failures converged to 5/5 focused/inventory, 51/51 Writer Workspace
  and shell impact, and 30/30 QA infrastructure tests. Fixed-source sequential
  execution passed 189 frontend files / 979 tests, production build and 77
  native tests with two reasoned ignores.
- The source inventory expands honestly from 6 collapsed declarations to 16
  controls and adds 220 states. Strictly mapped source controls rise from 2 to
  16 and source mapped states from 32 to 265.
- Global mapped controls rise by 14 and mapped states by 235. Strict gaps fall
  from 9,787 to 9,767, selector gaps from 83 to 79 and unmapped tests from 871
  to 870.
- Strict coverage is 24.84%, stable-selector coverage is 84.45%, test mapping
  is 17.77% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 073

- Quick Capture dialog, close, text, type and Save expose five stable
  identities while retaining accessible Chinese names.
- Ctrl+Enter and Save acquire one component-local synchronous guard before the
  Store busy update reaches React. One hundred actions through each entry point
  start one save; close cannot bypass the pending action, and a false result
  releases the guard for one explicit retry.
- Three existing Store cases now map loading, atomic persistence and concurrent-
  write failure to the Save control. No synthetic test or inventory debt was
  added.
- Three red failures converged to 20/20 focused/inventory, 38/38 Quick Capture
  and Writer Workspace impact and 30/30 QA infrastructure tests. Fixed-source
  sequential execution passed 189 frontend files / 979 tests, production build
  and 77 native tests with two reasoned ignores.
- All 5 source controls, 53 of 110 source states and all 5 product cases are
  strictly mapped. Global mapped controls rise by 4, mapped states by 46 and
  mapped tests by 3. Strict gaps fall from 9,767 to 9,714, selector gaps from
  79 to 76 and unmapped tests from 870 to 867.
- Strict coverage is 25.25%, stable-selector coverage is 85.04%, test mapping
  is 18.05% and release hard gates remain 1/4 complete.

## 2026-08-05 addendum - defect 074

- Item transfer Close, holder, location, quantity, narrative order and Confirm
  expose six distinct stable identities; equivalent inputs no longer collapse
  in the control inventory.
- One hundred same-frame Confirm actions start one persistence call. All mutable
  controls disable while pending, and Close plus Escape cannot dismiss the
  dialog before settlement.
- A rejected commit is caught, rendered as public Chinese retry guidance and
  releases the synchronous guard. The failure-first unhandled Promise and
  private path exposure are gone; one later explicit retry succeeds.
- Two red tests and one unhandled rejection converged to 16/16 focused/inventory,
  15/15 item/history impact and 30/30 QA infrastructure tests. Fixed-source
  sequential execution passed 189 frontend files / 979 tests, production build
  and 77 native tests with two reasoned ignores.
- Honest inventory expansion adds 2 controls and 44 states. All 6 source
  controls, 96 of 132 source states and the existing UI case map. Global mapped
  controls rise by 6, states by 96 and tests by 1.
- Strict gaps fall from 9,714 to 9,657, selector gaps from 76 to 75 and unmapped
  tests from 867 to 866. Strict coverage is 25.95%, stable-selector coverage is
  85.29%, test mapping is 18.15% and release hard gates remain 1/4 complete.
