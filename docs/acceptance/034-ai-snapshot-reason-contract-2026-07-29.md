# AI snapshot reason contract acceptance

Date: 2026-07-29

## Outcome

AI-generated Story Kernel resources can again create their mandatory safety
snapshot and proceed to author-confirmed writes. The reported character
failure was not malformed candidate data: feature-local snapshot reason
strings were rejected by the native snapshot command before the write
transaction began.

All AI pre-write snapshot paths now use the canonical
`beforeDestructiveOperation` reason while retaining feature-specific
human-readable labels.

## Contract coverage

- `DesktopBridge.createSnapshot` and the shared AI apply port accept
  `SnapshotReason` instead of an arbitrary string. Invalid feature-local values
  now fail TypeScript validation.
- Story Kernel direct generation, scene planning, character, item,
  worldbuilding, relationship, timeline, plot, manuscript extraction, and the
  shared AI preview-apply service use the same canonical reason.
- The existing Rust and `@writing-buddy/version` six-value allowlists remain
  unchanged; no second AI-specific reason taxonomy was introduced.
- Snapshot creation remains ordered before repository confirmation. A rejected
  snapshot performs no resource write and leaves the candidate in
  **待确认**.
- The direct Story Kernel panel translates `invalidSnapshotReason` into
  **安全快照参数不兼容，候选尚未写入。请更新应用后重试。** instead of
  displaying the native error code.

## Automated gates

| Gate | Result |
| --- | --- |
| Runtime | Node 24.14.0 / pnpm 10.32.1 |
| Focused Vitest | 2 files / 11 tests passed |
| `pnpm acceptance` | ESLint, TypeScript, 105 files / 373 tests, and production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 52 passed / 2 explicit external gates ignored / 0 failed |
| `pnpm tauri:build` | Fresh release EXE and NSIS installer built |
| Isolated native startup/normal close | PID 40632; input-idle; responsive; title `Writing Buddy`; `CloseMainWindow` true; exit code 0 |

Regression coverage asserts that a valid character candidate calls the native
bridge with `beforeDestructiveOperation` and the label
`AI Story Kernel 生成前` before its repository commit. A second test rejects
the snapshot with `invalidSnapshotReason` and verifies localized feedback,
zero repository writes, and a still-pending candidate.

## Browser interaction evidence

The in-app browser exercised the local production-shaped application with its
deterministic AI fixture and no real provider credential or author project.

- The assistant **内核** tab generated seven valid pending candidates,
  including a character, location, item, timeline event, relationship, plot
  thread, and information permission.
- The panel reported **7 个可确认** and enabled
  **创建快照并确认 7**.
- One confirmation created the safety snapshot and moved all seven candidates
  from **待确认** to **已写入**.
- No raw `invalidSnapshotReason` appeared.
- Browser logs contained only Vite connection and React development
  information; warning and error entries were absent.
- The disposable browser tab was closed after acceptance.

## Windows artifacts

- Portable EXE:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,616,512 bytes
  - SHA-256:
    `65184128272EB25072196F1DF7EA5BCDFE9A53B7BC742BD1CB72DF0D20D13239`
- NSIS installer:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,424,724 bytes
  - SHA-256:
    `3106BAF1A0B0F604BA5C3611CE0AFD44FDEB7DCDE35EF14B3C2D2AD58B492897`
