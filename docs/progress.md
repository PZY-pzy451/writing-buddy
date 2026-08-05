# Current progress

Updated: 2026-08-06

## Active milestone

Character State and Character AI trace convergence is complete on
`codex/full-regression-gates-a-e-v2` against source `520f5db`.

- The narrative-order number input now exposes a stable identity. The rendered
  character workspace test clears and types a position with the keyboard, then
  verifies that the selected state heading refreshes to the new order.
- Existing Character AI service tests now map duplicate-candidate hiding,
  confirmed undo-snapshot persistence and authoritative-revision cancellation.
  The stale candidate contract also proves that no character write occurs.
  Focused character and inventory coverage passed 27/27.
- The existing same-tick Character AI generation guard passed 20/20 pressure
  rounds: 2,000 clicks produced exactly 20 provider starts.
- Node 24 passed lint, typecheck, 189 files / 979 tests and production build;
  Rust passed 77 with two reasoned ignores; QA infrastructure passed 30/30.
  Runtime/static discovery remains 979/979 and the 1,058-case ledger is `PASS`.
- Inventory remains 522 controls and 11,484 states. Mapped controls rise from
  363 to 364, mapped states from 3,969 to 4,017 and mapped tests from 255 to
  258. Strict gaps fall by 52 from 8,675 to 8,623, selector gaps from 23 to 22
  and unmapped tests from 803 to 800.
- Quantified status: deterministic execution is 100%; strict coverage is
  4,694/13,317 (35.25%); stable selectors are 500/522 (95.79%); test mapping is
  258/1,058 (24.39%). Against the 11,088 / 136 reference, 2,465 mapping gaps
  and 114 selector gaps are closed. Release gates remain 1/4 complete (25%), so
  the release distance is 8,623 strict mappings plus real-provider smoke and
  packaged-EXE acceptance. Product stays `PARTIAL`.

## Previous milestone

Relationship Matrix and Relationship AI trace convergence is complete against
source `96589ec`: one selector gap and six unmapped tests were closed, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

Timeline and Timeline AI selector/trace convergence is complete against source
`3bb67718`: five selector gaps and three unmapped tests were closed, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

Worldbuilding and World AI selector/trace convergence is complete against
source `7e6b527`: six selector gaps and four unmapped tests were closed, and
fixed acceptance passed 979 frontend tests.

## Previous milestone

Plot Board and Plot AI selector/trace convergence is complete against source
`0a893db`: ten controls and five product cases map, and fixed acceptance passed
979 frontend tests.

## Previous milestone

Settings and AI Playground selector/trace convergence is complete against
source `4901297`: three controls and one product case map, and fixed acceptance
passed 979 frontend tests.

## Previous milestone

Assistant Panel selector/trace convergence is complete against source `709b254`:
three controls and two product cases map, and fixed acceptance passed 979
frontend tests.

## Previous milestone

Project Welcome and Global Create selector/trace convergence is complete
against source `9d7e5f0`: three controls and four product cases map, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

AI settings and Project Wizard selector/trace convergence is complete against
source `93b3e56`: three controls and five product cases map, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

Genre start and Project Wizard selector/trace convergence is complete against
source `43d48282`: two controls and four product cases map, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

Inline plot expansion and Story Kernel trace convergence is complete against
source `e104ca94`: two controls and four product cases map, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

Inline language and chapter creation selector/trace convergence is complete
against source `f00835fe`: seven controls and two product cases map, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

Timeline reorder and continuity review selector/trace convergence is complete
against source `d6465ff`: five controls and three product cases map, and fixed
acceptance passed 979 frontend tests.

## Previous milestone

Context Pack and Scene Navigator selector/trace convergence is complete
against source `bd06ad6`: three repeated controls and all target product cases
map, and fixed acceptance passed 979 frontend tests.

## Previous milestone

AI context and manuscript highlight selector/trace convergence is complete
against source `921ecba`: two repeated controls and five product cases map,
and fixed acceptance passed 979 frontend tests.

## Previous milestone

Scene Plot Grid and virtual timeline selector/trace convergence is complete
against source `468d6b9`: six controls and five product cases are mapped, and
fixed acceptance passed 979 frontend tests.

## Earlier milestone

Daily Writing Goal form selector and trace convergence is complete against
source `a756c35`: all 3 controls and both product cases are mapped, and fixed
acceptance passed 979 frontend tests.

## Earlier milestone

Item transfer single-flight and selector convergence is complete against source
`c0d6f24`: all 6 controls and the existing product case are mapped, and fixed
acceptance passed 979 frontend tests.

## Earlier milestone

Quick Capture save and selector convergence is complete against source
`b63947c`: all 5 controls and product cases are mapped, and fixed acceptance
passed 979 frontend tests.

## Earlier milestone

Top-bar menu keyboard and selector convergence is complete against source
`db69fd0`: all 16 variant controls expose stable identities and complete
keyboard behavior, and fixed acceptance passed 979 frontend tests.

## Earlier milestone

Information control load recovery and selector convergence is complete against
source `79b8ab9`: 5/5 controls and its product case are mapped, and fixed
acceptance passed 979 frontend tests.

## Earlier milestone

Selection Action Menu control and keyboard convergence is complete against
source `60078b1`: 7/7 logical controls and 2/2 tests are mapped, and fixed
acceptance passed 978 frontend tests.

## Earlier milestone

Entity Peek control and keyboard convergence is complete against source
`509151b`: 5/5 controls and 2/2 tests are mapped, and fixed acceptance passed
978 frontend tests.

## Earlier milestone

Manuscript continuation control and write convergence is complete against
source `657abcf`: 7/7 controls are mapped and fixed acceptance passed 978
frontend tests.

## Earlier milestone: AI drawer Context Pack freeze

AI drawer Context Pack freeze is complete on
`codex/full-regression-gates-a-e-v2` against source `bc12ffd`.

- Optional context is now immutable through validation, queueing, connection,
  streaming, output validation and candidate application. Store guards remain
  authoritative even if a control event bypasses the disabled UI.
- Each state rejects 100 attempted toggles. Rendered controls expose the same
  six-state lock without presenting candidate application as cancellable work.
- Changing context after preview now clears the old raw/parsed output,
  transaction, usage and terminal job identity before allowing regeneration.
- Eight contracts failed red across the initial and applying-state audit. The
  three-file focused set passed 41/41, the ten-file impact set passed 137/137 and
  full Node 24 acceptance passed 179 files / 871 tests. Rust passed 77 with two
  reasoned ignores.
- The ledger contains 950 cases: 948 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,098 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

## Earlier milestone: AI drawer reopen cancellation

AI drawer reopen cancellation is complete on
`codex/full-regression-gates-a-e-v2` against source `b1bfd98`.

- Reopening quick actions while an explicit Stop was still pending now reuses
  the same per-job cancellation lock. One author intent cannot send two native
  cancellation commands for the same paid job.
- One hundred reopen actions cancel once, preserve the latest chapter context
  and discard old buffered/delayed output. Late cancellation success or failure
  cannot mutate the reopened drawer, which remains usable for a fresh request.
- Two success/failure contracts failed red. The repaired drawer suites passed
  25/25, the nine-file impact set passed 121/121 and full Node 24 acceptance
  passed 179 files / 858 tests. Rust passed 77 with two reasoned ignores.
- The ledger contains 937 cases: 935 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,088 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

## Earlier milestone: AI drawer close cancellation

AI drawer close cancellation is complete on
`codex/full-regression-gates-a-e-v2` against source `1403246`.

- Close button, Escape and backdrop dismissal now share the hardened reset
  boundary. Closing during validation or streaming invalidates the attempt and
  cancels its native job instead of leaving an invisible request running.
- One hundred repeated close actions issue exactly one cancellation. Job,
  Context Pack, input, output, transaction, errors and the pending 40 ms stream
  buffer are cleared; delayed events and cancellation failures remain hidden.
- Five contracts failed red. The repaired Store and rendered-dialog suites
  passed 22/22, the nine-file impact set passed 118/118 and full Node 24
  acceptance passed 179 files / 855 tests. Rust passed 77 with two reasoned
  ignores.
- The ledger contains 934 cases: 932 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,085 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

## Earlier milestone: AI drawer stale context

AI drawer stale-context isolation is complete on
`codex/full-regression-gates-a-e-v2` against source `9744d84`.

- The global AI quick-action drawer now binds project root, project ID, resource
  ID, path, Monaco model URI and revision. Same-revision project copies cannot
  keep an old preview valid.
- Source changes cancel one in-flight job across 100 notifications, ignore its
  delayed events, scrub old Context Pack/output and block retry until the author
  explicitly opens a fresh action from the current chapter.
- `reset()` now clears the full job/context/transaction state and its 40 ms
  stream buffer. One hundred resets cancel once and cannot revive old output.
- Six contracts failed red. The repaired Store suite passed 15/15, the nine-file
  impact set passed 113/113 and full Node 24 acceptance passed 179 files / 850
  tests. Rust passed 77 with two reasoned ignores.
- The ledger contains 929 cases: 927 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,087 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

## Earlier milestone: AI draft commit

AI draft commit resource isolation is complete on
`codex/full-regression-gates-a-e-v2` against source `711b35d`.

- AI temporary drafts now bind project root, project ID, resource ID, path,
  Monaco model URI, revision and anchored content. A candidate generated for a
  colliding copied project is hidden and cannot be applied in the new session.
- Save, snapshot and final persistence boundaries revalidate the exact target
  and mounted model. Failure rollback undoes the captured source model and never
  the replacement project's editor model.
- Four identity contracts failed red. The repaired candidate/card/rollback suite
  passed 11/11, the AI-draft/save/session/workspace impact set passed 98/98 and
  full Node 24 acceptance passed 179 files / 842 tests. Rust passed 77 with two
  reasoned ignores.
- The ledger contains 921 cases: 919 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,082 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

## Earlier milestone: project repair

Project-repair latest-intent convergence is complete on
`codex/full-regression-gates-a-e-v2` against source `0b6c733`.

- A delayed repair can no longer reopen its old project after the author chooses
  a newer target. Its late failure also cannot replace the latest project's
  state or actionable open error.
- Project repair and open share one monotonic author-intent version. Superseded
  repair completion clears only its own busy state, while 100 repeated Repair
  actions still produce one native repair.
- The red baseline failed exactly 3/15 project-open contracts. The repaired
  project-open suite passed 15/15 and the project-open/save/session/workspace/
  Story-resource impact set passed 92/92. Full Node 24 acceptance passed 178
  files / 837 tests; Rust passed 77 with two reasoned ignores.
- The ledger contains 916 cases: 914 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,077 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

## Earlier milestone: project open

Project-open latest-intent convergence is complete on
`codex/full-regression-gates-a-e-v2` against source `2b132b5`.

- One hundred repeated selections of the same project still produce one native
  open. If author intent changes while project A loads, the store retains one
  latest target, skips intermediate choices and leaves the latest project active.
- A failed or superseded open cannot expose stale project state or suppress the
  queued target. An accepted dirty-draft discard decision is reused once across
  the switch burst instead of prompting for every queued target.
- The focused project-open experience passed 12/12 and the project-open/save/
  session/workspace/Story-resource impact set passed 89/89. Full Node 24
  acceptance passed 178 files / 834 tests, lint, typecheck and production build;
  Rust passed 77 with two reasoned ignores.
- The ledger contains 913 cases: 911 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,074 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

## Earlier milestone: save lifecycle

Save retry and stale-result isolation are complete on
`codex/full-regression-gates-a-e-v2` against source `34ea0a94`.

- One hundred same-tick Save/Retry calls no longer become 100 hidden writes when
  the first write fails. Retryable, non-retryable and force-save failures stop
  after one operation and retain dirty prose until a new explicit action.
- A successful write with newer in-flight edits still performs one coalesced
  follow-up write, preserving the author's latest text without multiplying work.
- Late success, failure and external-conflict disk reads validate project root,
  project ID, resource ID, path and writer session, so switching to another
  project with colliding chapter IDs cannot corrupt its save state or baseline.
- The focused save suite passed 38/38 and the save/editor/session/workspace impact
  set passed 93/93. Full Node 24 acceptance passed 178 files / 829 tests, lint,
  typecheck and production build; Rust passed 77 with two reasoned ignores.
- The ledger contains 908 cases: 906 passes and two reasoned skips. Execution is
  `PASS`; product remains `PARTIAL` because 10,069 traceability mappings and 221
  stable selectors remain open, with real-provider and packaging gates unrun.

User-centered defect convergence is complete through the AI-draft undo
resource-isolation lifecycle on
`codex/full-regression-gates-a-e-v2` against source
`209db2938d28d6205d4168f6f46693b365cdd76a`.

- Closed the P0 Undo / Redo cross-resource boundary. The one-click AI-draft
  receipt now binds project, resource, Monaco model URI and committed content;
  switching identity dismisses it and 100 same-tick clicks perform one action.
- The old predicate failed three of four identity contracts. The repaired model
  and rendered banner passed 7/7; the editor/save/session/workspace/shortcut
  impact set passed 81/81. Failure feedback is localized and retryable.
- The first inventory pass caught a new missing stable selector caused by the
  dynamic undo label. A stable accessible name restored the global selector gap
  from 222 to 221 before the complete frontend rerun.

- Closed the P0 Monaco external-conflict lifecycle boundary. Disk verification
  and explicit overwrite are single-flight, discard stale project/resource/path
  results, serialize text entered during overwrite, and release after failure.
- The conflict dialog now keeps both versions after cancelled/failed save-copy
  and makes reload, copy, overwrite, cancel, close and Escape mutually exclusive
  while native work is pending. The red baseline failed 8/35; repaired focused
  and impacted runs passed 35/35 and 70/70.
- The 2026-08-04 full baseline passed 178 frontend files / 822 tests, lint,
  typecheck and production build. Rust collected 79, passed 77, failed 0 and
  retained two reasoned ignores. In-app browser control was attempted but its
  runtime failed before page control, so the live conflict journey is recorded
  as infrastructure-blocked rather than a product pass.

- Replaced regex test discovery with TypeScript AST discovery. The former
  49-case static/runtime difference is closed: 822 frontend cases are inventoried
  and 822 are collected, including 52 parameterized instances and zero unresolved
  parameterized declarations.
- Removed the Windows `shell: true` pnpm launch path. Node 24 acceptance now
  hard-fails engine, runtime-inventory and `DEP0190` differences; all are zero.
- Supported frontend acceptance passed ESLint, TypeScript, 178 Vitest files /
  822 tests and the production build. Rust formatting passed; Cargo collected
  79, passed 77 and retained two reasoned external-gate ignores.
- Added the exact malformed relationship boundary reported by the user as a
  deterministic scenario: one unselected `relationship` contains string
  `effectiveFrom` and `history` fields while three valid candidates remain
  usable. Parser/service/UI tests prove the malformed candidate is disabled and
  excluded from the one snapshot/one atomic commit.
- Tightened the TypeScript and Rust Story Kernel prompt contract to forbid
  unselected resource types and require object/array relationship shapes. The
  strict Schema still blocks semantically unsafe coercion instead of inventing
  chapter positions or relationship history.
- Recorded user stress passed two 100,661-character browser runs, 80 resizes,
  60 workspace transitions, five performance runs and 10 recovery cycles with
  zero unresolved backlinks. A separate 11-stage detail run also passed.
- The new relationship boundary passed 4 focused files / 80 tests; the wider
  Story Kernel, extraction, repeated-click, language-check and save/recovery
  suite remains covered by the full acceptance run.
- Follow-up relationship QA proves mixed valid/blocked selections fail before
  any write, quarantined diagnostics survive a full component reopen without a
  second AI request, and a maximum 24-candidate response can atomically write
  21 valid resources while isolating three malformed relationships. The focused
  continuation run passed 2 files / 41 tests.
- Added a deterministic all-type Schema mutation matrix: one valid control plus
  one explicitly wrong field for each of the 11 generatable Story Kernel types.
  Service and UI tests prove all malformed candidates remain visible, disabled
  and unwritable after reopen; the malformed relationship also receives the
  expected dependency block because it references a malformed character. The
  focused matrix run passed 3 files / 52 tests.
- Reproduced a confirmation reentrancy defect: 100 same-tick clicks started 100
  safety snapshots before React rendered its busy state. A synchronous action
  guard now covers both confirmation and rejection. Focused tests prove 100
  confirmation clicks produce one snapshot and one commit, 100 rejection clicks
  produce one state write, and a failed snapshot releases the guard for retry.
- Reproduced the adjacent cancellation defect: 100 same-tick stop clicks sent
  100 native cancellation commands. A dedicated synchronous guard now sends one
  command, exposes an explicit `正在取消` state, stays locked until a real stream
  terminal event, and releases for retry when the command fails or reports that
  the native job was not found. The focused panel suite passed 21 tests.
- Audited 13 adjacent user-facing AI cancellation paths. Selection rewrite also
  sent 100 native commands for 100 same-tick clicks, while manuscript extraction
  sent two native commands for one click. Ten direct controls now share one
  guarded cancellation contract; genre generation, whole-work consistency and
  extraction use equivalent locks around their composite stop behavior. Pending
  feedback, retry after command failure/job-not-found, stale-job isolation and
  unknown-error localization are deterministic. The focused 21-test cancellation
  suite and 32 impacted-page tests pass.
- Audited all 11 user-facing AI candidate-write surfaces. Nine adjacent surfaces
  that relied on React busy state now acquire synchronous, panel-wide write locks;
  Story Kernel and selection rewrite already use the same invariant. Deterministic
  continuation and outline tests prove 100 same-tick clicks create one snapshot
  and one write, disable cross-candidate writes, and release after failure for retry.
  The focused affected suite passed 9 files / 34 tests.
- Audited 11 user-facing AI generation surfaces. Character, AI Playground,
  generic drawer and chapter review each reproduced 100 requests from 100
  same-tick actions. Synchronous guards now cover every audited surface, request-
  defining inputs remain locked while active, and ten dynamic pressure scenarios
  produce one request with zero implicit cancellations. Unknown provider errors
  are redacted and explicit retry succeeds. The generation suite passed 12 files /
  45 tests.
- Added the same synchronous accept/reject invariant to pending facts. Its
  100-click acceptance contract produces one persistence write; the full
  pending-fact suite passed 4 tests.
- Closed the remaining store-level cancellation/result-ordering race in AI
  Playground, the generic AI drawer and chapter review. Each reproduced 100
  native cancellations for 100 same-tick actions. They now issue one command,
  ignore late results from old jobs, prevent provider/context validation from
  crossing into a newly opened chapter action, localize command failures and
  clear obsolete errors after explicit retry. The focused suite passed 3 files /
  27 tests.
- Closed the AI settings and credential-lifecycle reentrancy boundary. Key save,
  connection test, model refresh, balance refresh and active-job deletion each
  reproduced 100 bridge calls from 100 same-tick actions. A synchronous
  single-flight now reduces each to one, queues different actions without false
  success, blocks generation during credential mutation and leaves deletion
  failures explicitly retryable. Preference writes are serialized and coalesced
  so the latest author choice is persisted last; a final failure restores the
  last genuinely persisted value. The focused AI experience suite passed 22 tests.
- Real browser QA found stale action feedback after a successful credential save:
  a later connection test still showed the old save message, while model and
  balance refreshes had no explicit completion message. Each manual action now
  replaces stale copy with its own success/failure outcome; provider failures
  propagate to the UI for localized recovery. Desktop, 620 px and 420 px checks
  passed without horizontal overflow or browser console warnings/errors.
- The full self-test and full-regression runners no longer fall back to Windows
  `pnpm.cmd` with `shell: true` when launched directly through Node. Both resolve
  pnpm's JavaScript entry and execute it with the current Node 24 runtime; absence
  of a safe entry fails closed. Three command-resolution tests pass, and the
  repeated full self-test emits zero `DEP0190` warnings.
- Project switching now has store-owned single-flight guards for the directory
  chooser and open lifecycle. Five 100-action pressure boundaries each perform
  one chooser/open/confirmation/repair/reveal; cancelling a dirty switch performs
  zero bridge opens and preserves the draft, while acceptance opens once. Live
  desktop, 620 px and 420 px switching remained stable with no overflow or
  browser warnings/errors.
- Chapter and resource opening now use a store-owned latest-intent queue. Six
  deterministic contracts cover 100 repeated actions, dirty manuscript saves,
  save/read failures, delayed reads and edits typed during loading. A target
  commits only after its read succeeds; late reads cannot pair stale text with a
  newer active chapter. Live desktop and 420 px switching preserved the draft,
  kept heading/tab/editor content aligned and emitted zero browser errors.
- Chapter and resource closing now uses a per-resource synchronous lock. Eight
  contracts cover repeated confirmation, explicit discard, save-copy exit,
  failure/retry and background-tab isolation. Discard performs zero writes,
  failed next reads cannot leave a closed resource active, and 100 save-copy
  actions share one native dialog. Live close/restore recovered the original
  94-character chapter and kept the selected tab aligned at 420 px with no
  overflow or browser warnings/errors.
- The current inventory contains 901 tests: 822 frontend plus 79 native cases.
  The latest execution ledger records 899 passes and two reasoned skips. Static
  and runtime frontend inventories both contain 822 cases with zero difference.
- The final evidence audit caught a stale-ledger gap: inventory/runtime contained
  the two new settings cases, but the ledger still had the previous 848 entries.
  `qa:plan` now reconciles all 901 cases before recording, and convergence fails
  closed unless total, frontend and native ledger counts match inventory/runtime.
- Strict traceability remains fail-closed: 221 controls lack stable selectors
  and 10,063 aggregate mappings remain open. The truthful product conclusion is
  `PARTIAL`; no real-provider smoke or release package ran.
- Evidence: `docs/qa/001-defect-convergence-2026-08-03.md` and
  `artifacts/qa/current-convergence-report.json`.

## Previous active milestone

Story extraction actionability and adjacent usability convergence are complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Project chapter IDs are canonicalized through the complete fact-extraction
  lifecycle. Bounded response repair remains strict at the final schema gate.
- Empty/oversized input, rapid clicks, malformed AI responses, successful empty
  results and accept/reject conflicts now have deterministic author-facing behavior.
- The wider selection-action audit covers five resource types, quick capture,
  existing-resource linking and contextual AI without exposing internal errors.
- The clean run against `876485c` passed 26/26 steps in 590,101 ms: 168 Vitest
  files / 701 tests, 77 Rust tests, 19 browser journeys, performance/recovery,
  complete novel, native gates and portable smoke.
- The final user-detail journey passed a 100,661-character manuscript, 40
  resizes, 30 workspace transitions, three reloads, fact extraction/acceptance
  and compact full-view audits with no raw errors.
- Production portable SHA-256 is
  `B302F18FEE0FCE0D24E96781E22D08196DB0820485E8FE72F4356A92221076BF`.
- Delivery: `artifacts/release/full-regression-2026-08-02/876485c9/`; evidence:
  `docs/acceptance/078-story-extraction-actionability-2026-08-03.md`.

## Previous milestones

Story Kernel character-role repair and final regression are complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Recognized English and Chinese character-role aliases normalize to the four
  canonical Story Kernel values. Unknown optional text is omitted, non-text
  corruption remains blocked, and persisted candidates are repaired on load.
- TypeScript/native prompt parity and 71 focused parser/service tests cover new,
  confirmed and previously persisted candidates.
- Evidence:
  `docs/acceptance/077-story-kernel-character-role-repair-2026-08-03.md`.

Phase 1.2S user-centered detail and stress testing is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- The author-detail gate covers first-time, returning, long-form, keyboard,
  compact-screen and interrupted use across Writing, Planning, all Story Library
  views, Check, History, Settings and quick capture.
- The clean run against `3342ca4` passed all 26 recorded steps; stress covered
  large manuscripts, resizes, workspace transitions, recovery and portable launches.
- Evidence:
  `docs/acceptance/076-phase-1.2s-user-centered-detail-stress-2026-08-02.md`.

Phase 1.2R full regression and bug convergence is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- One `pnpm acceptance:full-regression` command covers source, Rust,
  performance, browser journeys, isolated native journeys, a complete novel,
  recovery, production packaging and portable smoke with a machine-readable
  aggregate report.
- Product fixes repositioned the compact daily-goal popover and made the
  timeline own its intended horizontal overflow. Acceptance hard-fails clipping,
  follows the current information architecture and waits for real reload events.
- Its clean run against `f969512` passed all 25 recorded steps in 653,272 ms.
- Evidence:
  `docs/acceptance/075-phase-1.2r-full-regression-bug-convergence-2026-08-02.md`.

Phase 1.2Q author-confirmed release candidate is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Check separates exact export freshness from the author's final release
  decision. Only an exact current receipt can be explicitly confirmed.
- Confirmation is project-scoped, locally persisted and reversible. History
  shows the active candidate and timestamp; source changes make it visibly stale.
- Eight Edge/CDP captures pass without page overflow, clipping, short scoped
  controls, occlusion or runtime errors.
- Delivery:
  `artifacts/release/phase-1.2q-author-confirmed-release-2026-08-02/`; evidence:
  `docs/acceptance/074-phase-1.2q-author-confirmed-release-2026-08-02.md`.

Phase 1.2P verifiable delivery freshness is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Whole-work export receipts fingerprint the manifest revision and ordered
  chapter paths/file hashes, so equal-word-count rewrites cannot remain current.
- Check performs a live read-only inspection; old, malformed, dirty, stale or
  unavailable evidence cannot silently pass publication readiness.
- Delivery:
  `artifacts/release/phase-1.2p-delivery-freshness-2026-08-02/`; evidence:
  `docs/acceptance/073-phase-1.2p-verifiable-delivery-freshness-2026-08-02.md`.

Phase 1.2O chapter lifecycle is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- The writing header now exposes one explicit, reversible
  `初稿 / 修订中 / 已完成` control, while read-only projects retain a truthful
  status label without an edit action.
- Dirty prose saves first; the native command changes only the manifest through
  revision checking, atomic write, reopen verification and exact-byte rollback.
- Six Edge/CDP captures at 1440×900, 1024×720 and 820×720 pass with no page
  overflow, clipping, sub-44 px status controls, occlusion or runtime errors.
- Final gates: 167 Vitest files / 682 tests, production Vite build, Cargo format,
  76 Rust tests / 2 ignored, full and release self-tests, Tauri Release/NSIS and
  portable PID 24568 title/WebView/no-debug-port/normal-close smoke.
- Delivery: `artifacts/release/phase-1.2o-chapter-lifecycle-2026-08-02/`;
  evidence: `docs/acceptance/072-phase-1.2o-chapter-lifecycle-2026-08-02.md`.

Phase 1.2N publish readiness is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Check now contains a local, explainable publication gate covering manuscript
  presence, safe saves, chapter completion, project integrity, unresolved review
  issues and whole-work delivery receipts.
- Blockers, author decisions and passed checks are text-labelled; actions route
  to save, the exact chapter/evidence, Planning, consistency review or History.
- Receipt matching is deliberately limited to chapter-count and word-count scale
  evidence and never claims byte-identical or full-AI verification.
- Six responsive captures pass with no page overflow, clipping, sub-44 px
  publish controls, occlusion or runtime errors; the 820 px checklist is single-column.
- Final gates: 167 Vitest files / 679 tests, production Vite build, Cargo format,
  74 Rust tests / 2 ignored, full self-test, Tauri Release/NSIS and portable
  title/WebView/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2n-publish-readiness-2026-08-02/`;
  evidence:
  `docs/acceptance/071-phase-1.2n-publish-readiness-2026-08-02.md`.

Phase 1.2M scene-linked plot grid is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- The Planning plot workspace now maps real Story Kernel scenes as rows and real
  plot threads as columns without creating or migrating project data.
- Search and task filters expose unlinked scenes, missing scene beats and
  reciprocal, one-sided or dangling associations instead of hiding data damage.
- Scene detail shows goal, conflict, turn and outcome and opens the exact
  manuscript range through the existing evidence-navigation contract.
- Narrow layouts show the full grid first and switch to a closable detail view,
  preventing background controls from remaining focusable under an overlay.
- Five responsive captures pass with no page overflow, clipping, sub-44 px
  controls, occlusion or runtime errors; 820 px uses only internal grid scrolling.
- Final gates: 166 Vitest files / 670 tests, production Vite build, Cargo format,
  74 Rust tests / 2 ignored, full self-test, Tauri Release/NSIS and portable
  title/WebView/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2m-scene-plot-grid-2026-08-02/`;
  evidence:
  `docs/acceptance/070-phase-1.2m-scene-linked-plot-grid-2026-08-02.md`.

Phase 1.2L whole-work consistency pass is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- The primary Check page now opens the grounded full-work consistency task
  directly; the compatibility Planning route remains available.
- Saved, non-empty chapters are covered in ordered batches under the unchanged
  2–12 source / 160,000-character native contract. Boundary chapters overlap
  when possible, and unsafe or excessive plans fail before the first AI call.
- Multi-batch findings remain in memory until every request succeeds. Stop or
  failure preserves existing results; success deduplicates and hands off once.
- A synchronous run guard plus separate Stop control prevents rapid repeated AI
  clicks. Five responsive captures pass with no overflow, clipping, sub-44 px
  controls, occlusion, covered panel edge or runtime errors.
- Final gates: 165 Vitest files / 667 tests, production Vite build, Cargo format,
  74 Rust tests / 2 ignored, full self-test, Tauri Release/NSIS and portable
  title/WebView/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2l-whole-work-consistency-2026-08-02/`;
  evidence:
  `docs/acceptance/069-phase-1.2l-whole-work-consistency-2026-08-02.md`.

Phase 1.2K daily writing progress is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Project-scoped daily goals and a bounded local-day ledger now persist on the
  current machine without changing project files.
- The editor counts signed net manuscript word changes. Existing/imported prose
  does not inflate progress, and undo or failed AI rollback reverses credit.
- Writing Home, the chapter header and the status bar share one progress source;
  goal editing is a keyboard-usable secondary disclosure with inline validation.
- Browser acceptance proved goal and word progress across two application
  reloads. Four responsive views pass with no overflow, clipping, sub-44 px
  controls, disclosure occlusion or runtime errors.
- Final gates: 164 Vitest files / 659 tests, production Vite build, Cargo format,
  74 Rust tests / 2 ignored, full self-test, Tauri Release/NSIS and portable
  title/WebView/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2k-daily-writing-progress-2026-08-02/`;
  evidence:
  `docs/acceptance/068-phase-1.2k-daily-writing-progress-2026-08-02.md`.

Phase 1.2J Word interoperability is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Native Word import accepts bounded `.docx` archives, extracts visible body
  text without AI rewriting and rejects encrypted, malformed, empty, oversized
  or structurally invalid packages before project creation.
- The import review states which Word features are intentionally not preserved.
  Manuscript text enters the first chapter; explicit Word outline headings reuse
  the deterministic chapter analyzer and atomic staging/reopen/rename flow.
- History now leads with one `导出 Word 文档` action. Structured OOXML preserves
  work, volume and chapter hierarchy, escapes author text and strips internal
  scene anchors; Markdown/plain text remain secondary exports.
- Cancellation and dirty-save failures produce neither a file nor a false
  receipt. Successful Word deliveries use the existing durable receipt model.
- Four responsive Edge/CDP views pass with no page overflow, clipped controls,
  sub-44 px History actions or runtime errors.
- Final gates: 162 Vitest files / 651 tests, production Vite build, Cargo format,
  74 Rust tests / 2 ignored, full self-test, Tauri Release/NSIS and portable
  title/WebView/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2j-word-interoperability-2026-08-02/`;
  evidence:
  `docs/acceptance/067-phase-1.2j-word-interoperability-2026-08-02.md`.

Phase 1.2I safe local outline and manuscript import is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Welcome-page outline/manuscript imports now select real local Markdown/text
  files, show a deterministic preview and require confirmation before writing.
- Manuscript text is preserved exactly in the first chapter. Outline imports
  materialize explicit headings as chapters and retain the exact original file
  under `.writing-buddy/imports/` without any AI call.
- Native validation bounds format, UTF-8, binary content, file size and chapter
  count. The complete import participates in staging, reopen verification and
  atomic rename, so failure leaves no partial target project.
- Browser review moved the active import task above unrelated starts and fixed
  retained scroll position between wizard steps. 1440×900 and 820×720 pass
  without horizontal overflow or sub-44 px import controls.
- Final gates: 162 Vitest files / 648 tests, production Vite build, Cargo format,
  71 Rust tests / 2 ignored, full self-test, Tauri Release/NSIS and portable
  title/WebView/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2i-safe-draft-import-2026-08-01/`;
  evidence:
  `docs/acceptance/066-phase-1.2i-safe-local-draft-import-2026-08-01.md`.

Phase 1.2H whole-work export and backup trust center is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- `历史与导出` leads with whole-work Markdown/plain-text export in canonical
  project order while current-chapter export remains secondary.
- Export receipts distinguish work/chapter scope, and History exposes the
  inspected, confirmed `.wbbackup` workflow.
- Final gates: 161 Vitest files / 643 tests, production Vite build, Cargo format,
  68 Rust tests / 2 ignored, Tauri Release/NSIS and native portable smoke.
- Delivery:
  `artifacts/release/phase-1.2h-whole-work-export-backup-2026-08-01/`;
  evidence:
  `docs/acceptance/065-phase-1.2h-whole-work-export-backup-2026-08-01.md`.

Phase 1.2G chapter completion and export trust is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- The author can export the active chapter as Markdown from the chapter menu or
  choose Markdown/plain text from `历史与导出`.
- Dirty-save failure and dialog cancellation are fail-before-write: they create
  neither a copy nor a false export receipt.
- Successful exports persist a project-scoped receipt with chapter, format,
  word count, timestamp and exact destination. Snapshot/restore remains intact.
- The extended chapter menu is viewport-bounded and scrollable. Browser
  acceptance passed at 1440×900, 1280×800, 1024×720 and 820×720 with no page
  overflow, clipped controls or runtime errors.
- Final gates: 161 Vitest files / 639 tests, production Vite build, Cargo format,
  68 Rust tests / 2 ignored, Tauri Release/NSIS and portable title/WebView/
  no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2g-chapter-export-trust-2026-08-01/`; evidence:
  `docs/acceptance/064-phase-1.2g-chapter-export-trust-2026-08-01.md`.

Phase 1.2F task-to-action closure is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Check now begins with a project task inbox and can directly open the first
  affected or available chapter. Running local or AI review remains a separate
  author action.
- The global New menu no longer contains permanently disabled future entries.
  Structure, plot/foreshadowing, character, world, item and timeline intents
  route into existing planning or Story Library workflows.
- Contextual entity actions open the relevant assistant but perform no AI call,
  snapshot or project write until the author explicitly acts and confirms.
- Responsive browser acceptance passed at 1440×900, 1280×800, 1024×720 and
  820×720 with no page overflow, clipped controls or runtime errors.
- Final gates: 160 Vitest files / 633 tests, production Vite build, Cargo
  format, 68 Rust tests / 2 ignored, Tauri Release/NSIS and native portable
  responsive/title/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2f-task-to-action-closure-2026-07-31/`;
  evidence:
  `docs/acceptance/063-phase-1.2f-task-to-action-closure-2026-07-31.md`.

Phase 1.2E market-oriented feature hierarchy is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- The product now presents five primary author destinations only: Writing,
  Planning, Story Library, Check and History. Settings, Quick Capture and AI
  diagnostics remain compatible global actions behind More.
- New-project onboarding has one primary genre-to-outline action plus three
  secondary starts. Existing-project home is task-led rather than a module
  dashboard.
- Planning and Story Library are separate, keyboard-usable spaces. The writing
  sidebar is structure-only and the contextual writer rail is exactly four
  tools: outline, references, AI and check.
- Stage-aware presentation keeps irrelevant long-form tools quiet without
  deleting routes or migrating project data.
- Final gates: exact-browser UI checks at 1440×900 and 1024×720, ESLint,
  TypeScript, 160 Vitest files / 629 tests, production Vite build, Cargo
  format, 68 Rust tests / 2 ignored, Tauri Release/NSIS and production portable
  responsive/title/WebView/no-debug-port/normal-close smoke.
- Delivery:
  `artifacts/release/phase-1.2e-market-oriented-hierarchy-2026-07-31/`;
  evidence:
  `docs/acceptance/062-phase-1.2e-market-oriented-feature-hierarchy-2026-07-31.md`.

Story Kernel persisted candidate recovery is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Pending `create` candidates saved by an older build now receive the same
  conservative structural defaults as new AI responses when they reopen.
- Recovery is local and deterministic: it performs no new AI call, invents no
  author content, and does not write project Story resources before approval.
- Only the stale structural-schema conflict is removed after successful strict
  hydration. Explicit wrong types and all unrelated conflicts remain blocked.
- A visible UI regression reopens `旧批次蓝色信封`, confirms generation was
  not called, then proves snapshot-before-write still protects confirmation.
- Final gates: ESLint, TypeScript, 158 Vitest files / 625 tests, production
  Vite build, Cargo format, 68 Rust tests / 2 ignored, Tauri Release/NSIS and
  production portable responsive/title/no-debug-port smoke.
- Delivery:
  `artifacts/release/story-kernel-persisted-candidate-recovery-2026-07-31/`;
  evidence:
  `docs/acceptance/061-story-kernel-persisted-candidate-recovery-2026-07-31.md`.

Story Kernel structural defaults repair is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Item candidates that omit `unique` and `restrictions` now use conservative
  local defaults (`false` and `[]`) and remain confirmable.
- Explicit item semantics are preserved, while wrong explicit types remain
  blocked by the strict Story Kernel schema.
- Neutral missing arrays for generated scenes and timeline events are safely
  normalized without inventing IDs, positions or story facts.
- The TypeScript and native Rust prompts explicitly require item defaults.
- A visible UI integration regression reproduces `蓝色信封`, confirms the
  checkbox is enabled, creates the safety snapshot and writes the normalized
  resource.
- Final gates: ESLint, TypeScript, 158 Vitest files / 622 tests, production
  Vite build, Cargo format, 68 Rust tests / 2 ignored, Tauri Release/NSIS and
  production portable responsive/title/normal-close smoke.
- Delivery: `artifacts/release/story-kernel-structural-repair-2026-07-31/`;
  evidence:
  `docs/acceptance/060-story-kernel-structural-defaults-2026-07-31.md`.

Empty-chapter drafting and the polished zero-to-complete-novel promotion are
complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Scaffold-only materialized chapters now open the first confirmed scene as an
  AI opening-draft target instead of showing a false no-prose continuation
  error. Truly empty, unplanned chapters receive calm guidance.
- The author-control boundary remains explicit: generation creates one
  editable temporary draft; only confirmation writes it and creates the safety
  snapshot.
- Real interface acceptance passed with the cursor at the start of a
  scaffold-only chapter, correct grounded context, the visible
  `确认资料并生成开篇` action and zero console warnings/errors.
- New public cut: 1:42, 2560×1440, H.264 High, 24 fps, Chinese AAC narration,
  burned captions and standalone SRT. It starts with the completed outcome,
  then shows the true empty-project-to-three-chapter workflow and ends on the
  resolved 3-chapter / 26,210-character dashboard.
- Final gates: Node 24.14.0, ESLint, TypeScript, 158 Vitest files / 618 tests,
  production Vite build, Cargo format, 68 Rust tests / 2 ignored, Tauri
  Release/NSIS, production portable responsive/title/normal-close smoke and
  zero diagnostic WebView ports.
- Delivery:
  `artifacts/release/empty-chapter-promo-polish-2026-07-31/`; video:
  `artifacts/promo/zero-to-complete-novel-polished-2026-07-31/`; evidence:
  `docs/acceptance/059-empty-chapter-drafting-promo-polish-2026-07-31.md`.

The zero-to-complete-novel promotional recording is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Replaced the previous already-complete-project demo with a real desktop
  journey that begins on the empty welcome screen before the target directory
  exists.
- Created `《零点回声》` through Writing Buddy, generated and confirmed an
  editable outline, materialized 1 volume / 3 chapters / 6 scenes, combined
  direct author writing with three reviewed AI drafts, and explicitly wrote
  each candidate into the manuscript.
- Independently audited the final native files: 3 chapters, 6 scene anchors
  and 30,441 non-whitespace characters. The completed dashboard shows 3
  chapters and 26,210 author-facing characters.
- Accepted promotional cut: 2:44, 2560×1440, H.264 High, 24 fps, burned
  Chinese captions and separate SRT/ASS. Full decode and representative-frame
  review passed.
- Added reproducible recording, diagnostic fixture and compositor scripts.
  The compositor now uses an exclusive lock and PID-scoped temporary output
  after concurrent ffmpeg output corruption was diagnosed.
- Validation: Node 24.14.0, ESLint, TypeScript, 157 Vitest files / 613 tests,
  production Vite build, Cargo format, 68 Rust tests / 2 ignored, Tauri
  Release/NSIS, production portable responsive/title/normal-close smoke and
  no diagnostic port 9223.
- Delivery:
  `artifacts/promo/zero-to-complete-novel-2026-07-31/`; Windows binaries:
  `artifacts/release/zero-to-complete-novel-promo-2026-07-31/`; evidence:
  `docs/acceptance/058-zero-to-complete-novel-promotional-recording-2026-07-31.md`.

The AI-generated manuscript response repair is complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Continuation, three directions, inline Tab expansion and selection rewrite
  now repair bounded JSON fences, known wrappers and explicit equivalent field
  names before creating an author-reviewed inline draft.
- Story Kernel generation accepts the same pure transport variations without
  weakening resource schemas or atomic confirmation.
- Malformed or empty prose is localized and blocked with zero snapshot,
  manuscript apply or repository writes.
- Validation: ESLint, TypeScript, 157 Vitest files / 613 tests, production
  frontend build, Cargo format, 68 Rust tests with 2 explicit external gates
  ignored, Tauri Release/NSIS and portable startup/normal close.
- Delivery:
  `artifacts/release/ai-generated-manuscript-repair-2026-07-31/`; evidence:
  `docs/acceptance/057-ai-generated-manuscript-response-repair-2026-07-31.md`.

The complete-novel promotional recording is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Recorded the real Writing Buddy Windows client with a disposable copy of
  `《零点回声》`, including project overview, Creation Journey, chapter
  manuscript, grounded AI context, three candidate directions, explicit
  insertion, safety snapshot, character context, final chapter and closing
  project statistics.
- Added a direct WebView recorder because Windows GDI capture omitted
  compositor-hosted tool panels. The final source has the complete visible
  application, including AI and character sidebars.
- Added a diagnostic-only deterministic AI fixture for reproducible promotion
  footage. Production AI behavior and release builds remain unchanged.
- Fixed a real rehearsal defect where an accepted AI insertion displayed both
  success and a stale-candidate warning after the host manuscript revision
  changed. The accepted state now remains successful and has a focused
  regression test.
- Final promotional cut: 2560×1440 H.264, 24 fps, 6:27, burned-in Chinese
  captions, separate SRT, title/outro cards and a shot list. The brief cursor
  preflight warning was removed from the public cut.
- Validation: ESLint, TypeScript, 157 Vitest files / 604 tests, production
  frontend build, Cargo format, 68 Rust tests with 2 explicit external gates
  ignored, static complete-novel acceptance, Tauri Release/NSIS, portable
  startup/Alt+F4 exit 0 and full MP4 decode.
- Delivery:
  `artifacts/promo/complete-novel-writing-2026-07-31/`; evidence:
  `docs/acceptance/056-complete-novel-promotional-recording-2026-07-31.md`.
  Updated Windows binaries:
  `artifacts/release/complete-novel-promo-2026-07-31/`.

Long-output support and complete-novel acceptance are complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- DeepSeek maximum-output presets now extend through 384,000 tokens while the
  default stays at 2,048.
- Native request validation, preferences and runtime deadlines match the
  shared TypeScript contract. Token-limited structured output fails before
  parsing or project writes; plain text remains visible as partial output.
- Completed `《零点回声》`: 3 acts, 12 chapters, 24 scenes, 29,770
  non-whitespace characters, an importable Writing Buddy project and a
  standalone manuscript.
- Native acceptance passed project integrity, Creation Journey, Story Kernel
  indexing, 384K preference boundaries, snapshot restore, backup restore,
  four responsive profiles, normal close and second-process reopen.
- Final gates: Node 24.18.0, ESLint, TypeScript, 157 Vitest files / 603 tests,
  production build, Cargo format, 68 Rust tests with 2 explicit external gates
  ignored, Tauri Release/NSIS and production startup/normal close.
- Delivery:
  `artifacts/release/long-output-complete-novel-2026-07-30/`; novel:
  `artifacts/novels/zero-hour-echo/`; evidence:
  `docs/acceptance/055-long-output-complete-novel-2026-07-30.md`.

Phase 1.2C AI Draft Insertion Experience is complete in the isolated worktree
`D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`.

- Cursor continuation and selection polish now hand valid grounded AI output
  to one transient, editable inline draft instead of leaving the result in the
  assistant sidebar or applying it immediately.
- Pending text stays outside the Monaco model, manuscript word count,
  autosave and persisted workspace until the author explicitly writes it.
- Exact resource, revision, range and bounded anchors block stale writes.
- Commit saves dirty author work first, creates the canonical safety snapshot,
  revalidates, performs one Monaco edit, autosaves and exposes one native
  transaction-level Undo.
- Real in-app browser acceptance covered edit, discard, write, snapshot,
  autosave and one-step Undo for both cursor and selection paths.
- Final gates: Node 24.18.0, TypeScript, ESLint, 156 Vitest files / 596 tests,
  production build, Cargo format, 67 Rust tests with 2 explicit external gates
  ignored, Tauri Release/NSIS and portable startup/normal close.
- Delivery: `artifacts/release/ai-draft-insertion-phase-1.2c/`; evidence:
  `docs/acceptance/054-phase-1.2c-ai-draft-insertion-2026-07-30.md`.

Phase 1.2B Genre-to-Draft Core Journey Gates A-I are complete in the isolated
worktree `D:\develop_tool\writing-buddy-genre-to-draft` on
`codex/genre-to-draft-gates-a-c`, based on
`5c1e0eeb feat: reconcile draft changes with story plans`.

- Gate A baseline and architecture audit are complete.
- Gate B's genre-first quick/deep input, Context Preview, strict structured
  generation, one bounded repair, cancellation and duplicate-request guard
  are complete.
- Gate C's editable tree/card/inspector workspace, centralized locks,
  normalized ordering, undo, save and reopen restoration are complete.
- Gate D's selected-node generation, exactly three alternatives, field-level
  Current/A/B/C diff, partial adoption, pre-write snapshot, exact impact
  report and revision-guarded undo are complete.
- Gate E's previewed volume/chapter/scene expansion, conflict and lock checks,
  pre-write snapshot, atomic canonical materialization, project-tree sync and
  12-second snapshot undo are complete.
- Gate F's stable 52 px writing-tool rail, one on-demand/pinnable panel,
  current-scene bar, anchor navigation, remembered layout, three manuscript
  densities and focus-mode restoration are complete.
- Gate G's paragraph-end Continue trigger, optional author guidance, exactly
  three grounded directions, candidate diff/reject, snapshot-before-insert,
  temporary AI highlight and revision-safe Undo are complete.
- Gate H's grounded plan-versus-manuscript reconciliation, explicit outline
  or StoryForge selection, snapshot-before-write and author-owned keep/defer
  outcomes are complete.
- Gate I's nine-rule offline outline checker, explicit read-only AI semantic
  review, evidence validation, duplicate-request guard, responsive quality
  panel and full project-to-editor validation are complete.
- The existing Creation Journey v2 document was extended; no second outline
  store, AI runtime, project tree or Story Kernel was created.
- `WritingProject.volumes[].chapters[]` and Story Kernel `StoryScene` remain
  the canonical Chapter/Scene sources.
- Plans:
  `docs/superpowers/plans/2026-07-30-genre-to-draft-source-map.md` and
  `docs/superpowers/plans/2026-07-30-genre-to-draft-ux-baseline.md`,
  `docs/superpowers/plans/2026-07-30-genre-to-draft-gate-d-author-control.md`
  and
  `docs/superpowers/plans/2026-07-30-genre-to-draft-gate-e-writable-scenes.md`
  and
  `docs/superpowers/plans/2026-07-30-genre-to-draft-gate-f-editor-layout.md`
  and
  `docs/superpowers/plans/2026-07-30-genre-to-draft-gate-g-contextual-ai.md`
  and
  `docs/superpowers/plans/2026-07-30-genre-to-draft-gate-i-validation.md`.
- Final gates: Node 24.14.0, TypeScript, ESLint, 154 Vitest files / 588 tests,
  production build, Cargo format, 67 Rust tests with 2 explicit external
  gates ignored, responsive browser interaction at 390/1024/1280/1536,
  native Windows startup/normal close, Release/NSIS packaging and SHA-256
  verification.
- Evidence:
  `docs/acceptance/053-genre-to-draft-gate-i-core-journey-2026-07-30.md`.
- Delivery: `artifacts/release/genre-to-draft-gate-i/`.

Phase 1.2C, Guided AI Story Development, is complete in
`D:\develop_tool\writing-buddy-phase-1.2c` on
`codex/phase-1.2c-guided-development`.

- Phase 1.2A baseline:
  `5c4e74e1edef0cd09a0f8bdf889b72c69d974421`.
- Phase 1.2B baseline:
  `4eda09c9c73b91e1ca3014ff3edc015f7a98ffa9`.
- Active contract:
  `docs/plans/034-phase-1.2c-guided-ai-story-development.md`.
- Previous completed contract:
  `docs/plans/033-phase-1.2b-idea-to-outline-creation-journey.md`.

The Story Kernel generation resilience patch is also complete:

- A synchronous guard prevents rapid repeated clicks from starting duplicate
  generation requests.
- Missing common resource arrays are safely normalized; malformed candidates
  are isolated individually while valid candidates remain reviewable.
- Fully malformed output is described as an AI response-structure problem,
  not an AI settings or connection failure.
- Real Edge acceptance admitted one request for two same-tick clicks, retained
  eight valid or repairable candidates, isolated the ninth, and recorded no
  browser exceptions or raw schema/settings guidance.
- Final gates: 135 Vitest files / 507 tests, production build, Cargo format,
  60 Rust tests with 2 explicit external gates ignored, Tauri Release/NSIS,
  and portable startup/normal close.
- Delivery:
  `artifacts/release/story-kernel-resilience-2026-07-30/`; evidence:
  `docs/acceptance/046-story-kernel-generation-resilience-2026-07-30.md`.

## Completed

- Completed the strict journey version-2 model with deterministic version-1
  migration, persistent author answers, decision locks, exact downstream
  impact records, target deduplication, and one-item keep/update audit.
- Added one explicit AI question with exactly three choices plus a custom
  answer, and exact-target regeneration. TypeScript, deterministic browser
  fixtures, and Rust reject target mismatch, locked replacement, unsafe
  context, unknown outline sources, paths, credentials, and malformed output.
- Upstream edits preserve all direction, outline, chapter, and manuscript
  content. Materialized chapters expose no AI replacement, and the project
  dashboard keeps the completed creation journey reachable.
- Real Edge acceptance passed the complete new-project-to-three-chapter path
  and post-writing impact loop. At 1536×992, 1280×800, and 1024×720, Paper and
  Midnight have zero page overflow, clipped controls, browser exceptions, or
  controls below 44 px; modal focus entry and Escape restoration pass.
- Final gates: Node 24.14.0, 135 Vitest files / 502 tests, production build,
  complete and release self-tests, Cargo format, 60 Rust tests with 2 explicit
  external gates ignored, Tauri Release/NSIS, and native portable startup.
- Delivery: `artifacts/release/phase-1.2c/`, with hashes and evidence in
  `docs/acceptance/045-phase-1.2c-guided-ai-story-development-2026-07-30.md`.

- Added the six truthful new-project starts, defaulting to **我只有几个想法**.
  The idea route does not pre-create a chapter and does not invoke AI.
- Added the complete author-led journey: 3–8 elements, editable story core,
  exactly three directions, one-or-two direction choice, a 5–8 node
  reorderable outline, exactly three chapter proposals, and one explicit
  create-and-open confirmation.
- Added a strict cross-language `creation-journey` AI contract. Four explicit
  requests handle one bounded decision each; malformed counts, unknown keys,
  paths, credentials, and incomplete structures fail before state changes.
- Added project-owned, hash-safe journey persistence and one rollback-safe
  native transaction that materializes exactly three chapters and reopens
  both the manifest and journey state before success.
- Real Edge acceptance passed at 1536×992, 1280×800, and 1024×720 with Paper,
  Midnight, reduced motion, heading focus, 44 px controls, zero horizontal
  overflow, zero clipped controls, and zero browser exceptions.
- Final gates: 132 Vitest files / 487 tests, production build, complete and
  release self-test modes, Cargo format, 58 Rust tests with 2 explicit
  external gates ignored, Tauri Release/NSIS, and native portable startup /
  normal close.
- Evidence in
  `docs/acceptance/044-phase-1.2b-idea-to-outline-creation-journey-2026-07-30.md`.

- Five isolated Edge profiles completed the same ten visible-interface tasks:
  Continue Writing, exact position verification, 300+ character input,
  focus/planning round trips, sidebar resize, second-process restore, visible
  save failure/retry, and final no-loss verification.
- Gate H outcomes are 5/5 Continue, input, focus, save-state clarity,
  save recovery, and second-start restore; content/layout loss and blocking
  crashes are both zero.
- Project-interactive, restore, and workspace-switch timings meet their
  budgets in all profiles. Edge shell-visible time is 1,053–2,046 ms; two
  cold launches miss the 2,000 ms target by 41–46 ms and remain an explicit
  follow-up. Ten first/second-launch viewport checks have zero horizontal
  overflow and zero clipped interactive controls.
- Final gates: Node 24.14.0 / pnpm 10.32.1, 128 Vitest files / 470 tests,
  change-aware self-test, Gate G and Gate H live-interface runners, frontend
  build, Cargo format, 55 Rust tests, Tauri Release/NSIS, and native
  responsive startup in 785 ms / normal close / exit code 0.
- Evidence in
  `docs/acceptance/043-phase-1.2a-gate-h-real-experience-2026-07-29.md`.

- Added semantic, visible drag previews and polite live announcements across
  project structure and existing Story drag surfaces. Result Toast copy now
  states order, parent, relation, or state-event effects and exposes Undo.
- Centralized the complete twelve-shortcut contract. `Ctrl/Cmd+N` creates a
  real chapter through revision-safe native storage; quick create and Alt+A
  open existing idle UI, and tab close/restore/switch plus arrow navigation
  preserve resource state.
- Dialogs restore exact focus, chapter controls meet 44 px targets, transition
  timing is bounded, and reduced motion removes named animation.
- Real 1536×992, 1280×800, and 1024×720 acceptance reports zero page overflow
  and zero controls clipped outside scrollable regions; semantic preview,
  saved result, Undo, focus restoration, F11, and reduced motion pass.
- Final gates: Node 24.14.0 / pnpm 10.32.1, 127 Vitest files / 468 tests,
  change-aware self-test, frontend build, Cargo format, 55 Rust tests, Tauri
  Release/NSIS, and native PID 33200 responsive close / exit code 0.
- Evidence in
  `docs/acceptance/042-phase-1.2a-gate-g-interaction-feedback-accessibility-2026-07-29.md`.

- Added one explicit save-state model across the writer header, top bar and
  status bar; persistent failure recovery, hash-safe conflict handling,
  queued concurrent saves, and close protection preserve manuscript truth.
- Fixed the in-flight write hazard so only the exact payload sent to disk is
  marked saved; edits typed during the write remain dirty.
- Added the local-only `Ctrl/Cmd+K` Writer Navigator for chapters, scenes,
  manuscript matches, existing Story resources, settings, recent stable IDs,
  and local commands. `Ctrl/Cmd+Enter` previews and TextAnchor-backed Enter
  navigation uses the existing resource/reveal path.
- Real 1536×992, 1280×800, and 1024×720 interaction acceptance has zero page
  overflow, clipped controls, or undersized targets; focus restoration,
  command distinction, TextAnchor chapter navigation, and zero AI activation
  pass.
- Final gates: Node 24.14.0 / pnpm 10.32.1, ESLint, TypeScript, 124 Vitest
  files / 446 tests, change-aware self-test, frontend build, Cargo format,
  53 Rust tests, Tauri Release/NSIS packaging, and isolated native
  startup/normal close with exit code 0.
- Evidence in
  `docs/acceptance/041-phase-1.2a-gate-f-save-trust-writer-navigator-2026-07-29.md`.

- Contextual AI presentation now resolves the current writing context locally,
  keeps at most four primary actions visible, and reuses the existing rewrite
  and continuation intents without adding an AI action or hidden classifier.
- The chapter More menu opens the existing extraction center in current-
  chapter scope without starting a paid job. Candidates are grouped by Story
  type and start unselected, with exact Evidence, reject, Quick Capture defer,
  stale-source blocking, conflict counts, and low-confidence handling.
- Confirmation still creates the canonical pre-write snapshot. The latest
  confirmation can be undone with revision guards: newly created resources
  move to recoverable Trash and updated resources restore their prior content.
- Real 1536×992, 1280×800, and 1024×720 targets have zero page overflow,
  clipped interactive controls, or undersized Story controls.
- Final gates: ESLint, TypeScript, 6 Gate E files / 26 targeted tests,
  120 Vitest files / 427 complete tests, production build, Cargo format,
  53 Rust tests, Tauri Release/NSIS packaging, and native responsive
  startup/normal close all pass.
- Evidence in
  `docs/acceptance/040-phase-1.2a-gate-e-contextual-ai-chapter-organization-2026-07-29.md`.

- Added project-owned Quick Capture state with strict parsing, expected-hash
  concurrency, atomic native writes, and snapshot/backup inclusion.
- Added the global shortcut, status/global-create/selection entries, focus-safe
  dialog, chapter-grouped 待整理箱, source jump, later/ignore, and deterministic
  conversion to existing Story resources with exact source backlinks.
- Added exact MentionLink Entity Peek for Ctrl/Cmd+click, opt-in highlighted
  hover, overlap selection, and Story search preview without changing the
  manuscript route.
- Exact 1536×992, 1280×800, and 1024×720 browser acceptance has no page
  overflow; 44 px inbox targets and clean browser errors were verified.
- Final gates: ESLint, TypeScript, 118 Vitest files / 418 tests, frontend
  build, Cargo format, 53 Rust tests, Tauri Release/NSIS packaging, and native
  responsive startup/normal close all pass.
- Evidence in
  `docs/acceptance/039-phase-1.2a-gate-d-quick-capture-entity-peek-2026-07-29.md`.

- Reframed the existing product around 写作 / 规划 / 资料 / 检查 / 历史 while
  preserving legacy routes, command IDs, Story resources, and AI actions.
- Migrated writer sessions to schema version 2 with independent writing,
  planning, reference, review, and history layouts; version 1 sessions migrate
  safely.
- Writing now defaults to a 272 px chapter sidebar with assistant and dock
  closed. Workspace switching preserves the current resource, manual pane
  changes persist independently, and reset restores the active preset.
- Quiet writing moves project creation and AI generation out of permanent
  high-weight positions. Focus is a non-persistent overlay entered/exited with
  F11 and exited with Escape.
- Real browser interaction verified chapter preservation, workspace switching,
  layout persistence through reload/Continue, focus, and explicit exit.
- Exact 1536×992, 1280×800, and 1024×720 rendering exposed and then verified
  the repair of narrow top-bar/sidebar-launcher clipping.
- Final gates: ESLint, TypeScript, 110 Vitest files / 400 tests, frontend build,
  Cargo format, 52 Rust tests, Tauri Release/NSIS packaging, and native
  responsive startup/normal close all pass.
- Evidence in
  `docs/acceptance/038-phase-1.2a-gate-c-writer-workspaces-2026-07-29.md`.

- Added a versioned, validated writer-session contract keyed by project ID,
  with stable chapter/scene/resource IDs, tab set, cursor/scroll, tree
  expansion, workspace, pane state, and updated time.
- Recent project startup now lands on the story dashboard; **继续上次位置**
  selects the persisted chapter and restores the session view.
- Corrupt, foreign, deleted, or stale session targets reconcile to a safe
  chapter position with readable fallback copy and no project write.
- Real refresh acceptance restored chapter two, two open tabs, and a collapsed
  second volume. Full frontend acceptance is green at 108 files / 390 tests.
- Fresh Release EXE and NSIS artifacts were built; the native EXE remained
  responsive with title `Writing Buddy` and closed normally with exit code 0.
- Evidence in
  `docs/acceptance/037-phase-1.2a-gate-b-session-restore-2026-07-29.md`.

- Produced a fresh Windows x64 portable EXE and NSIS installer from source
  commit `8ae09c86`.
- `self-test:release` passed 106 frontend files / 382 tests, production build,
  52 Rust tests, Tauri Release compilation, and NSIS packaging.
- The portable EXE reached input idle, remained responsive with title
  `Writing Buddy`, accepted normal close, and exited with code 0.
- Delivery copies have verified source-matching SHA-256 hashes under
  `artifacts/release/8ae09c86/`; both are internal unsigned builds.
- Evidence in
  `docs/acceptance/036-windows-release-delivery-2026-07-29.md`.

- Added `self-test`, `self-test:plan`, `self-test:full`, and
  `self-test:release` commands with Git worktree/base/latest-commit discovery.
- Impact selection combines Vitest dependency analysis, changed
  feature/package test roots, and explicit AI/snapshot/Story Kernel/project/
  shell/native safety rules.
- Global infrastructure changes promote to complete frontend acceptance;
  Rust changes run complete Cargo gates; Release mode adds Tauri packaging.
- Every execution writes an ignored JSON report with inputs, risk areas,
  commands, timings, exit codes, and final status.
- Self-test acceptance: 9 planner tests, real 6-file/19-test character impact
  selection, 106 frontend files / 382 tests, production build, and 52 Rust
  tests.
- Evidence in
  `docs/acceptance/035-change-aware-self-test-framework-2026-07-29.md`.

- Unified every AI pre-write snapshot on the canonical
  `beforeDestructiveOperation` reason while preserving feature detail in the
  snapshot label.
- Narrowed desktop and shared AI apply ports to `SnapshotReason`, so invalid
  feature-local values fail TypeScript validation before reaching Rust.
- Snapshot failure leaves generated candidates pending with zero repository
  writes, and the direct Story Kernel panel shows actionable localized copy
  instead of raw `invalidSnapshotReason`.
- Snapshot-contract acceptance: Node 24.14.0, 105 frontend files / 373 tests,
  52 Rust tests, seven-type browser confirmation, clean warning/error logs,
  fresh Tauri packaging, and isolated native close with exit code 0.
- Evidence in
  `docs/acceptance/034-ai-snapshot-reason-contract-2026-07-29.md`.

- Added opt-in, sentence-end `Tab` plot expansion with a 2.4-second idle
  window, at most 4,000 UTF-16 units before the cursor, grammar-job priority,
  stale cancellation, exact caching, and cooldown.
- Monaco renders native ghost text; `Tab` accepts, `Esc` rejects, normal Tab
  behavior remains when no preview is visible, and accepted text is normally
  undoable without immediately scheduling another paid request.
- Inline-plot acceptance: Node 24.14.0, 105 frontend files / 372 tests, 52
  Rust tests, Paper/Midnight browser checks, clean stable-reload logs, fresh
  Tauri packaging, and isolated native close with exit code 0.
- Evidence in
  `docs/acceptance/033-inline-tab-plot-expansion-2026-07-29.md`.

- Added opt-in inline AI spelling and grammar checks for changed manuscript
  paragraphs, with 1.2-second debounce, 2,400 UTF-16-unit slices, stale-job
  cancellation, exact-result caching, cooldown, and strict response anchoring.
- Clear findings render as Monaco squiggles with explanations. Replacements
  require an explicit author action and remain normally undoable.
- Inline-language acceptance: Node 24.14.0, 103 frontend files / 363 tests,
  52 Rust tests, Paper/Midnight checks at 1280/1024, clean browser logs, fresh
  Tauri packaging, and isolated native close with exit code 0.
- Evidence in
  `docs/acceptance/032-inline-ai-language-check-2026-07-29.md`.

- Added global Ctrl/Cmd+B, Ctrl/Cmd+Alt/Option+B, and Ctrl/Cmd+J pane
  shortcuts that work with editor focus, preserve pane geometry, and expose
  button/Settings discoverability.
- Workspace shortcut acceptance: 101 frontend files / 351 tests, 51 Rust
  tests, 1536/1024 interaction checks, fresh Tauri packaging, and isolated
  native close with exit code 0.
- Evidence in
  `docs/acceptance/031-workspace-layout-shortcuts-2026-07-29.md`.

- Project sidebar, writing assistant, and task dock now resize with pointer or
  keyboard controls, remain available in responsive layouts, persist exact
  sizes, and support double-click/Enter reset.
- Workspace resizing acceptance: 99 frontend files / 344 tests, 51 Rust tests,
  Paper/Midnight checks at 1536/1280/1024, fresh Tauri packaging, and isolated
  native close with exit code 0.
- Evidence in
  `docs/acceptance/030-vscode-style-workspace-resizing-2026-07-29.md`.

- Project creation is now explicitly labeled **新建项目** in the welcome,
  global create menu, compact project shelf, and four-step wizard.
- The open-project sidebar overflow is a working keyboard-accessible project
  menu rather than an inert control.
- Dirty-manuscript creation cancellation performs no create call and preserves
  the current project and unsaved content.
- Project creation entry acceptance: 97 frontend files / 337 tests, 51 Rust
  tests, six Paper/Midnight responsive menu checks, fresh Tauri packaging, and
  isolated native close with exit code 0.
- Evidence in
  `docs/acceptance/029-project-creation-entry-hardening-2026-07-28.md`.
- Scene generation now derives chapter/range/revision/order from local
  manuscript state, safely re-anchors unique evidence quotes, and keeps
  ambiguous, overlapping, or multi-scene ranges blocked.
- Scene-grounding and optional-null acceptance: 97 frontend files / 335 tests,
  51 Rust tests, Paper/Midnight responsive checks, final Tauri packaging, and
  isolated native close with exit code 0.
- Story Kernel scene-grounding evidence in
  `docs/acceptance/028-story-kernel-scene-grounding-2026-07-28.md`.
- Shared 32/40/44-pixel control tiers, 16/18/20-pixel button icon tiers,
  stable hover feedback, readable full-opacity disabled states, and shared
  card geometry across the desktop client.
- Semantic `AppEmptyState` full/panel/compact variants adopted by major
  no-resource, search, review, version, reference, continuity, and AI
  surfaces.
- Y6 acceptance: Node 24, 97 frontend files / 327 tests, 51 Rust tests,
  Paper/Midnight responsive checks at 1536/1280/1024, fresh Tauri packaging,
  clean browser console, and isolated native close with exit code 0.
- Project visual polish Y6 evidence in
  `docs/acceptance/027-project-visual-polish-y6-2026-07-28.md`.
- First-class scene rows below chapters with same-chapter reorder and
  cross-chapter movement.
- Exact UTF-16 manuscript-slice planning with preservation of unlinked text,
  stable scene IDs, dense narrative order, and strict anchor validation.
- One native transaction for Markdown, Story resources, and Mentions with
  revision/hash prechecks, staging, rollback, and reread verification.
- Exact-restore scene Undo based on verified post-move revisions and hashes.
- Scene movement acceptance: 95 frontend files / 321 tests, 51 Rust tests,
  1440/1024/800 responsive checks, fresh Tauri package, and isolated native
  close with exit code 0.
- Project scene movement evidence in
  `docs/acceptance/026-project-scene-movement-2026-07-28.md`.
- Fixed Story Kernel requests being rejected as **AI 配置不完整。** before
  provider dispatch when the model and credential were valid.
- TypeScript/Rust prompt parity now covers all 14 duplicated AI system prompts.
- Prompt-parity acceptance: 92 files / 309 frontend tests, 49 Rust tests,
  fresh Tauri package, and normal native close with exit code 0.
- Structured native AI failures now preserve public code, localized message,
  retryability, and HTTP status across Story Kernel, grounded JSON, and
  selection-rewrite boundaries.
- Story Kernel shows recovery guidance plus an explicit retry or AI-settings
  action without silently repeating a paid request.
- Both source handoffs have an evidence-backed implemented/partial/external
  matrix instead of a blanket completion claim.
- Reliability acceptance: 91 files / 295 frontend tests, 49 Rust tests,
  responsive Paper/Midnight visual checks, fresh Tauri build, and normal native
  close with exit code 0.
- Independent client architecture and Legacy schema compatibility reader
- Safe Rust filesystem, process lock, Credential Manager, snapshots and backup
- Monaco desktop render fix (`freezePrototype: false`)
- Immutable session/store refresh after edits, saves and reloads
- Real copied-project desktop acceptance
- Node 24 / pnpm 10 / TypeScript / Vitest / Vite / Cargo / Tauri build gates
- Durable evidence in `docs/acceptance/002-desktop-acceptance-2026-07-26.md`
- StoryForge Source Map and baseline freeze in
  `docs/plans/storyforge-source-map.md` and
  `docs/acceptance/storyforge-baseline.md`
- Diagnosable project open, read-only fallback, stale-lock repair and stable
  no-project startup
- Real Tauri project open and second-launch recovery evidence in
  `docs/acceptance/005-storyforge-gate-a-project-open-2026-07-27.md`
- Windows close regression evidence and rebuilt release hashes in
  `docs/acceptance/006-window-close-regression-2026-07-27.md`
- Story Kernel IDs, positions, evidence, strict schemas and safe paths
- Atomic Story Repository transactions, revision conflicts and Trash recovery
- First-class Story resource routes/tabs with persistence and missing recovery
- Full-height Story dashboard with three responsive viewport checks
- Scene metadata/navigation and manuscript-safe unlink behavior
- Mention persistence, rebase/stale handling, Monaco decorations and backlinks
- Gate B real Tauri evidence in
  `docs/acceptance/007-storyforge-gate-b-story-kernel-2026-07-27.md`
- Character Center with dynamic state history, confirmation and conflicts
- Directed relationship graph/matrix with time slices, evidence and Worker layout
- Story-time and narrative-order timeline with virtual tracks and list fallback
- Deterministic overlap, predecessor and travel-time review rules
- Full-height 1536/1280/1024 Story workspace regression fix
- Gate C evidence in
  `docs/acceptance/008-storyforge-gate-c-character-relationships-timeline-2026-07-27.md`
- Location hierarchy, structured factions/world rules and static map
- Story-asset holder/location/quantity/condition history and consistency rules
- Plot-thread board and foreshadowing plant/reminder/payoff lifecycle
- Story truth, reader reveal and character-knowledge time slices
- Author-secret default AI exclusion and premature-reveal checks
- Gate D evidence in
  `docs/acceptance/009-storyforge-gate-d-world-assets-plots-information-2026-07-27.md`
- Deterministic P0–P6 Context Pack construction with author-visible toggles,
  token budgets and author-secret exclusion
- Position-aware dynamic character state in grounded AI context
- Selection rewrite streaming, Diff, partial/full accept, note, reject and Undo
- AI-extracted pending facts with atomic persistence and mandatory author
  confirmation, Evidence and StoryPosition
- Unified text-rule, Story Kernel and AI continuity review with deduplication,
  stale evidence, two-source navigation and persisted resolution
- Gate E evidence in
  `docs/acceptance/010-storyforge-gate-e-grounded-ai-continuity-2026-07-27.md`
- Initial Git branch and exact JavaScript/Rust lockfiles
- Scoped DeepSeek provider contracts, model selection, job lifecycle, retry
  policy, cancellation, usage aggregation, and error taxonomy
- Windows Credential Manager key storage and fixed-host Rust transport
- Incremental SSE parser with private reasoning redaction
- AI & Models settings and isolated StoryForge streaming test page
- Durable Phase 1.0A evidence in
  `docs/acceptance/003-phase-1.0a-ai-foundation-2026-07-27.md`
- Full-width, full-height system-page shell for Search, Review, Versions,
  AI Test, and Settings
- Local manual and DeepSeek automatic chapter review with author-confirmed
  application
- Strict Rust job-purpose validation and validated AI issue anchoring
- Durable Phase 1.0B evidence in
  `docs/acceptance/004-system-layout-and-ai-review-2026-07-27.md`
- Isolated `story-kernel-generation` AI purpose with matching TypeScript and
  Rust request boundaries
- Strict complete-resource response parser for eleven Story Kernel types
- Persisted generation batches with exact evidence anchoring, schema checks,
  collision/reference/dependency conflicts and author-secret protection
- Create-safe, revision-safe atomic batch confirmation with a mandatory
  pre-commit safety snapshot
- Assistant **Kernel** tab with target selection, streaming/cancel state,
  candidate JSON/evidence review, rejection and batch confirmation
- Snapshot and `.wbbackup` inclusion for pending generation decisions
- Full Node acceptance: 52 files / 153 tests; Rust: 35 passed / 2 explicit
  release gates ignored in the normal suite
- Release performance and sanitized recovery gates passed; fresh Windows
  production executable and NSIS installer built and close/restart verified
- Reusable AI Action, versioned Prompt, strict output, privacy-aware Context,
  and guarded Preview Transaction contracts
- Unified AI generation drawer with the existing chapter-review runtime as its
  first real streaming adapter
- Responsive AI drawer evidence at 1536, 1280, and 1024 with zero clipped or
  undersized controls
- Full Node acceptance: 60 files / 176 tests; Rust: 35 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Windows EXE and NSIS installer built; isolated desktop smoke accepted
  normal close
- Selected-text **AI 润色** routed to grounded Context Pack, Diff candidate,
  stale protection, cancellation, explicit acceptance and Undo
- Selected-text character, location, item, information, and foreshadowing
  actions routed to one-type Story Kernel presets without automatic requests
- Warm-paper toolbar and assistant UI refined with visible active states,
  44px targets, and 1536/1280/1024 responsive evidence
- Full Node acceptance: 62 files / 181 tests; Rust: 35 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate C Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate C evidence in
  `docs/acceptance/014-ai-quick-actions-gate-c-2026-07-27.md`
- Header **AI 续写** modes for continuing a paragraph, completing a scene, and
  comparing exactly three directions
- Cursor/revision/anchor-protected candidate insertion with explicit author
  choice, cancellation, rejection, stale blocking, and Undo
- Assistant **细纲** tab for generating or extracting scene goal, conflict,
  turn, outcome, and emotion beats
- Per-field StoryScene acceptance with fresh repository recheck, expected
  revision, pre-write safety snapshot, and optional `emotionBeats`
- Matching TypeScript/Rust `manuscript-continuation` and
  `scene-plan-generation` request boundaries
- Responsive warm-paper evidence at 1536/1280/1024 with zero page overflow,
  clipped controls, or effective targets below 44px
- Full Node acceptance: 64 files / 188 tests; Rust: 37 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate C2 Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate C2 evidence in
  `docs/acceptance/015-ai-quick-actions-gate-c2-2026-07-27.md`
- Strict TypeScript/Rust `character-analysis` and `relationship-analysis`
  contracts with exact candidate shapes and extraction evidence
- Character Center AI generation, backstory, arc, voice, and grounded chapter
  extraction with explicit same-name merge and selected-only acceptance
- Confirmed dynamic character state persistence for inventory and knowledge
- Directed relationship generation/evolution analysis with independent
  opposite edges, dashed pending previews, conflicts, and one-edge acceptance
- Snapshot-backed, revision-safe Character and Relationship commits
- Responsive 1536/1280/1024 Gate D evidence with zero page overflow, clipped
  controls, or effective targets below 44px
- Full Node acceptance: 66 files / 199 tests; Rust: 39 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate D Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate D evidence in
  `docs/acceptance/016-ai-quick-actions-gate-d-2026-07-27.md`
- Strict TypeScript/Rust `world-analysis` and `item-analysis` contracts with
  typed targets, bounded chapter context, known identities, and exact
  extraction evidence
- Worldbuilding generation and extraction for locations, factions, cultures,
  religions, technology, magic, law, and scoped general rules
- Explicit same-name merge, per-field acceptance, rule conflict detection,
  stale-source/revision checks, and snapshot-backed world commits
- Item card, history, and extraction candidates with independently selectable
  state events and deterministic unique-item holder checks
- Responsive 1536/1280/1024 Gate E evidence with zero page overflow, clipped
  controls, or effective targets below 44px
- Full Node acceptance: 69 files / 210 tests; Rust: 41 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate E Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate E evidence in
  `docs/acceptance/017-ai-quick-actions-gate-e-2026-07-27.md`
- Strict TypeScript/Rust `timeline-analysis` and `plot-analysis` contracts with
  bounded multi-chapter context, known identities, and exact extraction
  evidence
- Timeline extraction, goal-based generation, exactly three directions, and
  typed dashed causal-edge review with atomic bidirectional link persistence
- Plot-thread generation/progress extraction plus foreshadowing generation,
  payoff, and extraction with explicit lifecycle checks
- Author secrets excluded by default behind an explanatory opt-in control
- Snapshot-backed, stale-source/revision-safe selected-batch commits
- Responsive 1536/1280/1024 Gate F evidence with zero page overflow, clipped
  controls, or effective targets below 44px
- Full Node acceptance: 71 files / 222 tests; Rust: 43 passed / 2 explicit
  release gates ignored in the normal suite
- Fresh Gate F Windows EXE and NSIS installer built; isolated desktop smoke
  accepted normal close
- Gate F evidence in
  `docs/acceptance/018-ai-quick-actions-gate-f-2026-07-27.md`
- Global no-project create entry, welcome page, compact recent-project shelf,
  and four-step creation wizard
- Six typed project templates with adjustable initial resources and no
  automatic AI/prose generation
- Native creation preflight, same-parent staging, reopen verification, atomic
  directory save, collision refusal, and failure cleanup
- Project-scoped theme/accent persistence and restore
- Semantic selected/hover/focus/drag/AI/conflict/status tokens across Paper,
  Midnight, Fog, and Focus themes
- Responsive 1440/1024 visual evidence and explicit compact icon labels
- Full Node acceptance: 79 files / 252 tests; Rust: 47 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed
- Project Creation Y0–Y2 evidence in
  `docs/acceptance/020-project-creation-y0-y2-2026-07-28.md`
- Typed volume/chapter drag payloads, targets, rule registry, and commands
- Pointer and keyboard project-tree dragging with source, target, insertion,
  overlay, invalid, live-announcement, search-disabled, and read-only states
- Write-locked manifest revision checks, atomic persistence, canonical reopen
  verification, exact inverse commands, toast Undo, and Ctrl+Z parity
- Responsive 1440/1024/800 evidence with zero horizontal overflow and fixed
  structure/reference scrolling
- Full Node acceptance: 83 files / 271 tests; Rust: 49 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed with exit code 0
- Project structure drag Y3 evidence in
  `docs/acceptance/021-project-structure-drag-y3-2026-07-28.md`
- Guarded character, item, and foreshadowing association with explicit
  scene/position/meaning confirmation and no AI invocation
- Narrative timeline reordering with story-time lockout and pre-write
  causality conflict confirmation
- Plot-thread lifecycle dragging with no-op protection, revision-safe save,
  reload consistency, and Undo
- Responsive 1440/1024/800 evidence with zero document/page overflow, 44px
  controls, bottom-sheet confirmation, visible focus, and reduced motion
- Full Node acceptance: 86 files / 279 tests; Rust: 49 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed with exit code 0
- Project association drag Y4 evidence in
  `docs/acceptance/022-project-association-drag-y4-2026-07-28.md`
- Shared TreeRow, DropIndicator, DragOverlayCard, AssociationMenu, UndoToast,
  and AI candidate state primitives adopted by project-tree and association
  surfaces
- Project-scoped, opt-in character/location/item/foreshadowing manuscript
  highlights with distinct four-theme semantic tokens
- Field-specific Story Kernel diagnostics with safe actual-value previews,
  blocked invalid writes, and raw JSON collapsed behind diagnostic disclosure
- Responsive 1440/1024 evidence for real entity decorations and the supplied
  `readerVisibility: "hidden"` regression across Paper, Midnight, Fog, and
  Focus
- Full Node acceptance: 89 files / 287 tests; Rust: 49 passed / 2 explicit
  external gates ignored
- Fresh portable EXE and NSIS installer built; isolated native startup and
  normal close passed with exit code 0
- Project highlight and shared interaction Y5 evidence in
  `docs/acceptance/023-project-highlight-components-y5-2026-07-28.md`

## Open

- Validate `/models`, balance, streaming, cancellation, restart, and deletion
  with a user-provided real DeepSeek key.
- Validate AI automatic chapter review with that key.
- Validate AI Story Kernel generation quality against the user's real
  DeepSeek account and a non-sanitized author-selected chapter.
- Human cutover gates are intentionally not automated.
- Legacy retirement is forbidden until M9 is complete.

## Next

Stop before Phase 1.2D. Do not expand into deep character/world/timeline
development or background AI behavior without explicit user direction.

## Project Creation Y0–Y2 complete

- Source map and canonical project ordering contract are recorded in
  `docs/plans/010-project-creation-drag-source-map.md` and
  `docs/plans/011-project-data-ordering-contract.md`.
- Implementation contract and stop line are recorded in
  `docs/plans/012-project-creation-y0-y2.md`.
- `ui-ux-pro-max` guided the semantic token, focus, responsive, readable
  disabled-state, and reduced-motion treatment.
- Browser visual acceptance exposed and fixed the welcome import style,
  compact sidebar button layout, and responsive icon-only accessible labels.
- The official browser-skill client was incompatible with the protected Node
  runtime; local Playwright and installed Edge provided the equivalent
  acceptance path.
- Drag Y3–Y4 remains deliberately deferred per the handoff.

## AI Quick Actions Gate G start

- User direction “继续完成” continues the accepted Gate F branch into the final
  Tasks 22–25.
- Created `codex/ai-quick-actions-gate-g` from accepted Gate F.
- Gate G reuses the existing strict Story Kernel generation/conflict pipeline,
  ReviewIssue/Continuity Engine, AI streaming lifecycle, snapshots, backup, and
  restore ports instead of introducing parallel write paths.
- The `ui-ux-pro-max` rules file was read completely. Its required
  `scripts/search.py` is absent from the installed package, so the documented
  accessibility, interaction, responsive, contrast, and reduced-motion rules
  are applied directly.
- Contract:
  `docs/plans/009-ai-quick-actions-gate-g-extraction-review-hardening.md`.

## AI Quick Actions Gate G complete

- Added **AI 正文整理** with current chapter/current volume/selected/all/
  unfinished scope, deterministic preflight Tokens, sequential paid jobs,
  explicit stop/resume and restart normalization without automatic billing.
- Completed chapters and candidate batches survive failure/cancellation;
  stale sources require explicit refresh and concurrent ledger writes fail
  safely.
- All extracted resources use the existing Story Kernel generation schema,
  collision/reference/evidence rules, pending candidate store, snapshot and
  atomic transaction path.
- Added grounded **AI 对照审查** for 2–12 selected chapters, exact evidence
  A/B, optional safe Story Fact, AI severity capped at warning and no
  replacement/write path.
- Privacy tests and scans cover author secrets, paths, credentials, ledger
  prose, Prompt output and hidden foreshadowing meanings.
- Responsive 1536/1280/1024 evidence has zero page overflow, clipped controls
  or effective controls below 44px.
- Full Node acceptance: 75 files / 241 tests; Rust: 44 passed / 2 explicit
  manual gates ignored.
- Fresh portable EXE and NSIS installer built; native startup and normal close
  passed.
- Acceptance:
  `docs/acceptance/019-ai-quick-actions-gate-g-2026-07-28.md`.

## AI Quick Actions Gate F start

- The user explicitly asked to continue after accepted Gate E.
- Created `codex/ai-quick-actions-gate-f` from the accepted Gate E branch.
- Gate F implements original Tasks 18–21 with dedicated `timeline-analysis`
  and `plot-analysis` boundaries, bounded multi-chapter scope, exact extraction
  evidence, atomic batch acceptance, dashed pending causality, and author
  secrets excluded by default.
- The installed UI/UX skill still lacks its referenced search helper. Its
  accessible warm-paper, Lucide, 44px, focus, contrast, responsive, and
  reduced-motion rules are applied directly.
- Contract:
  `docs/plans/008-ai-quick-actions-gate-f-story-progress-plots.md`.

## AI Quick Actions Gate E start

- The user explicitly asked to continue after accepted Gate D.
- Created `codex/ai-quick-actions-gate-e` from the accepted Gate D branch.
- Gate E implements original Tasks 15–17: structured worldbuilding generation
  and extraction plus item card/history/extraction/transfer candidates.
- The UI/UX skill package did not include its referenced search helper, so its
  documented warm-paper, Lucide, 44px, focus, responsive, contrast, and
  reduced-motion rules are applied directly.
- Contract:
  `docs/plans/007-ai-quick-actions-gate-e-worldbuilding-items.md`.

## AI Quick Actions Gate D start

- The user explicitly asked to continue after Gate C2, satisfying the previous
  stop for product direction.
- Created `codex/ai-quick-actions-gate-d` from the accepted Gate C2 branch.
- Gate D implements original Tasks 12–14: character generation, grounded
  character extraction and directed relationship generation/extraction.
- The `ui-ux-pro-max` skill guides the warm-paper review surfaces: 44px targets,
  explicit states, visible focus and responsive layout.
- Contract:
  `docs/plans/006-ai-quick-actions-gate-d-characters-relationships.md`.

## Genre-to-Draft Gate B complete

- Project creation now defaults to the truthful "generate from genre" route
  while preserving every existing creation route and the same project tree.
- Quick and deep author briefs persist in the existing Creation Journey v2
  document. The request preview names both included fields and excluded
  manuscripts, secrets, paths, and unrelated project records.
- `outline.generateFromGenre`, Prompt Registry metadata, TypeScript AI
  parsing, and Rust command validation share one strict response contract.
- A synchronous request guard prevents rapid duplicate clicks. Invalid model
  structure gets exactly one bounded repair attempt; cancellation and
  connection failures are never retried as structural repairs.
- Generated results remain editable, unmaterialized story beats. No Chapter,
  Scene, character, or world resource is created by generation.
- Gate B regression passed typecheck, lint, 140 Vitest files / 525 tests,
  production build, Cargo format, and 62 Rust tests with two explicit external
  gates ignored.

## Next

Gate H is complete. Stop before Gate I and wait for explicit user direction.

## Genre-to-Draft Gate H complete

- Extended the existing `story-kernel-generation` action with an optional,
  bounded chapter-plan input and a strict plan-versus-actual reconciliation
  response. Candidate-only calls remain backward compatible.
- Added exact-Evidence, unique-field, planned/actual cross-checks and mirrored
  privacy and bounds validation in TypeScript and Rust.
- Persisted reconciliation inside the existing Story Kernel generation batch
  with explicit pending, outline-updated, difference-kept and
  manuscript-editing states. No second candidate or outline store was added.
- Added plan-versus-actual review, calm `needs_review`, zero default
  selections, explicit field checkboxes and the author choices
  `更新大纲`, `修改正文`, `保留差异`, and `稍后处理`.
- Extended the existing snapshot-backed batch confirmation across selected
  StoryForge resources and selected outline fields. Manuscript hash, plan
  revision, locks, journey hash and resource conflicts are checked before
  writes; resource receipts provide rollback if the journey write fails.
- Fixed responsive 1280×720 scrolling, false stale state after an accepted
  outline update, and repeated organization after the plan already matches.
- Browser acceptance completed a fresh 3-volume / 9-chapter / 27-scene
  journey, selected one outline field plus one resource, created one snapshot,
  confirmed both, and observed zero console warnings/errors.
- Full and release self-tests passed with Node 24.14.0: ESLint, TypeScript,
  150 Vitest files / 576 tests, production build, Cargo format, 66 Rust tests
  with 2 external gates ignored, Tauri Release and NSIS.
- The final portable executable reached input idle, remained responsive with
  title `Writing Buddy`, closed normally and exited with code 0.
- Delivery:
  `artifacts/release/genre-to-draft-gate-h/`; acceptance:
  `docs/acceptance/052-genre-to-draft-gate-h-reconciliation-2026-07-30.md`.
- Gate I has not started.

## Current QA convergence — project creation interactions

- Source `d9700cc8971ae9d7fe4bd3cad9925f9de6ad8a5c` makes project directory
  selection, draft import and final creation single-flight within the wizard.
- 100-action pressure proves one chooser, confirmation or write per author
  action; atomic-save failure remains explicitly retryable from the final step.
- Esc from a wizard opened through the project menu now restores focus to the
  persistent `项目菜单` trigger.
- Desktop, 620 px and 420 px live journeys passed without horizontal overflow
  or browser warnings/errors.
- Full evidence: 174 frontend files / 773 tests passed; Rust collected 79,
  passed 77 and skipped two with reasons; the 852-row ledger contains 850 passes
  and two skips.
- Execution is `PASS`. Product/release remains `PARTIAL` and blocked by 10,103
  traceability gaps, 221 missing stable selectors, absent real-provider smoke
  and no release package in this run.

## Current QA convergence — Story resource lifecycle

- Source `632d2bc90dc78b8192dec27991584df751d67d7d` routes every direct
  Story Kernel resource open through the same save, latest-intent and project
  validation queue used by chapter resources.
- Story repository loading is side-effect free until the store commits the tab.
  A failed save performs zero Story reads, a newer chapter intent wins, edits
  typed during loading are saved, and a successful restore consumes its closed
  history entry.
- Five red-first lifecycle contracts plus the service contract pass in the
  27-test focused run; the wider writer-session/workspace set passes 51 tests.
- Live browser QA saved a dirty third chapter before opening `信号塔`, restored
  the closed Story tab exactly once with `Ctrl+Shift+T`, and rejected a second
  restore without duplication. The 420 px layout has no horizontal overflow and
  the console has zero warnings/errors.
- Full evidence: 174 frontend files / 798 tests passed; Rust collected 79,
  passed 77 and skipped two with reasons; the 877-row ledger contains 875 passes
  and two skips.
- Execution is `PASS`. Product/release remains `PARTIAL` and blocked by 10,106
  traceability gaps, 221 missing stable selectors, absent real-provider smoke
  and no release package in this run.

## Current QA convergence — Story resource recovery lifecycle

- Source `7e6e396` distinguishes a genuinely missing Story resource from a
  transiently unavailable one, keeps both states retryable, and no longer lets
  one failed Story read abort the rest of project reopen.
- Rechecking an active non-ready resource performs a fresh read. One hundred
  restore actions share one native restore call; failures release for retry;
  raw errors are localized; and a late restore cannot overwrite a newer chapter
  choice.
- Restore loading is side-effect free until the app store verifies project and
  latest intent. The 7-failure red baseline converged to 36/36 focused and
  66/66 impacted tests.
- Live browser QA reopened a project with the existing `黄铜钥匙` Story tab,
  reactivated it by keyboard, preserved tab/heading/content alignment at 420 px,
  produced no horizontal overflow and emitted zero warning/error logs. The
  fixture has no delete UI, so missing/Trash setup remains deterministic
  service/store/component evidence rather than a hidden test-only browser path.
- Full evidence: 175 frontend files / 806 tests passed; Rust collected 79,
  passed 77 and skipped two with reasons; the 885-row ledger contains 883 passes
  and two skips.
- Execution is `PASS`. Product/release remains `PARTIAL` and blocked by 10,087
  traceability gaps, 221 missing stable selectors, absent real-provider smoke
  and no release package in this run.

## Next QA target

Continue the same user-first red-contract method on the next unmapped P0/P1
author journey; do not claim release completion until strict traceability,
real-provider smoke and packaging gates are closed.

## Current QA convergence — Relationship AI lifecycle

- Source `c19c46c` localizes malformed relationship schema output and unknown
  candidate-write failures without exposing Zod paths or private filesystem
  details. Both generation and the same candidate remain explicitly retryable.
- One hundred same-frame Generate actions still issue one provider request. A
  failed snapshot plus one retry performs two snapshot attempts and completes
  without a second generation.
- Relationship AI now exposes 9/9 stable control declarations, including
  distinct source/target selectors. Nine representative controls are visible,
  enabled and keyboard focusable; evidence opening is pointer-tested.
- Failure-first produced four red contracts. Focused execution passed 22/22,
  the relationship/AI/QA impact set passed 79/79 and QA infrastructure passed
  29/29.
- Full evidence: Node 24 passed lint, typecheck, 188 frontend files / 978 tests
  and production build; Rust passed 77 with two reasoned ignores.
- Strict aggregate coverage is 2,201/12,350 (17.82%), with 10,149 gaps.
  Stable selectors are 370/480 (77.08%); 110 remain. Test-case mapping is
  152/1,057 (14.38%); 905 remain unmapped.
- Release hard gates remain 1/4 (25%). Strict traceability, real-provider smoke
  and packaged-EXE acceptance are still required before release.

## Current QA convergence — whole-work consistency AI controls

- Source `807d106` gives the close, whole-work scope, selected scope, chapter
  selection, instruction, Run and Stop controls seven distinct stable
  identities; the source now has 7/7 mapped declarations.
- One hundred same-frame Run actions start one provider request and publish one
  atomic result set. One hundred Stop actions issue one cancellation command
  and expose the pending disabled state.
- Selected mode caps at 12 chapters, releases the cap after deselection and
  keeps enabled representatives keyboard focusable. A later batch failure
  publishes no partial result; explicit full restart succeeds.
- Failure-first produced five red contracts. Focused execution passed 19/19,
  impact execution passed 86/86 and QA infrastructure passed 29/29.
- Full evidence: Node 24 passed lint, typecheck, 188 frontend files / 978 tests
  and production build; Rust passed 77 with two reasoned ignores.
- Strict aggregate coverage is 2,310/12,396 (18.63%), with 10,086 gaps. Stable
  selectors are 376/482 (78.01%); 106 remain. Test-case mapping is 156/1,057
  (14.76%); 901 remain unmapped.
- Release hard gates remain 1/4 (25%). Strict traceability, real-provider smoke
  and packaged-EXE acceptance are still required before release.
