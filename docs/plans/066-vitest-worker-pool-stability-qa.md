# Vitest worker-pool stability QA

Date: 2026-08-04

## User risk

The complete frontend suite passed once with 179 files and 876 tests, but the
fixed-commit baseline then exposed two fork-pool failures on Windows and Node
24: one worker exited unexpectedly after 178 files, and a subsequent run did
not terminate within four minutes. A release report must not depend on retries
that hide unexecuted tests.

## Contracts

1. The supported Vitest configuration uses a bounded two-worker thread pool.
2. All 180 frontend files and every discovered runtime test execute.
3. The process exits normally without fork-worker errors or a lingering child.
4. Lint, TypeScript, production build and Rust acceptance remain green.
5. The generated baseline is bound to the commit containing the stable pool.

## Execution

- Reproduce the default fork-pool failure and preserve its observed counts.
- Run the same suite with `--pool=threads --maxWorkers=2` before changing the
  configuration.
- Add a configuration contract so the supported pool cannot silently regress.
- Re-run the complete fixed-commit frontend and Rust baselines.

## Result

- Default fork run 1: 178/179 files and 869 tests completed before one worker
  exited unexpectedly; seven tests were not executed.
- Default fork run 2: the runner did not terminate within 240 seconds and was
  stopped by the bounded QA command.
- Pre-change thread-pool proof: 179/179 files and 876/876 tests passed and the
  process exited normally in 153.8 seconds.
- The supported configuration now pins `pool: 'threads'` with two workers and a
  dedicated regression contract.
- Post-change acceptance: lint, TypeScript, 180/180 files, 877/877 tests and the
  production build passed; the process exited normally in 212.2 seconds.
