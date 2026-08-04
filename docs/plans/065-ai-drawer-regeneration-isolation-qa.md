# AI drawer regeneration isolation QA

Date: 2026-08-04

## User risk

Starting a new generation from an existing preview records a new author intent,
but the Store currently clears only the raw output before awaiting provider
status and preferences. The old job ID, parsed candidate and preview transaction
remain present during that wait. Delayed events from the completed job can then
revive old output, and a configuration or bridge failure can leave the old
candidate structurally actionable under a failed new attempt.

## Contracts

1. A new generation attempt synchronously clears the previous job ID, metadata,
   usage, parsed output, preview transaction, repair instruction and raw output
   before the first asynchronous provider check.
2. Delayed delta, completed, failed, cancelled and usage events from the prior
   job are ignored while the new attempt validates context.
3. Missing configuration and provider-status/preference exceptions expose only
   the new localized failure, never the superseded preview.
4. One hundred same-tick regenerate actions perform one provider validation and
   start at most one fresh job.
5. A successful new job receives a distinct ID and produces the only actionable
   preview.

## Execution

- Add delayed-event, provider-failure and same-tick pressure contracts before
  changing Store behavior.
- Invalidate prior terminal artifacts in the synchronous start boundary while
  preserving definition, input, scope and the frozen Context Pack.
- Run drawer, context, App, AI, session and save impact tests followed by full
  Node 24 and Rust acceptance.
- Keep product status `PARTIAL` while traceability, real-provider smoke and
  packaging gates remain open.

## Result

- Before the implementation change, five new contracts failed because the old
  job metadata, parsed output and preview transaction remained visible during
  replacement validation.
- The Store now invalidates all superseded stream and candidate state before
  the first provider await. Delayed delta, usage, failure, cancellation and
  completion events from the old job are ignored.
- Missing configuration, provider-status failure and preference failure keep
  the superseded preview inaccessible and expose only a redacted new error.
- One hundred same-tick regeneration actions perform one replacement provider
  validation and start one distinct replacement job.
- Focused regression: 3 files / 46 tests passed.
- Impact regression: 10 files / 142 tests passed.
- Full frontend acceptance: lint, TypeScript, 179 files / 876 tests and the
  production build passed.
- Rust baseline: 79 tests discovered, 77 passed, 2 environment-gated tests
  ignored and 0 failed.
- Execution status is `PASS`; product status remains `PARTIAL` for the
  explicitly open release gates above.
