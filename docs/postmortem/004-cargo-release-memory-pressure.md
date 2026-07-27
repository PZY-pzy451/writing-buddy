# Cargo release build exhausted memory

Date: 2026-07-27

## Incident

A cold `pnpm tauri:build` in a new Cargo target directory used the default
parallel job count and exhausted available Windows memory. Several compiler
processes then reported misleading dependency and prelude errors because
intermediate metadata was incomplete.

Retrying in another cold directory with `CARGO_BUILD_JOBS=1` avoided the memory
spike, but the full serial dependency build exceeded the command time window
twice before reaching the application link.

## Impact

- No source or author data was changed.
- TypeScript, Rust tests, and the application code were not the cause.
- Release evidence was delayed by repeated dependency compilation.

## Resolution

The final build used:

- `CARGO_BUILD_JOBS=1`;
- the known-clean, previously accepted release dependency cache at
  `tmp/ai-quick-actions-gate-c-target-final`;
- a fresh application compile, link, NSIS bundle, artifact hashes, and
  normal-close smoke.

The resulting EXE and installer timestamps and hashes changed, confirming that
the current source was packaged.

## Prevention

- On this workstation, run release/Tauri builds with `CARGO_BUILD_JOBS=1`.
- Prefer a known-clean incremental target for consecutive gates on the same
  dependency graph.
- Never reuse a target directory after a compiler OOM or incomplete metadata
  error.
- Treat large cascades of missing `core`, prelude, `Option`, or `Result`
  symbols after an OOM as corrupted build-state symptoms, not application
  source failures.
- Keep `cargo test` and `cargo fmt --check` as independent source-validity
  gates before release packaging.
