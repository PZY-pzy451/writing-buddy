# Story Kernel structural defaults repair

Status: complete

## Reported failure

An AI-generated item candidate can contain valid title, evidence and rationale
but omit the required `unique` and `restrictions` fields. The candidate is then
visible but blocked by Story Kernel schema diagnostics and cannot be confirmed.

## Contract

- Keep strict Story Kernel validation and the author-confirmation boundary.
- Normalize only structurally neutral omissions; never invent prose, IDs,
  references, positions or story facts.
- A newly generated item with no explicit uniqueness decision uses the same
  conservative default as the existing item extraction flow: `unique: false`.
- A missing item restriction list becomes `[]`; an explicit list is preserved.
- Missing required reference arrays that semantically mean “none provided” may
  become `[]` for scenes and timeline events.
- Invalid IDs, wrong scalar types, missing semantic text and forbidden system
  fields remain blocked or isolated.
- Strengthen both TypeScript and native Rust prompt copies so the model is told
  not to omit item defaults.

## Verification

- Parser regression for an item missing `unique` and `restrictions`.
- Service regression proving the repaired item is normalized and confirmable.
- Negative coverage proving explicit values and genuinely malformed fields are
  not overwritten.
- Focused tests, full TypeScript/ESLint/Vitest/build gates, Rust format/tests,
  Tauri Release/NSIS and a production portable smoke.

## Delivery

- Update acceptance evidence, progress and daily memory.
- Produce refreshed Windows portable and installer artifacts.
- Commit the repair and its tests.

## Outcome

- Type-aware neutral normalization and prompt hardening are complete.
- Parser, service, negative and visible UI confirmation regressions pass.
- Production Windows artifacts are in
  `artifacts/release/story-kernel-structural-repair-2026-07-31/`.
- Acceptance evidence is recorded in
  `docs/acceptance/060-story-kernel-structural-defaults-2026-07-31.md`.
