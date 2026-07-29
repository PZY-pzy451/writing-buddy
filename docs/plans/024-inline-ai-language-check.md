# Inline AI language check

Updated: 2026-07-29

## Outcome

Add an author-controlled inline spelling and grammar check to the Monaco
manuscript editor. Clear language errors appear as native editor squiggles,
carry an explanation on hover, and may expose an undoable replacement without
turning stylistic preferences into noisy diagnostics.

## Product contract

- The feature is off by default and never starts a network request merely
  because the application or a project opened.
- The editor exposes a persistent **AI 语法检查** control. Enabling it clearly
  explains that only a bounded changed paragraph is sent to the configured
  DeepSeek provider after the author stops typing.
- Initial enable and explicit retry inspect only the paragraph containing the
  cursor. Later edits inspect the changed paragraph after a 1.2-second idle
  window.
- Each request contains at most 2,400 JavaScript UTF-16 code units. Long
  paragraphs are reduced to a bounded sentence-aware window around the edit.
- Requests run one at a time. A newer edit cancels the stale request. Exact
  slices are cached locally for the session, and retryable provider failures
  enter a cooldown instead of silently looping.
- The dedicated AI contract reports only clear spelling, typo, grammar,
  collocation, punctuation, or duplicated-word errors. Pure tone, imagery,
  pacing, and optional polishing advice are excluded.
- Every returned target is verified against the submitted slice. Ambiguous or
  mismatched targets are discarded before they can become editor markers.
- Results are rebased onto the current full manuscript and rendered as Monaco
  markers. Hover text contains the title, explanation, and optional
  replacement.
- A replacement is applied only after an explicit author action and uses
  Monaco's edit stack, so normal Undo restores the source text.
- Editing invalidates or reanchors prior findings. Results from a stale slice
  revision are never painted onto newer text.
- Unconfigured providers and failures remain non-blocking and expose a clear
  recovery path; ordinary typing and saving continue to work.

## Implementation slices

1. Add a bounded inline-language AI prompt, job type, response parser, native
   validation, and TypeScript/Rust prompt-parity coverage.
2. Add deterministic changed-paragraph slice planning, rebasing, issue merging,
   cancellation, caching, and error cooldown.
3. Add a persisted opt-in preference, editor control, Monaco markers, hover
   copy, and explicit undoable replacement actions.
4. Add deterministic browser-fixture coverage for a misspelling such as
   `somthing`, unit/integration tests, responsive visual acceptance, production
   build, and native packaging/close verification.

## Acceptance

- With the feature disabled, typing produces no AI request and no network
  status change.
- With the browser fixture configured and the feature enabled, typing
  `somthing` produces an inline squiggle on that exact word after the debounce.
- Hover identifies an English spelling error and offers `something` as the
  replacement.
- Applying the replacement changes only the verified marker range; Undo
  restores `somthing`.
- Rapid edits cancel stale work and only the latest slice may update markers.
- A repeated unchanged slice is served from cache without an additional
  provider request.
- TypeScript, lint, frontend tests, Rust tests, production build, responsive
  Paper/Midnight browser checks, Tauri packaging, and isolated native close all
  pass.
