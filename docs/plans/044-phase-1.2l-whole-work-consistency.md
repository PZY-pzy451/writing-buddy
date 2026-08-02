# Phase 1.2L — Whole-work consistency pass

Updated: 2026-08-02

## Outcome

Turn the existing long-form consistency engine into a clear Check workflow.
Authors can enter it from the primary Review Center, choose a bounded manual
comparison or one whole-work pass, understand the number and privacy boundary
of AI requests, stop safely and receive one author-reviewed result set without
any automatic manuscript or Story Kernel write.

## Priority decision

The comparison uses the remaining Phase 1.2 market candidates and a normalized
cohort of 100 target authors per quarter. RICE is
`Reach × Impact × Confidence ÷ Effort`.

| Candidate | Lens | RICE calculation | Score |
| --- | --- | --- | ---: |
| One-click whole-work consistency pass | Enabler | `45 × 2 × 0.60 ÷ 3` | 18 |
| Scene plot grid | Enabler | `55 × 2 × 0.60 ÷ 4` | 16.5 |

The scores differ by 9%, so they are effectively tied. Both are Enablers with
the same confidence; whole-work consistency wins the tie because its native AI
contract, evidence validation and durable review repository already exist. The
cycle can close a primary navigation and execution gap with lower delivery
risk than adding a new planning model.

## Gate A — honest bounded batch plan

- Keep the existing per-request contract: 2–12 non-empty chapter sources,
  160,000 aggregate characters and no oversized individual chapter.
- Plan consecutive batches in manuscript order. Retain the preceding chapter
  at batch boundaries when it fits so adjacent continuity is still comparable.
- Skip empty/scaffold-only chapters visibly, cap a whole-work pass at eight AI
  requests and fail before the first AI call if the complete written work
  cannot be covered within the published boundary.
- Deduplicate grounded results from overlap chapters before exposing them.

## Gate B — task path and author control

- Add one visible whole-work consistency action to the primary Check page; the
  compatibility route in Planning remains available.
- In the comparison panel, distinguish `全书扫描` from `自选章节`; do not call AI
  until the author presses the explicit start action.
- Show covered/skipped chapters, maximum request count and that results are
  suggestions only. Never imply that every possible non-adjacent pair is
  exhaustively compared.
- Use a synchronous in-flight guard as well as disabled UI so rapid repeated
  clicks cannot start duplicate AI jobs.

## Gate C — atomic result handoff

- Run whole-work batches sequentially and report batch progress.
- Accumulate findings in memory. Stop, cancellation or any failed batch leaves
  the existing review set unchanged; only a fully successful pass replaces the
  prior AI-continuity subset.
- Preserve the existing warning severity ceiling, exact evidence validation,
  safe Story Fact filtering and author status workflow.

## Gate D — evidence and release

- Cover batch boundaries, overlap, empty chapters, oversize rejection, request
  caps, deduplication, atomic handoff and duplicate-click protection.
- Verify keyboard focus, 44 px controls, narrow-panel layout, no horizontal
  overflow and no clipped or occluded actions in the real browser surface.
- Run TypeScript, focused tests, complete self-tests, Tauri/NSIS packaging and
  native portable smoke before delivery.
