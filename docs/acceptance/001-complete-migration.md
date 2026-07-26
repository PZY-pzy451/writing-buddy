# 001 — Complete migration acceptance

## Automated gates

- [x] Exact dependency lockfiles committed
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `cargo test`
- [x] `pnpm tauri:build`
- [x] Compatibility fixtures produce expected summaries and hashes
- [x] Corrupted and unsafe-path fixtures fail without writes
- [x] Atomic save rejects an external disk change
- [x] Review accept can be undone and stale issues are detected
- [x] Backup inspection rejects path traversal and bad checksums
- [x] Logs contain neither manuscript text nor secrets

## Desktop gates

- [x] Open a copied Legacy project
- [x] Edit Chinese text and save
- [x] Preserve LF/CRLF and BOM state
- [x] Restart and restore tabs, chapter, cursor and scroll
- [x] Switch Paper/Midnight/Fog/Focus and restart
- [x] Open chapter, note, character, worldbuilding and timeline resources
- [x] Run local review, accept, undo, ignore and restore
- [x] Create, inspect and restore snapshot/backup
- [x] Configure AI key in Windows Credential Manager
- [x] Confirm no Legacy process writes the same project copy
- [x] Close app and confirm process/memory release

## Human cutover gates

- [ ] 30 real writing sessions without data loss
- [ ] 10 close/restart recoveries
- [ ] 3 backup restores
- [ ] 3 version restores
- [ ] No critical defects

Legacy retirement is forbidden until the human cutover gates are recorded.

Evidence: [002 desktop acceptance, 2026-07-26](./002-desktop-acceptance-2026-07-26.md).
The independent client and exact lockfiles are published on
`codex/initial-writing-buddy-next`. Human cutover gates remain intentionally
open.
