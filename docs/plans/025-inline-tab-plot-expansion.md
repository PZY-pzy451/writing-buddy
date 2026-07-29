# Inline Tab plot expansion

Updated: 2026-07-29

## Outcome

Add an opt-in, Copilot-style fiction continuation preview to the Monaco
manuscript editor. After the author pauses at a complete sentence, Writing
Buddy may show a grounded continuation as ghost text. `Tab` accepts the
visible preview, `Esc` rejects it, and ordinary `Tab` indentation remains
unchanged when no preview is visible.

## Product contract

- The feature is off by default. Opening the application or a project never
  starts a request merely because a returning author enabled it previously.
- Enabling **Tab 情节拓展** or choosing an explicit retry may inspect the
  current cursor location. Later previews are generated only after a content
  edit and a 2.4-second idle window.
- Automatic generation requires a collapsed selection, a writable chapter,
  at least 24 non-whitespace source characters, and a cursor at the end of a
  complete sentence or paragraph. Moving the cursor never starts a request.
- A request contains one explicit inline-continuation instruction and at most
  4,000 JavaScript UTF-16 code units immediately before the cursor. It contains
  no project path, credential, hidden history, or text after the cursor.
- Reuse the existing `manuscript-continuation` TypeScript/Rust prompt contract,
  DeepSeek credential store, native streaming boundary, and JSON validation.
  Inline generation uses thinking-disabled mode and a 512-token output limit.
- Inline grammar checking has priority over plot expansion because the native
  runtime permits one active AI job. A pending plot request waits while grammar
  checking is active instead of cancelling it.
- New edits, selection changes, cursor movement, resource/project changes,
  disabling, and `Esc` cancel or invalidate stale work. Exact completed
  contexts are cached for the application session, and retryable failures use
  a cooldown rather than silently looping.
- Returned content is a suggestion only. It must still match the exact source
  document and cursor anchor before Monaco can display it.
- Monaco's native inline-completion surface renders the ghost text. `Tab`
  accepts only while that preview is visible; otherwise Monaco retains its
  normal indentation behavior.
- Acceptance is a normal Monaco edit and participates in Undo. Acceptance
  itself does not immediately trigger another paid continuation request.
- A visible editor control and AI Settings disclosure expose enablement,
  waiting, checking, ready, setup-required, and failure states. Mouse actions
  provide accessible alternatives for accepting or rejecting a preview.

## Implementation slices

1. Add deterministic eligibility/source planning, bounded context creation,
   caching, streaming, cancellation, and response normalization.
2. Add a persisted opt-in and hook that coordinates with the existing inline
   grammar job.
3. Register a resource-scoped Monaco inline-completion provider, enable native
   ghost text, wire `Tab`, `Esc`, mouse actions, and Undo-safe acceptance.
4. Add editor and Settings UI, responsive Paper/Midnight styles, deterministic
   browser fixture evidence, and user documentation.

## Acceptance

- With the feature disabled or on project open, no continuation request starts.
- After an eligible edit and idle window, a one-candidate continuation appears
  as ghost text without modifying the manuscript.
- `Tab` inserts the exact preview once; `Ctrl+Z` restores the source text.
- `Esc` removes the preview without changing the manuscript.
- Without a visible preview, `Tab` keeps its ordinary editor behavior.
- Cursor movement or subsequent typing prevents stale output from appearing.
- Frontend tests, lint, typecheck, production build, Rust tests, responsive
  Paper/Midnight browser checks, Tauri packaging, and isolated native close
  all pass.
