# Phase 1.0B — System layout and AI review follow-up

Date: 2026-07-27
Status: automated acceptance passed

## Outcomes

1. Search, Review, Versions, AI Test, and Settings use the complete center
   workspace instead of inheriting the editor header row or a capped scrolling
   surface.
2. System-page scrollbars stay at the workspace edge. Readable content remains
   centered inside a shared responsive content boundary.
3. Review offers two explicit modes:
   - manual local review, which never sends text to a provider;
   - AI automatic review, which sends only the current chapter after a direct
     author action.
4. Both modes produce review issues. Neither mode edits manuscript text
   automatically; Accept and Ignore remain author decisions.

## Layout contract

- Editor pages keep resource tabs, the writer header, manuscript canvas,
  optional assistant, and task dock.
- System pages render only one full-height canvas row under the application
  top bar.
- The system-page scroll owner is full width and full height. Individual page
  sections share a `1440px` readable-content maximum and responsive padding.
- The layout must not create nested page-level scrolling or leave a scrollbar
  in the middle of a wide screen.
- Controls keep a minimum `44px` target, visible keyboard focus, and existing
  theme tokens.

## AI review contract

- Job purpose is explicit: `storyforge-test` or `chapter-review`.
- Rust validates a fixed system prompt for each purpose.
- Chapter review accepts one JSON user message containing only
  `schemaVersion` and the current chapter `content`; unknown fields, paths,
  project metadata, and arbitrary system prompts are rejected.
- The provider returns a JSON object. Each candidate issue is validated against
  the source text before it becomes a `ReviewIssue`.
- Private reasoning is discarded in Rust as before.
- Prompt, response, and reasoning are memory-only. Usage records contain only
  provider, model, job purpose, duration, status, and token counts.
- Starting another AI job replaces the active job. The review UI exposes Stop.

## Verification

- TypeScript compilation before tests.
- Focused AI/review and application-shell tests.
- Rust validation and usage-record tests.
- Complete `pnpm acceptance` and `cargo test --lib`.
- Desktop visual checks at wide and compact viewport sizes, including all
  system-page routes and both review modes.
