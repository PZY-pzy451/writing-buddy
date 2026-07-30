# Browser acceptance must be serialized and preflighted

Date: 2026-07-30

## Incident

The Phase 1.2B Edge acceptance and native Genre-to-Draft acceptance were
started in parallel. The web acceptance had no server listening on its
expected port and left an Edge profile file briefly locked during cleanup.
The native runner also used its default worktree-local EXE path while the
fresh Release lived in the shared Cargo target, so its process exited before
the WebView target appeared.

## Impact

- No author project or credential was read, changed, or deleted.
- Product tests and builds were unaffected.
- The two acceptance runs had to be repeated after their prerequisites were
  established, adding several minutes to release verification.

## Resolution

- Started the Vite target on the exact expected port and ran Phase 1.2B alone.
- Built an acceptance-only Tauri executable with the repository's fixed local
  CDP configuration, passed its exact path to the native runner, and ran it
  only after the web runner had closed.
- Rebuilt once more with the ordinary production configuration so the final
  portable and NSIS artifacts do not expose a debugging port.

## Prevention

- Treat browser/CDP acceptance runners as exclusive even when their nominal
  ports differ; run them serially on this workstation.
- Before launching, verify the expected HTTP/CDP port, executable path, and
  profile directory contract.
- For native CDP acceptance, build with `tauri.acceptance.conf.json`; do not
  assume a production WebView will honor an ad-hoc debug environment flag.
- Always finish with an ordinary production `tauri:build` before copying
  release artifacts.
