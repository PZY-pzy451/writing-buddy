# Windows release delivery acceptance

Date: 2026-07-29

## Release source

- Source commit: `8ae09c86 test: add change-aware self-test framework`
- Runtime: Node 24.14.0 / pnpm 10.32.1 / Cargo 1.97.1
- Target: Windows x64
- Product version: 0.1.0

## Automated release gate

`pnpm self-test:release` completed successfully in 188.6 seconds and recorded
its ignored machine-readable report in `artifacts/self-test/latest.json`.

| Gate | Result |
| --- | --- |
| Latest-commit whitespace/conflict check | Passed |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest | 106 files / 382 tests passed |
| Production frontend build | Passed |
| Cargo formatting | Passed |
| Cargo tests | 52 passed / 2 explicit external gates ignored / 0 failed |
| Tauri Release build | Passed |
| NSIS packaging | Passed |

## Native executable smoke

The newly built portable executable was launched with an isolated
`WEBVIEW2_USER_DATA_FOLDER`.

- PID: 48808
- Reached input idle: yes
- Responsive: yes
- Window title: `Writing Buddy`
- `CloseMainWindow`: true
- Exited within the timeout: yes
- Exit code: 0

The smoke used no real author project and did not install or remove
application data.

## Delivery artifacts

### Portable executable

- Path:
  `artifacts/release/8ae09c86/Writing-Buddy-0.1.0-portable.exe`
- Size: 7,616,512 bytes
- Product/File version: 0.1.0
- SHA-256:
  `416CA8DA81AA398EF1EBE44BBB87B438DE0CBF5AD4AA17D7F64ADBE3F18E5700`

### NSIS installer

- Path:
  `artifacts/release/8ae09c86/Writing-Buddy-0.1.0-x64-setup.exe`
- Size: 3,424,531 bytes
- Product/File version: 0.1.0
- SHA-256:
  `1FA9EA731AC4EDA654199833D6C5648AAD3AF404678D63388325D52212FEA837`

Both delivery copies match their fresh Tauri build sources byte for byte.
Authenticode status is `NotSigned`; Windows SmartScreen may therefore require
an explicit confirmation. Code signing remains an external distribution
requirement and was not simulated.
