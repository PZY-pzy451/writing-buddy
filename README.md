# Writing Buddy Next

Writing Buddy Next is the independent Tauri 2 desktop client that replaces the
legacy Code-OSS shell while preserving Writing Buddy's on-disk project format.

## Safety model

- Open a copied project until cutover acceptance is complete.
- The browser UI never receives unrestricted filesystem access.
- Rust canonicalizes every project-relative path and performs atomic writes.
- Existing content is never overwritten when the expected disk hash changed.
- A project lock prevents two Next processes from writing the same copy.
- UI, window and theme state live in application storage, never in
  `.writing-buddy/project.json`.

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm tauri:dev
pnpm tauri:build
```

See [migration status](docs/migration/001-status.md) and the
[acceptance checklist](docs/acceptance/001-complete-migration.md).
