# StoryForge Gate E acceptance — 2026-07-27

## Decision

Gate E is complete and recommended for human approval. Tasks 17–20 are
implemented; Task 21 and Gate F were not started.

## Delivered

### Task 17 — author-visible Context Pack

- Deterministic P0–P6 priority and token-budget policy with stable
  deduplication.
- Required instruction and selection records, scene/character/location/assets,
  world rules, plot threads, foreshadowing and information candidates.
- Author-secret exclusion by default and explicit exclusion reasons.
- Preview UI with per-item include toggles before any request is sent.
- No project path, API key or unselected full chapter in the serialized AI
  contract.
- P3 character context now resolves the dynamic state at the selected scene's
  narrative position and labels author-confirmed, pending and conflicting
  records.

### Task 18 — grounded selection rewrite

- Existing editor selection actions open a grounded rewrite panel.
- DeepSeek output streams into a revision-bound `RewriteCandidate`.
- Original/suggestion diff, rationale, impact and usage are author-visible.
- Full accept, edited partial accept, reject, save-note and Undo paths.
- Acceptance goes through the existing edit transaction and rejects stale
  source revisions or changed source text.

### Task 19 — AI-extracted pending facts

- JSON-only extraction contract in TypeScript and Rust.
- Results persist atomically under
  `.writing-buddy/ai/pending-facts/index.json`.
- No extracted fact is auto-confirmed.
- Each fact supports edit, accept and reject independently.
- Acceptance requires author-confirmed Evidence and StoryPosition data.

### Task 20 — unified continuity review

- One engine aggregates text rules, deterministic Story Kernel issues and AI
  suggestions.
- Stable deduplication, stale-evidence detection and persisted author
  resolution state.
- AI-only findings are capped at warning until the author confirms them.
- Severity metrics, filterable list, detail Inspector and two-source evidence
  navigation.
- Timeline, item, plot, foreshadowing and information rules feed the same
  review page.

The existing chapter Review page still supports both Local manual review and
DeepSeek automatic review. In both modes, applying a suggestion remains an
explicit author action.

## Task commits

- `267f17e` — `feat: build author-visible grounded ai context packs`
- `eaf92f7` — `feat: add grounded selection rewrite with diff and undo`
- `52f1376` — `feat: review ai extracted story facts before confirmation`
- `51619b8` — `feat: unify long-form continuity review across story data`
- `04478c4` — `fix: ground ai rewrites in dynamic character state`

## Changed files

The Gate changes touch 35 production/test files:

- Story Kernel:
  `packages/story-kernel/src/query/ContextPackBuilder.ts`,
  `packages/story-kernel/src/query/TokenBudgetPolicy.ts`,
  `packages/story-kernel/src/model/PendingFact.ts`,
  `packages/story-kernel/src/validation/ContinuityEngine.ts`, their tests and
  `packages/story-kernel/src/index.ts`.
- AI contracts:
  `packages/ai/src/index.ts`, `packages/ai/src/index.test.ts` and
  `apps/desktop/src-tauri/src/ai/mod.rs`.
- Context and rewrite UI:
  `apps/desktop/src/features/story/ai-context/ContextPackPreview.*`,
  `CandidateDiffView.tsx`, `SelectionRewritePanel.*`,
  `SelectionRewriteService.*`, `StoryExtractionService.*` and
  `PendingFactsReview.*`.
- Continuity UI:
  `apps/desktop/src/features/story/continuity/ContinuityReviewPage.*`,
  `IssueEvidenceView.tsx` and
  `apps/desktop/src/features/review/ReviewRepository.ts`.
- Existing integration points:
  `apps/desktop/src/app/routes.tsx`, `apps/desktop/src/app/store.ts`,
  `apps/desktop/src/assistant/AssistantPanel.tsx`,
  `apps/desktop/src/editor/ChapterEditor.tsx`,
  `apps/desktop/src/features/story/manuscript/SelectionActionMenu.tsx`,
  `apps/desktop/src/features/story/navigation/StoryReferenceSidebar.tsx` and
  `apps/desktop/src/platform/bridge.ts`.

Acceptance-only changes add the deterministic conflict fixture, capture script,
three screenshots and machine-readable metrics.

## Automated verification

The canonical acceptance command was run with Node `24.14.0`, matching the
repository's `>=24 <25` engine contract.

| Check | Result |
| --- | --- |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Vitest | 45 files, 131 tests passed |
| Vite production build | Passed, 2,704 modules |
| Rust formatting | Passed |
| Rust tests | 29 passed |
| Legacy compatibility | 10/10 passed, 0 blocking |
| Copied-project Markdown | 6/6 SHA-256 hashes unchanged |
| Windows Tauri release | Passed |
| NSIS installer | Passed |

Strict `cargo clippy --all-targets -- -D warnings` is not a Gate E acceptance
command. It currently reports 16 existing baseline style lints; the modified
Gate E Rust contracts add no new lint category. Rust formatting and all tests
pass.

## Windows build and run verification

Final Node 24 artifacts:

- `tmp/gate-e-target-final/release/writing-buddy-next.exe`
  - 6,870,016 bytes
  - SHA-256
    `B866B0C293EB6B093FA99E3DF9A04DFAD040465F79B31EBD5DF151A8B0136CFB`
- `tmp/gate-e-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,002,068 bytes
  - SHA-256
    `7CF2D2ADA829791C13D61FD2C4AAADAC97A5537D74C22BA3E43F9E32676962E9`

The first Gate E instance closed after `Alt+F4`; its target window disappeared
without force termination. The final Node 24 build then launched normally and
restored both the real copied project `脱敏测试作品 10` and the long-form
continuity page on the second start. The final Gate E instance remains running.

## Data compatibility

- The read-only compatibility contract still passes all 10 fixtures with zero
  blocking differences.
- The six Markdown files in
  `tmp/storyforge-gate-d-project-20260727` still match
  `fixtures/legacy-projects/10-full` byte-for-byte by SHA-256 after Gate E
  open, review persistence, close and second-launch recovery.
- Context packs, pending facts and continuity state live only in structured
  Story data or `.writing-buddy/`; manuscript content is never rewritten until
  the author accepts an edit.

## Visual and layout acceptance

The deterministic browser fixture mirrors the copied project's Story data and
adds one explicit impossible-overlap conflict so the list, two-source evidence
view and resolution actions are visible:

- [Continuity review, 1536×992](./screenshots/gate-e/01-continuity-review-1536x992.png)
- [Continuity review, 1280×800](./screenshots/gate-e/02-continuity-review-1280x800.png)
- [Continuity review, 1024×720](./screenshots/gate-e/03-continuity-review-1024x720.png)

All three captures have zero page-level horizontal and vertical overflow. The
page root fills the available 852px, 660px and 580px workspace heights. At
1024px, the detail area moves below the issue list and uses the remaining
workspace as its own vertical scroll surface instead of leaving a short strip
and a large blank region.

Selector readiness ranged from 218ms to 552ms; complete reload and capture
readiness ranged from 617ms to 979ms. Machine-readable measurements are in
[`gate-e-visual-metrics.json`](./gate-e-visual-metrics.json).

The 1024px metric counts descendants intentionally clipped inside the
scrollable workspace, but the document itself remains at zero X/Y overflow.
Gate F's large-project indexing and scale benchmarks are intentionally not run
before Task 21.

## Known issues and boundary

- A user-provided DeepSeek key is still required to validate the real
  `/models`, balance, streaming, cancellation and automatic-review network
  workflow. Browser mocks and fixed-host Rust contract tests pass.
- The Windows linker prints an informational Chinese “creating library”
  warning; release and installer generation finish successfully.
- Large-project indexing, performance gates, recovery drills, accessibility
  sweep and final acceptance are Tasks 21–24 in Gate F and remain untouched.

## Recommendation

Approve Gate E and then begin Task 21. Do not begin Gate F until this report,
screenshots, commits and compatibility evidence receive explicit human
approval.
