# AI Quick Actions Gate G acceptance

Date: 2026-07-28

Branch: `codex/ai-quick-actions-gate-g`

## 1. Reused AI modules

- Existing DeepSeek provider, fixed-purpose jobs, SSE lifecycle, cancellation,
  public error taxonomy, aggregate usage and credential storage.
- Existing `story-kernel-generation` contract and
  `StoryKernelGenerationService` candidate/conflict/transaction path.
- Existing `ReviewIssue`, Continuity Engine, snapshots, versions, backup and
  restore ports.

No second provider, model client, stream parser, credential store or formal
Story Kernel write path was introduced.

## 2. New public modules

- `ManuscriptExtractionRunStore` and `ManuscriptExtractionRunner`.
- `ManuscriptExtractionCenterPage`.
- `StoryConsistencyAiPanel` and safe Story Fact builder.
- Strict TypeScript/Rust `story-consistency-analysis` request boundary.
- Backward-compatible `ReviewIssue.relatedEvidence` and `storyFact`.

## 3. Action list

| Action ID | Purpose | Output |
| --- | --- | --- |
| `manuscript.organize` | sequential chapter-to-Story-Kernel extraction | retained run plus existing pending candidate batches |
| `review.crossChapterConsistency` | grounded 2–12 chapter comparison | ReviewIssues with evidence A/B and optional Story Fact |

## 4. UI entry points

- **资料 → AI 正文整理**: scope/types, preflight Token estimate, per-chapter
  start/stop/resume, retained progress, conflict filters and snapshot-backed
  confirmation.
- **资料 → 一致性审查 → AI 对照审查**: selected sources, privacy boundary,
  cancellation and grounded result creation.

Both surfaces use Lucide icons, visible labels/focus, 44px effective targets,
independent scrolling, disabled/loading/error/success states and reduced
motion.

## 5. Context Pack behavior

- Extraction sends exactly one explicitly planned chapter per paid job and
  known non-secret Story Kernel identities.
- Consistency sends 2–12 explicitly selected chapters, one author instruction
  and at most 500 safe Story Facts.
- Aggregate consistency source content is capped at 160,000 characters and
  the serialized payload at 220,000 characters.
- Unselected chapters, paths, credentials, logs, hidden history, character
  secrets, secret relationships, hidden foreshadowing meanings and
  author-secret information are excluded.

## 6. Schema and Prompt versions

- `ManuscriptExtractionRun`: schema version 1.
- `story-kernel.generation`: existing fixed Prompt/response version 1.
- `story.consistency.analysis`: fixed
  `STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT`, request schema version 1,
  output `StoryConsistencyReviewIssues` version 1.
- TypeScript and Rust reject unknown fields, invalid limits and secret-shaped
  keys. Response parsing rejects unknown source/fact IDs and non-exact UTF-16
  evidence.

## 7. Automated tests

| Command / suite | Result |
| --- | --- |
| Extraction, consistency, review and Action focused suites | passed |
| `pnpm acceptance` | lint, typecheck, 75 files / 241 tests, Vite build passed |
| `cargo fmt --check` | passed |
| `cargo test` | 44 passed / 0 failed / 2 explicit manual gates ignored |
| `git diff --check` | passed |

Covered failures include offline/provider failure, cancellation, timeout,
invalid JSON, stale source, explicit retry, restart normalization without a
provider call, concurrent ledger writes, atomic apply failure and retained
completed batches.

## 8. Project acceptance

Automated validation used only the repository's sanitized `browser-fixture`
project:

- planned and completed a three-chapter extraction;
- staged 18 candidate cards without formal writes;
- produced one cross-chapter AI finding with exact evidence A/B and one safe
  Story Fact;
- reopened persisted state without automatic paid continuation;
- ran the existing professional-slice snapshot/restore/backup/restart test.

The freshly packaged native application launched, stayed responsive for five
seconds with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally. A non-sanitized author project was intentionally not written.

## 9. Performance

- The 1,000-chapter ledger planning/persistence test completes under 500ms and
  keeps serialized metadata below 450KB without manuscript text.
- Runtime retains one chapter source and one provider response at a time.
- Stream deltas update sampled UI progress and are never persisted.
- Visual selector readiness was 956–1,517ms across the four fresh captures.

## 10. Privacy scan

- Ledger serialization tests prove manuscript excerpts, `projectRoot` and
  `apiKey` are absent.
- Safe Story Fact tests prove author-secret information, character secrets,
  secret relationships and foreshadowing `trueMeaning` are absent.
- Request builders reject unknown/secret-shaped fields.
- Source and production `dist` scans for private-key, bearer-token and common
  API-key shapes returned no matches.
- Rust usage/preferences tests continue to verify aggregate-only metadata and
  no credential persistence.

## 11. Snapshot, Undo and Restore

- Formal candidate confirmation creates a snapshot before each chapter batch.
- Existing Story transactions keep every candidate pending if an atomic commit
  fails.
- The professional-slice acceptance restores the pre-change snapshot, restarts
  from backup, moves an item to recoverable trash, restores the backup and
  verifies the original snapshot exactly.
- AI consistency has no apply/write path and manuscript Undo remains separate.

## 12. Known issues and manual gates

- A real DeepSeek key was not used; provider quality, billing, balance and
  account-specific model behavior remain a user-account gate.
- A real author project was not mutated. The repository requires sanitized
  fixtures or an explicit project copy.
- The shell uses Node 25.2.1 while the repository requests Node 24. pnpm emits
  an engine warning; all validation and packaging still passed.
- The two existing Rust real-project/release performance gates remain
  explicitly ignored in the normal suite.

## 13. Git commits and tags

- Branch: `codex/ai-quick-actions-gate-g`.
- A release tag is intentionally not created: version remains `0.1.0` and the
  real-key/human quality gates are still open.
- Final commit IDs and remote push are recorded by Git history after this
  report is committed.

## 14. Completion definition

Gate G meets the automated completion definition for original Tasks 22–25:
batch scope/Token planning, explicit paid execution, restart-safe resume,
unified conflict candidates, snapshot-backed author confirmation, grounded
cross-chapter ReviewIssues, privacy/performance/recovery hardening,
responsive UI, user/developer documentation and fresh Windows packaging are
complete.

Manual provider-quality and non-sanitized author-project checks remain clearly
separate and do not weaken the application's no-auto-write/no-auto-billing
guarantees.

## Visual evidence

- [Extraction preflight at 1536](./screenshots/gate-ai-actions-g/01-extraction-plan-1536x960.png)
- [Completed run and candidates at 1280](./screenshots/gate-ai-actions-g/02-extraction-candidates-1280x768.png)
- [Consistency evidence A/B and Story Fact at 1536](./screenshots/gate-ai-actions-g/03-consistency-evidence-1536x960.png)
- [Single-column extraction center at 1024](./screenshots/gate-ai-actions-g/04-extraction-responsive-1024x688.png)
- [Machine-readable visual metrics](./gate-ai-actions-g-visual-metrics.json)

| Viewport / workflow | Page overflow X/Y | Clipped controls | Controls below 44px |
| --- | ---: | ---: | ---: |
| 1536×960 extraction preflight | 0 / 0 | 0 | 0 |
| 1280×768 completed extraction | 0 / 0 | 0 | 0 |
| 1536×960 consistency evidence | 0 / 0 | 0 | 0 |
| 1024×688 responsive extraction | 0 / 0 | 0 | 0 |

## Windows artifacts

- Portable EXE:
  `tmp/ai-quick-actions-gate-g-target-final/release/writing-buddy-next.exe`
  - 7,216,640 bytes
  - SHA-256:
    `96E089A88E214BBE739D953E479E18AE9126FD490C3141F794B7BF8FE91EACE2`
- NSIS installer:
  `tmp/ai-quick-actions-gate-g-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,126,592 bytes
  - SHA-256:
    `1924E4A41B6B4535089744518F2C53F711655BD4F498752974AF1666AB7FD062`
