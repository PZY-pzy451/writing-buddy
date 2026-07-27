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

Use Node.js 24 and pnpm 10.32.1:

```powershell
node --version
pnpm --version
```

Install, verify and compile:

```powershell
pnpm install --frozen-lockfile
pnpm acceptance
pnpm tauri:build
```

Run the desktop app during development:

```powershell
pnpm tauri:dev
```

Run the compiled application:

```powershell
& '.\apps\desktop\src-tauri\target\release\writing-buddy-next.exe'
```

The Windows installer is generated at:

```text
apps\desktop\src-tauri\target\release\bundle\nsis\Writing Buddy_0.1.0_x64-setup.exe
```

See [migration status](docs/migration/001-status.md) and the
[acceptance checklist](docs/acceptance/001-complete-migration.md).
