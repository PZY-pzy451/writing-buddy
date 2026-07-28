# AI Quick Actions Gate D — Characters and Relationships

Date: 2026-07-27
Status: accepted

## Goal

Complete original Tasks 12–14 with dedicated author-review workflows:

- generate a character, background, arc, or speech style;
- extract characters and grounded dossier facts from one explicitly selected chapter;
- generate relationships or extract relationship changes;
- write nothing until the author confirms individual fields or edges.

The implementation keeps the existing dependency direction:

`React page -> application review service -> Story Kernel repository / state ports -> Rust bridge`.

## Frozen safety boundaries

- AI requests use two fixed Rust-validated job purposes:
  `character-analysis` and `relationship-analysis`.
- Requests contain one bounded chapter body, its Story chapter ID and revision,
  an explicit action type, and sanitized existing identities. They never contain
  project roots, absolute paths, credentials, API keys, or hidden history.
- Generated candidates stay transient and are never presented as saved data.
- Manuscript evidence must match the exact JavaScript UTF-16 range and quote.
  Invalid or ambiguous evidence blocks the affected field or edge.
- A normalized title/alias match is a merge candidate, never an automatic
  overwrite. Existing non-empty, unequal values are visible conflicts and are
  deselected by default.
- Confirmation re-reads the target resource and checks its revision before
  creating a project snapshot and saving. Only checked fields or edges are
  written.
- Relationship direction is explicit. `A -> B` and `B -> A` may have different
  types, strengths, visibility and descriptions.

## Character contract

Actions:

- `generate-character`: exactly three complete character candidates;
- `generate-background`: one candidate for the selected character;
- `generate-arc`: one candidate for the selected character;
- `generate-speech-style`: one candidate for the selected character;
- `extract-from-chapter`: up to twelve grounded character candidates.

Every response candidate has a title, optional role, confidence, rationale and
field candidates. A field candidate is one of:

- dossier fields: aliases, summary, pronouns, birth, appearance, occupation,
  goals, desires, fears, values, speech style;
- dynamic state fields: location, life status, health, emotion, current goal,
  inventory, knowledge, misconception, ability.

Each field contains a typed value and an optional evidence anchor. Extraction
requires evidence for every field. `inventory` is the extracted item view and
`knowledge` is the extracted knowledge view; accepted values become confirmed
character state records at the selected chapter position instead of silently
creating unrelated resources.

Candidate deduplication uses normalized title and aliases. The service merges
duplicate AI candidates field-by-field, preserves the strongest confidence,
and reports the duplicate count.

## Relationship contract

Actions:

- `generate-relationship`: generate directed relationship candidates between
  selected characters;
- `extract-relationship-changes`: extract only changes grounded in the selected
  chapter.

Each candidate contains source and target character IDs, relationship type,
strength, visibility, description, rationale, confidence, story position and
optional evidence. Extraction requires exact evidence.

Pending candidates are rendered as dashed arrowed edges. Selecting a candidate
opens edge-level review. Accepting one candidate creates or explicitly updates
one formal directed Relationship resource after a snapshot and revision check.

## Page UX

- Character Center adds a primary **AI 人物助手** entry and an empty-state
  **用 AI 创建人物** action.
- The review surface uses the existing warm-paper visual language, Lucide
  icons, minimum 44 px interactive targets, keyboard focus, visible
  loading/error/stale/accepted states and responsive single-column fallback.
- Chapter selection is explicit and shows the exact source title before a
  request starts.
- Evidence buttons open the source chapter and reveal the anchored manuscript
  offset through the existing editor navigation mechanism.
- Relationship Graph adds **AI 关系助手**. Pending edges stay visually distinct
  from formal data until acceptance.

## Test and acceptance order

1. Add failing schema tests for both AI response contracts and Rust request
   validation.
2. Add failing service tests for exact candidate counts, deduplication,
   conflicts, evidence anchoring, stale revisions and selected-only apply.
3. Add page tests for empty-state entry, three candidates, explicit chapter
   source, evidence navigation and dashed relationship edges.
4. Run TypeScript, smallest Vitest targets, full `pnpm acceptance`, Rust format
   and tests.
5. Capture responsive browser evidence at 1536, 1280 and 1024 px using the
   sanitized browser fixture.
6. Rebuild and smoke-test the Windows release with `CARGO_BUILD_JOBS=1`, then
   record durable acceptance evidence.
