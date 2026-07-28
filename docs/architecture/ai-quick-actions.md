# AI Quick Actions architecture and extension guide

## Stable layers

AI Quick Actions preserve this dependency direction:

`React surface → feature application service → @writing-buddy contracts → platform port → Rust adapter`

Do not call Tauri from a domain package and do not add a second provider,
streaming, usage, snapshot, or Story Kernel write path.

## Gate G actions

| Action ID | Fixed job purpose | Output | Apply policy |
| --- | --- | --- | --- |
| `manuscript.organize` | one `story-kernel-generation` job per chapter | `ManuscriptExtractionRun` v1 plus existing generation batches | selected resources, snapshot-backed |
| `review.crossChapterConsistency` | `story-consistency-analysis` | `StoryConsistencyReviewIssues` v1 | ReviewIssue only, severity ≤ warning |

The high-level definitions live in
`packages/ai-actions/src/action/AiActionRegistry.ts`. The runtime message and
strict response contracts live in `packages/ai/src/index.ts`; Rust mirrors the
allowed request shape in `apps/desktop/src-tauri/src/ai/mod.rs`.

Prompt/template metadata for both actions is version 1:

- `story-kernel.generation` → existing Story Kernel generation prompt/schema;
- `story.consistency.analysis` → fixed
  `STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT`, request `schemaVersion: 1`.

The feature pages use the existing fixed-purpose message builders directly
because they orchestrate multiple explicitly selected sources and retained
per-chapter batches. The shared action registry remains the discoverable
capability and policy catalog.

## Adding an Action

1. Add a literal `AiActionId`, category, availability rule, input/output
   schemas, output schema name/version, context policy and apply policy.
2. Register it exactly once in `createDefaultAiActionRegistry`.
3. Add a fixed `AiJobType` and exact system Prompt. Never accept a caller
   supplied system Prompt.
4. Define a strict TypeScript request/response parser. Reject unknown fields,
   unknown IDs, invalid exact evidence, unbounded text and secret-shaped keys.
5. Mirror the accepted request shape and bounds in Rust with
   `deny_unknown_fields`.
6. Build context from explicit user scope. Default
   `includeAuthorSecretsByDefault` to `false`.
7. Stage output as candidates or ReviewIssues. AI output must not bypass
   revision checks, deterministic validation, snapshots or atomic commits.
8. Add cancellation, timeout, stale-source, invalid-response and restart
   tests before exposing the UI entry.
9. Add accessible loading, disabled, error and success states, 44px effective
   targets, visible focus, independent scrolling and reduced motion.
10. Record typecheck, focused tests, full acceptance, Rust, privacy, visual,
    native smoke and artifact hashes under `docs/acceptance`.

## Extraction ledger

`ManuscriptExtractionRunStore` owns the versioned operational ledger:

`.writing-buddy/ai/extraction-center/index.json`

It retains at most 20 runs and 1,000 chapter entries per run. Running state is
normalized to stopped/interrupted on load. Loading never invokes a provider.
Writes use the existing atomic text port and expected hash; concurrent changes
surface as stale writes instead of being overwritten.

`ManuscriptExtractionRunner` loads and processes one chapter at a time. Stream
deltas are sampled for UI progress and are never persisted. A resume skips
completed and stale chapters.

## Cross-chapter ReviewIssue mapping

`parseStoryConsistencyAnalysisResponse` verifies:

- 2–4 distinct evidence references per issue;
- only selected chapter IDs;
- exact JavaScript UTF-16 slices for every quote;
- only previously supplied Story Facts;
- no replacement field;
- AI error severity capped to warning.

`ReviewIssue.relatedEvidence` and `storyFact` are optional and backward
compatible. `ContinuityReviewRepository` maps them to the existing Continuity
Engine. Story Facts use evidence kind `story-fact` and intentionally have no
“open manuscript” action.
