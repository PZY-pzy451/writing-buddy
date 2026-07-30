# Story Kernel generation resilience

Status: complete
Updated: 2026-07-30
Branch: `codex/phase-1.2c-guided-development`

## Problem

Story Kernel generation can fail with
`invalidStoryKernelGenerationResource` when one AI candidate omits common
resource arrays or returns a genuinely incomplete resource. A rapid repeated
click can also start the generation path more than once before React renders
the busy state. The resulting raw validation message is incorrectly described
as an AI settings or connection problem.

## Outcome

- A synchronous per-panel guard admits at most one generation request.
- Missing `aliases`, `tags`, and `evidenceIds` are normalized to empty arrays.
- No semantic field, identity, title, relation, or story fact is invented.
- Each candidate is validated independently. A malformed candidate is isolated
  while valid candidates remain available for author review.
- A fully malformed response creates no batch and is shown as a response
  structure problem with a safe retry action.
- Raw schema paths never become the primary user-facing guidance.

## Safety boundary

All generated content remains pending until author confirmation. Response
normalization may only add the three schema-default empty arrays. Invalid
candidates, snapshots, repository writes, and existing Story Kernel resources
are not mutated. Transport, authentication, rate-limit, cancellation, and
settings failures retain their existing classifications.

## Verification

- Parser tests cover repairable omissions, partial isolation, and strict safe
  diagnostics.
- Service tests cover persisted partial batches and reload.
- Component tests cover two same-tick clicks, partial malformed output, and a
  fully malformed response.
- Real Edge acceptance covers rapid clicks, one network fixture call, repaired
  candidate visibility, malformed candidate isolation, localized guidance,
  and absence of raw schema/settings copy.
- Complete frontend, native, release packaging, and executable startup gates
  must pass before delivery.

## Result

Completed on 2026-07-30. Real Edge acceptance admitted one request for two
same-tick clicks, preserved eight valid or locally repairable candidates,
isolated the malformed ninth candidate, exposed no raw schema/settings copy,
and recorded zero browser exceptions. Release self-test, NSIS packaging, and
portable executable startup/normal-close verification passed.
