# Running release artifact blocked the Windows bundle

Date: 2026-07-27
Status: resolved without interrupting the user

## What happened

`pnpm tauri:build` compiled the frontend and Rust release target, then failed
when Cargo tried to replace
`apps/desktop/src-tauri/target/release/writing-buddy-next.exe`.
Windows returned access denied because that exact executable was open in a
user-owned Writing Buddy window.

## Impact

The first release attempt spent about one minute compiling before the lock was
reported. Source, user projects, and the running application were unchanged.

## Recovery

The process path and start time were inspected read-only. Because the process
was not created by the current validation run, it was left running. The build
was repeated with an isolated `CARGO_TARGET_DIR`, producing a verified release
EXE and NSIS installer without touching the open canonical artifact.

## Durable rule

Before a Windows release build:

1. Inspect whether the exact canonical release EXE is running.
2. Never terminate a user-owned window solely to make packaging succeed.
3. Ask the user to close it when canonical artifacts must be replaced, or use a
   task-scoped `CARGO_TARGET_DIR` when build verification is sufficient.
4. Record clearly whether the canonical artifact or an isolated artifact was
   validated.
