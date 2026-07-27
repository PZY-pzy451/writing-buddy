# 003 — Phase 1.0A AI foundation acceptance, 2026-07-27

## Outcome

The automated Phase 1.0A gates passed. Writing Buddy now has a scoped
DeepSeek BYOK foundation with Windows Credential Manager storage, fixed-host
Rust networking, model and balance checks, cancellable streaming, anonymous
usage accounting, and a StoryForge-only test surface.

AI output remains candidate text. Phase 1.0A cannot write project content,
reviews, versions, snapshots, or backups. No real DeepSeek credential was used
during automated acceptance.

## Environment

- Windows, `x86_64`
- Node.js `24.14.0`
- pnpm `10.32.1`
- Rust stable with the MSVC toolchain
- Branch: `codex/phase-1.0a-deepseek-ai-foundation`

## Automated gates

| Gate | Result |
| --- | --- |
| ESLint | Passed, zero warnings |
| TypeScript | Passed |
| Vitest | 8 files, 21 tests passed |
| Vite production build | Passed |
| Rust unit tests | 14 passed |
| Rust formatting | Passed |
| Tauri production build | Passed; EXE and NSIS bundle produced |
| Packaged smoke | Release EXE stayed alive for 5 seconds and was stopped cleanly |
| Diff hygiene | `git diff --check` passed |

## Security and privacy evidence

- The React layer has scoped AI commands and cannot issue arbitrary provider
  requests or read a saved key.
- DeepSeek HTTPS endpoints exist only in the Rust adapter. Redirects are
  disabled and the base URL is not configurable.
- The Credential Manager target is exactly
  `WritingBuddy/AI/DeepSeek/default`; key material is not persisted in project
  files, settings, logs, or diagnostics.
- The Rust request contract accepts exactly the fixed StoryForge system
  instruction and one user prompt. It does not accept project paths or project
  content.
- Incremental SSE parsing covers LF and CRLF frames, split UTF-8, comments,
  usage, `[DONE]`, size limits, and cancellation.
- `reasoning_content` is consumed only to emit a generic thinking state and is
  never forwarded to the UI or persisted.
- Prompts and responses remain in memory only. Persistence is limited to
  non-sensitive settings, a 24-hour provider-model cache, and monthly
  anonymous usage JSONL.
- Repository scanning found no `sk-…` or long `Bearer` credential pattern.

## Product workflow evidence

- Settings exposes separate Appearance and AI & Models tabs.
- AI & Models supports save-and-validate, connection testing, explicit key
  deletion, model selection, thinking mode, maximum-token preferences,
  balance, and anonymous usage.
- AI Test supports streaming, stop, copy, clear, terminal states, usage, and a
  visible privacy boundary.
- Starting a new generation replaces and cancels the active job. Closing or
  deleting the provider also cancels active work.
- Packaged-app visual inspection covered the global AI Test entry, settings
  states, StoryForge surface, and disconnected-key state. The inspection found
  cramped system-page chrome; system pages now hide the task dock and
  assistant column. Focused UI tests and the final production build passed
  after that correction.

## Production artifacts

- EXE:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 6,696,960 bytes
  - SHA-256:
    `1aea0cfb402e0aa0e5f096b2f04dd65235b14e31863c9970a4f1739f3139d2cd`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 2,913,351 bytes
  - SHA-256:
    `293aa719f8be95ae12f2b610b663bfefab5c8fc99e1325e13b9cf1003250b8e2`

## Open manual gates

A user-provided real DeepSeek key is still required to record live `/models`,
`/user/balance`, streaming, cancellation, restart, and key-deletion behavior.
Those gates are intentionally not simulated or waived.

The existing M9 human cutover sessions also remain open. Legacy must remain
available as the rollback source until M9 is complete.
