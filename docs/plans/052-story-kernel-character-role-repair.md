# Story Kernel character role repair

Updated: 2026-08-02

## Problem

Real AI generation can return a structurally complete character with `role`
expressed as Chinese text, a descriptive label, different casing or a
space/underscore variant. `role` is optional, but strict Story Kernel parsing
currently blocks the whole candidate instead of repairing or dropping that one
optional value.

Persisted blocked create candidates also need to become confirmable after the
application is upgraded, without regenerating or editing project files by hand.

## Contract

1. The TypeScript and native prompts explicitly require
   `protagonist|antagonist|supporting|minor` for character `role`.
2. Before strict resource validation, recognized English and Chinese aliases
   are mapped to the canonical enum.
3. Empty, null or unrecognized textual roles are omitted because the field is
   optional; the resource's author-grounded fields remain unchanged.
4. Non-text values remain invalid and visible so unsafe structural corruption
   cannot be silently accepted.
5. The same normalization runs when persisted candidates are loaded, allowing
   previously blocked create candidates to recover without a new AI request.

## Verification

- Package-level parser tests cover Chinese, casing, underscore and unknown-text
  repair while retaining a non-text failure.
- Service tests stage, confirm and persist a repaired character and reopen a
  previously blocked candidate.
- Prompt parity, focused frontend tests, TypeScript and full self-test pass.
- A new production portable and installer are built and smoke-tested.
