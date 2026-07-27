# 006 — Window close regression acceptance, 2026-07-27

## Outcome

The Windows release can close normally again. The defect was reproduced against
the previous canonical EXE and verified against a newly rebuilt EXE and NSIS
bundle.

## Root cause

`App.tsx` registers Tauri `getCurrentWindow().onCloseRequested(...)` so an
unsaved editor session can ask the author for confirmation. In Tauri 2.11.1,
the JavaScript listener calls `window.destroy()` after the handler returns
without `event.preventDefault()`.

The main-window capability contained only `core:default`.
`core:window:default` deliberately excludes `allow-destroy`, so the close
listener's final IPC command was rejected and the native window remained open.

The fix grants only:

```text
core:window:allow-destroy
```

to the existing `main` window capability. No broader shell, filesystem or
network permission was added.

Reference:
[Tauri `onCloseRequested`](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/#oncloserequested)

## TDD evidence

The new Rust capability test initially failed with:

```text
onCloseRequested calls window.destroy(), so the main window needs allow-destroy
```

After the capability change, the focused test passed.

## Automated gates

| Command | Exact result |
| --- | --- |
| `pnpm acceptance` using Node 24.14.0 | ESLint and TypeScript passed; Vitest 12 files / 37 tests; Vite build passed |
| `cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml` | Passed |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | 20 passed / 0 failed; 0 doc tests |
| `pnpm tauri:build` using Node 24.14.0 | Release EXE and NSIS bundle passed |

## Real Windows close evidence

Previous release:

- The title-bar Close button was invoked on the visible Writing Buddy window.
- After 1.5 seconds the same window still existed, with no unsaved-content
  confirmation dialog.

Rebuilt release:

- A separate acceptance instance was launched with an isolated WebView profile.
- Probe PID: `23728`
- A normal Windows termination signal was sent without `/F`.
- Four seconds later the probe process no longer existed.

This uses the same native close request that previously left the old release
running. The user's currently focused Writing Buddy window was not touched
after user activity was detected.

## Rebuilt artifacts

- `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 6,716,928 bytes
  - SHA-256:
    `71B08CC14588D8F2C895D878FC53EDA150A5934ED471D7AAFBA909DA1F70D6F1`
- `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 2,922,724 bytes
  - SHA-256:
    `9BD2EFDB75D17E5DC2859C0B734EC1D2F5EBB962728CC6B4AF2CA167019D4F12`

## Changed files

- `apps/desktop/src-tauri/capabilities/default.json`
- `apps/desktop/src-tauri/gen/schemas/capabilities.json`
- `apps/desktop/src-tauri/src/lib.rs`

Gate A remains stopped for human approval. This correction does not begin
Story Kernel work.
