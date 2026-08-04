# AI drawer terminal command-result isolation QA

Date: 2026-08-04

## User risk

Stream events and native command Promises complete independently. A generation
can already be in preview, failed or cancelled when the original start command
rejects, or when a pending Stop command rejects. Those late command failures
still match the current job and can replace the terminal result or attach an
error to a valid preview, preventing the author from continuing normally.

## Contracts

1. A late start-command rejection cannot replace preview, failed or cancelled
   stream results from the same job.
2. A late cancellation-command rejection cannot attach an error to preview,
   failed or cancelled stream results from the same job.
3. One hundred same-tick Stop actions still produce one native cancellation
   command while the stream is active.
4. Active start and cancellation command failures remain localized, actionable
   and retryable; terminal isolation must not swallow legitimate live errors.
5. Parsed output, preview transaction, usage and the original terminal error
   remain unchanged after the late Promise settles.

## Execution

- Add controlled start and cancellation Promise runtimes before changing Store
  behavior.
- Cover the preview/failed/cancelled matrix and 100-action Stop pressure.
- Accept command failures only while their generation job remains active.
- Run Store/drawer/context/App/session/save/error impact tests, followed by
  fixed-commit Node 24 and Rust baselines.

## Release posture

Execution may pass while product status remains `PARTIAL` until strict
traceability, real-provider smoke and packaging gates are closed.

## Result

- Six contracts failed red: late start-command rejection replaced preview,
  failure and cancellation, while late Stop rejection polluted all three
  terminal results.
- Start-command failures are now accepted only while context validation or the
  stream remains active. Stop-command failures require the same job to remain
  queued, connecting or streaming.
- The preview/failed/cancelled matrices preserve state, output, parsed result,
  transaction, usage and error after each late Promise settles.
- One hundred same-tick Stop actions still issue one native cancellation. The
  existing active-failure contracts prove both commands remain localized and
  explicitly retryable before terminal state.
- Focused Store regression: 1 file / 46 tests passed.
- Impact regression: 10 files / 157 tests passed.
- Full frontend acceptance: lint, TypeScript, 180 files / 892 tests and the
  production build passed with no timer or worker leaks.
- Rust baseline: 79 tests discovered, 77 passed, 2 environment-gated tests
  ignored and 0 failed.
- Execution status is `PASS`; product status remains `PARTIAL` for the open
  release gates above.
