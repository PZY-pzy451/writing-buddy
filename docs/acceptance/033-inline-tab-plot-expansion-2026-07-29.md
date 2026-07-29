# Inline Tab plot expansion acceptance

Date: 2026-07-29

## Outcome

Writing Buddy now provides an opt-in, editor-native fiction continuation
preview. After an eligible chapter edit and a 2.4-second pause at a complete
sentence end, the application requests one bounded continuation and renders it
as Monaco ghost text. The manuscript remains unchanged until the author
presses **Tab** or chooses the mouse acceptance action.

## Privacy and reliability contract

- The persisted preference is off by default.
- Application and project open do not start a request, including when a
  returning author previously enabled the preference.
- Automatic requests require a writable chapter, a collapsed selection, at
  least 24 non-whitespace source characters, and a complete sentence end.
- Each request contains only the text before the cursor, capped at 4,000
  JavaScript UTF-16 code units. Text after the cursor, paths, credentials, and
  hidden request history are excluded.
- The implementation reuses the existing TypeScript/Rust
  `manuscript-continuation` contract with thinking disabled and a 512-token
  output limit.
- Inline grammar checking has priority over plot expansion. The plot request
  waits instead of replacing an active grammar job.
- New edits cancel stale work. Exact completed contexts use a 32-entry session
  cache, and retryable failures enter a ten-second cooldown.
- Returned content must still match the exact resource, source document, and
  cursor anchor before the Monaco provider exposes it.

## Editor behavior

The editor toolbar exposes **Tab 拓展 关/开/Tab** and a portalled details
dialog. Status icons and text distinguish waiting, grammar-priority pause,
generation, ready, setup-required, and failure states without relying on color
alone. The dialog discloses the 2.4-second and 4,000-unit bounds and offers
mouse alternatives for both acceptance and rejection.

The Monaco inline-completion contribution is explicitly loaded by the
application bootstrap. Development dependency optimization excludes Monaco so
the editor API and contribution share one command registry; this keeps native
ghost-text rendering, `Tab` acceptance, and `Esc` hiding available in the
standalone build.

`Tab` acceptance is detected from the Monaco content-change event before the
controlled editor state updates. Both LF and Windows CRLF insertions are
recognized, so acceptance does not immediately schedule another paid request.
The insertion remains one normal Monaco edit and `Ctrl+Z` restores the exact
source.

## Automated gates

| Gate | Result |
| --- | --- |
| Runtime | Node 24.14.0 / pnpm 10.32.1 |
| `pnpm acceptance` | ESLint, TypeScript, 105 files / 372 tests, and production build passed |
| `cargo fmt -- --check` | Passed |
| `cargo test` | 52 passed / 2 explicit external gates ignored / 0 failed |
| `pnpm tauri:build` | Fresh release EXE and NSIS installer built |
| Isolated native startup/normal close | PID 47868; input-idle; responsive; title `Writing Buddy`; `CloseMainWindow` true; exit code 0 |

Unit coverage includes sentence-end eligibility, mid-line and active-selection
rejection, 4,000-unit source bounding, UTF-16 surrogate safety, exact cache
reuse, prompt construction, result normalization, accessible toggle/status
copy, keyboard disclosure, and read-only behavior.

## Browser interaction evidence

The in-app browser exercised the local application with its deterministic AI
fixture and no real provider credential or author project.

At 1280x720 in Paper:

- the default state displayed **Tab 拓展 关**;
- enabling the stored preference and reloading produced no automatic request;
- typing `雨声忽然停了。` at the chapter end first waited for the enabled
  grammar check, then produced one `.ghost-text` candidate;
- the exact preview was
  `钟声越过雨幕，林越抬起头，循着雾里忽明忽暗的信号灯走向站台尽头。`;
- the manuscript count remained 100 while the preview was visible;
- `Tab` inserted it once, changed the displayed count to 129, removed the
  ghost node, and displayed **已插入，可用 Ctrl+Z 撤销**;
- `Ctrl+Z` restored the 100-count source and regenerated the cached preview;
- `Esc` removed the preview while leaving the manuscript at 100;
- with no preview, `Tab` followed the ordinary editor path instead of
  inserting the AI candidate.

Paper and Midnight both rendered the toolbar and 360px portalled dialog
without clipping at 1280x720. A final stable reload began at
`2026-07-29T02:14:36.243Z`; subsequent browser warning and error logs were
empty.

The fixture manuscript was restored to its original 94 characters, Paper was
restored, both inline preferences were returned to their default-off state,
and the deterministic provider credential existed only inside the disposable
browser fixture.

## Windows artifacts

- Portable EXE:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,616,512 bytes
  - SHA-256:
    `35BCEE9D52F32446EBBEECD5FDBC74409C60F9DBC2E7C04F2A07ADD0E6F21197`
- NSIS installer:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,424,768 bytes
  - SHA-256:
    `7302E55B0F1F39214082EAA8F252E30B46900C2C1D629AF5733944CD7C0ED3E1`
