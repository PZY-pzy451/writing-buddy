# Story Kernel scene grounding repair

Updated: 2026-07-28
Status: Active

## Observed failure

A real Story Kernel generation returned one high-confidence `scene` candidate,
but the candidate could not be selected or confirmed:

- the AI evidence range did not match its quote;
- the candidate omitted `chapterId`;
- the candidate omitted `manuscriptRange`;
- the candidate omitted `narrativeOrder`.

The UI correctly blocked the write, but the author had no recovery path even
though the application already owned the authoritative chapter, source range,
source revision, and existing scene order.

## Root cause

The direct-generation boundary asks the model to repeat positional scene
fields that must be derived from local manuscript state. The staging service
then validates the returned resource without enriching those fields.

Evidence anchoring also accepts only the model's exact offsets. A correct,
unique quote is discarded when the model returns stale or approximate
indices, even though it can be re-anchored deterministically without inference.

## Outcome

1. Keep the model responsible for scene title, summary, participants,
   locations, plot links, and other semantic fields.
2. Derive `chapterId`, `manuscriptRange`, manuscript revision, and
   `narrativeOrder` from the exact source range sent by the application.
3. Use the current selection when one exists; otherwise bind a scene candidate
   to the complete current-chapter source sent to the model.
4. Re-anchor an AI evidence quote only when it occurs exactly once in the sent
   source text.
5. For a scene candidate whose AI evidence remains invalid or absent, create a
   truthful local evidence reference to the authoritative source range instead
   of trusting the model's offsets.
6. Block create candidates when the authoritative range overlaps an existing
   scene or when one source range produces multiple new scene candidates.
7. Preserve strict schema, reference, collision, revision, snapshot, atomic
   commit, and author-confirmation boundaries.
8. Explain in the UI that scene position is locally grounded and advise
   selecting complete scene prose when the whole chapter is too broad.

## Verification

1. TypeScript compilation before focused tests.
2. Service regression matching the reported missing fields and mismatched
   evidence range.
3. Unique-quote recovery, ambiguous-quote rejection, overlap rejection,
   multiple-scene rejection, persistence, and confirmation tests.
4. Panel test for the local-grounding explanation and a confirmable repaired
   scene candidate.
5. Complete `pnpm acceptance`.
6. Rust formatting and complete Rust tests to prove no native regression.
7. Responsive Paper/Midnight browser evidence for the repaired candidate.
8. Fresh one-job Tauri Release/NSIS build and isolated native startup/normal
   close.

## Stop line

- Never accept an AI-provided project path, manuscript revision, chapter ID,
  or scene range as authoritative.
- Never guess between repeated evidence quotes.
- Never create overlapping scene ranges.
- Never write a candidate before explicit author selection, safety snapshot,
  fresh revision checks, and schema validation.
- Do not send an automatic paid repair request.
- Do not read or expose a real API key or author manuscript during automated
  verification.
