# Empty chapter drafting and promotional video polish

Status: complete

## Goal

Improve the real Writing Buddy workflow before recording a new promotional
video. A newly materialized chapter must be able to start from its first
confirmed scene without showing a false "no manuscript before the cursor"
error. The new recording must then demonstrate that corrected path without
error states or misleading edits.

## Product contract

- A chapter that contains Writing Buddy scene scaffolding but no prose is an
  opening-draft state, not a continuation failure.
- For paragraph continuation and three-direction generation, resolve the
  insertion target to the first scene anchor when the cursor has no prose
  before it.
- Build the AI context from the confirmed chapter/scene scaffold and state
  explicitly that no prior prose exists.
- Keep the existing safety boundary: generation creates candidates only;
  author confirmation or the inline draft controls perform the write.
- A truly empty, unplanned document gets a calm, actionable message instead
  of a technical failure.
- Use provider-neutral progress copy so the product remains truthful when the
  configured model changes.
- Preserve normal continuation, finish-scene, stale-candidate, snapshot and
  undo behavior.

## Verification

- Add unit coverage for detecting scaffold-only chapters, resolving the first
  writable scene position, preserving a normal cursor and handling a truly
  empty chapter.
- Add component coverage proving that a cursor at offset zero creates an
  inline opening candidate at the first scene anchor and does not write
  automatically.
- Run focused tests, desktop typecheck, lint, the relevant full automated
  suite and a production build with the repository's Node 24 runtime.
- Exercise the real interface in the in-app browser and verify that the
  corrected state has no console errors.

## Video contract

- Record the real Writing Buddy application from a fresh project through
  project creation, premise, outline, materialization, AI-assisted drafting,
  author confirmation and final project overview.
- The recording must show the corrected opening-draft path and contain no red
  error state, loading skeleton used as a result shot, fake success, or
  hidden automatic manuscript write.
- Create a concise main cut with synchronized Chinese captions, visible
  interaction focus, readable control crops, an early outcome preview and a
  final call to action.
- Add an audio track only from locally generated or otherwise provenance-safe
  material.
- Validate duration, streams, black/frozen frames, key visual checkpoints and
  caption timing before delivery.

## Delivery

- Update `docs/progress.md` and `docs/memory/2026-07-31.md`.
- Produce a fresh runnable Windows build after the software changes.
- Put the optimized video and its caption/verification artifacts in the
  existing promotional artifact family.
- Commit the implementation, tests, documentation and reproducible recording
  scripts. Generated binaries and media remain release artifacts.

## Outcome

- Product behavior, automated regression coverage and real in-app acceptance
  are complete.
- The polished 1:42 promotional video, narration, captions, contact sheet and
  build manifest are in
  `artifacts/promo/zero-to-complete-novel-polished-2026-07-31/`.
- The production portable executable, NSIS installer and SHA-256 manifest are
  in `artifacts/release/empty-chapter-promo-polish-2026-07-31/`.
- Acceptance evidence is recorded in
  `docs/acceptance/059-empty-chapter-drafting-promo-polish-2026-07-31.md`.
