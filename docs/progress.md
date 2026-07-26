# Current progress

Updated: 2026-07-26

## Active milestone

M8 automated migration acceptance is complete for the independent Tauri +
React client. Production EXE and NSIS artifacts are built. M9 human cutover
remains open and Legacy remains the rollback source. The initial client is
published on `codex/initial-writing-buddy-next`.

## Completed

- Independent client architecture and Legacy schema compatibility reader
- Safe Rust filesystem, process lock, Credential Manager, snapshots and backup
- Monaco desktop render fix (`freezePrototype: false`)
- Immutable session/store refresh after edits, saves and reloads
- Real copied-project desktop acceptance
- Node 24 / pnpm 10 / TypeScript / Vitest / Vite / Cargo / Tauri build gates
- Durable evidence in `docs/acceptance/002-desktop-acceptance-2026-07-26.md`
- Initial Git branch and exact JavaScript/Rust lockfiles

## Open

- Human cutover gates are intentionally not automated.
- Legacy retirement is forbidden until M9 is complete.

## Next

Run real writing sessions against project copies and record each
recovery/restore result before deciding whether to retire Legacy.
