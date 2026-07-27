# Phase 1.0A source map

## Existing implementation

| Concern | Current source | Finding |
| --- | --- | --- |
| AI types/fake provider | `packages/ai/src/index.ts` | Selection-rewrite types and fake provider only |
| Platform boundary | `packages/platform-ports/src/index.ts` | Generic `aiComplete`; no stream/status/model/usage ports |
| Tauri bridge | `apps/desktop/src/platform/bridge.ts` | Non-streaming invoke plus browser fixture |
| Settings | `apps/desktop/src/settings/SettingsPage.tsx` | Key save/delete and legacy local/deepseek switch |
| AI surface | `apps/desktop/src/assistant/AssistantPanel.tsx` | Selection text can call deprecated non-streaming model |
| Rust AI | `apps/desktop/src-tauri/src/commands/mod.rs` | One `ai_complete` command using retired model IDs |
| Secret | `apps/desktop/src-tauri/src/secrets/mod.rs` | Generic keyring service, not the frozen target |
| App state | `apps/desktop/src/app/store.ts` | Persists `aiMode`, but no independent job state |
| Navigation | `GlobalRail.tsx` / `SystemPage.tsx` | No StoryForge runtime page |

## Target mapping

| Contract area | Target source |
| --- | --- |
| AI core contracts and policies | `packages/ai/src/index.ts` and focused tests |
| Typed bridge contract | `packages/platform-ports/src/index.ts` |
| In-memory job state | `apps/desktop/src/features/ai/stores/aiStore.ts` |
| Settings application/UI | `apps/desktop/src/features/ai/settings/` |
| StoryForge | `apps/desktop/src/features/ai/playground/` |
| Tauri bridge | `apps/desktop/src/platform/bridge.ts` |
| Rust commands/runtime | `apps/desktop/src-tauri/src/ai/commands.rs`, `runtime.rs`, `job_registry.rs` |
| DeepSeek adapter | `apps/desktop/src-tauri/src/ai/provider/deepseek.rs` |
| HTTP/SSE | `apps/desktop/src-tauri/src/ai/transport/` |
| Credential/persistence/redaction | `apps/desktop/src-tauri/src/ai/secret/`, `storage.rs`, `redaction.rs` |

## Compatibility decision

The local fake selection provider stays available, but Phase 1.0A removes the
networked selection path. DeepSeek network traffic is reachable only from the
StoryForge test request whose two messages are a fixed system prompt and the
text explicitly entered in that panel.
