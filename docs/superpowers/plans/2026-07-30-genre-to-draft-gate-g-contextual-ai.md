# Genre-to-Draft Gate G — Contextual AI drafting plan

Date: 2026-07-30

Baseline: `3ae3b0e1 feat: optimize editor for outline guided drafting`

Commit target: `feat: connect contextual ai to scene drafting`

## Scope

Complete Gate G only:

- show a low-weight Continue entry when a chapter cursor is at a paragraph end
  and no text is selected;
- reuse `continue-paragraph` for both free and author-guided continuation;
- reuse strict `three-directions` and `finish-scene` actions;
- keep generated output in the existing right AI panel as candidates;
- show insertion location, grounded context, candidate rationale and a
  manuscript diff;
- require explicit Insert or Reject;
- save current manuscript state, create a
  `beforeDestructiveOperation` snapshot, and only then insert;
- keep Monaco-native Undo and provide one safe panel Undo;
- temporarily highlight AI-inserted text and remove the source highlight after
  later author editing or a bounded timeout;
- prevent same-tick duplicate generation;
- preserve cancellation input and never auto-start another AI request.

Gate H chapter organization and plan-vs-draft reconciliation are excluded.

## Existing modules to reuse

- `ContextualActionResolver` for local selection/cursor action choice.
- `ManuscriptContinuationPanel` and `ManuscriptContinuationService`.
- `SelectionRewritePanel` and `SelectionRewriteService`.
- `GroundedAiRunner`, the existing DeepSeek provider, cancellation and
  streaming state machine.
- `ContextPackBuilder` and Story Kernel scene/character/location context.
- `CandidateDiffView`.
- `desktopBridge.createSnapshot`.
- `requestEditorEdit`, Monaco `executeEdits`, native editor Undo, workspace
  assistant state and Gate F tool rail.

No new AI provider, action family, manuscript store, scene model or snapshot
system will be introduced.

## TDD sequence

1. Add failing unit tests for paragraph-end detection and contextual Continue.
2. Add failing continuation-service tests for diff construction, stale-safe
   Undo and one-candidate rejection behavior.
3. Add failing panel tests for:
   - optional author guidance in the Context Pack;
   - exactly one request after rapid repeated generation clicks;
   - three distinct candidate cards;
   - insertion location and grounding disclosure;
   - diff toggle;
   - snapshot-before-insert ordering;
   - insertion blocked when snapshot creation fails;
   - reject without document mutation;
   - safe Undo after the editor applies the candidate.
4. Add failing editor/store tests for AI edit metadata and temporary
   decoration behavior.
5. Implement the smallest shared hooks and UI needed for the tests.
6. Run targeted tests, TypeScript and ESLint.
7. Run real browser acceptance at 1024×720, 1280×800 and 1536×960, including
   guided continuation, candidate review, reject, insert, highlight and Undo.
8. Run release self-test, package portable/NSIS EXEs, smoke the native window,
   archive hashes/screenshots/report, and commit Gate G separately.

## Safety contracts

- AI requests contain only the bounded manuscript/scene source plus author-
  selected, non-secret Context Pack items.
- Author-secret items remain excluded by default and are disclosed as not
  sent.
- Candidate generation never mutates the manuscript.
- Snapshot failure blocks insertion.
- A candidate becomes stale after revision or anchor changes.
- Panel Undo refuses to overwrite author edits made after insertion.
- No AI candidate automatically triggers a subsequent request.
- Existing locked outline/scene structure is never changed.

## UX contracts

- Continue remains secondary to manuscript writing.
- Candidate actions are at least 44 px and keyboard reachable.
- Exactly one right-side candidate panel is visible.
- Loading, streaming, cancelled, failed, stale, accepted and rejected states
  have explicit text.
- Motion stays within existing 180 ms tokens and respects reduced motion.
- 1024 px layouts retain a readable 680 px manuscript when the panel is
  closed; the on-demand panel does not create page overflow.
