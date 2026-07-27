# Current AI and StoryForge capability matrix

Updated: 2026-07-27

Status values:

- `complete`: implemented, tested and used by the current application.
- `partial`: a usable vertical slice exists but the quick-action adapter is not
  yet registered.
- `shell`: a page or contract exists without the requested AI behavior.
- `missing`: no current implementation.

| Capability | Status before Gate A/B | Canonical implementation | Gate A/B decision |
|---|---|---|---|
| DeepSeek provider and fixed host | complete | `apps/desktop/src-tauri/src/ai/provider/deepseek.rs` | reuse unchanged |
| Streaming, cancellation and one active job | complete | `apps/desktop/src-tauri/src/ai/runtime.rs`, `job_registry.rs` | reuse unchanged |
| Credential Manager key storage | complete | `apps/desktop/src-tauri/src/secrets/mod.rs` | never expose to action/context layer |
| Model settings, connection test and balance | complete | `apps/desktop/src/features/ai/`, `apps/desktop/src/platform/bridge.ts` | reuse |
| Aggregate usage | complete | `apps/desktop/src-tauri/src/ai/storage.rs` | reuse metadata-only storage |
| AI test playground | complete | `apps/desktop/src/features/ai/stores/aiStore.ts` | preserve exact behavior; register its system prompt by reference |
| Chapter AI review | complete | `packages/ai/src/index.ts`, `reviewAutomationStore.ts` | becomes first unified-drawer runtime adapter |
| Selection rewrite with Diff / Undo | complete | `SelectionRewritePanel.tsx`, `SelectionRewriteService.ts` | migrate in Gate C, do not duplicate |
| AI fact extraction and author confirmation | complete | `PendingFactsReview.tsx`, `StoryExtractionService.ts` | future extraction adapter |
| Full Story Kernel generation | complete | `StoryKernelGeneratorPanel.tsx`, `StoryKernelGenerationService.ts` | future create-resource adapter |
| Action Registry | missing | — | implement in `packages/ai-actions` |
| Versioned Prompt Registry | missing | prompts currently live in `packages/ai/src/index.ts` | implement metadata/version registry; reference existing prompt unchanged |
| Generic structured-output validator | partial | action-specific Zod parsers in `packages/ai/src/index.ts` | add reusable strict JSON/fence validator |
| Generic context contract | partial | selection-specific P0-P6 pack in Story Kernel | adapt and extend without replacing it |
| Unified AI Drawer | missing | several feature-specific panels | implement one global drawer/store |
| Guarded generic preview transaction | partial | text Undo, Story transaction and snapshots exist separately | compose them behind ports |
| Project open / restore | complete | `ProjectOpenService`, Tauri project commands | no change |
| Chapter manuscript editor | complete | `ChapterEditor`, Monaco, `DocumentSession` | no Gate A/B write |
| Scene / manuscript links | complete | `features/story/manuscript/` | available as context source |
| Character profile and state | complete | `features/story/characters/`, Story Kernel model | action adapters later |
| Directed relationships / matrix | complete | `features/story/relationships/` | action adapters later |
| Story and narrative timelines | complete | `features/story/timeline/` | action adapters later |
| World locations, factions and rules | complete | `features/story/worldbuilding/` | action adapters later |
| Items and narrative assets | complete | `features/story/assets/` | action adapters later |
| Plot threads and foreshadowing | complete | `features/story/plots/` | action adapters later |
| Information / knowledge permissions | complete | `features/story/information/` | enforce author-secret exclusions now; adapters later |
| Long-form continuity review | complete | `features/story/continuity/` | can consume analysis actions later |
| Version snapshots and restore | complete | Tauri version commands and `DesktopBridge` | mandatory apply port |
| AI history containing manuscript/output | missing by design | — | keep missing; save metadata only |

## Suggested path to real path

| Handoff suggestion | Repository path |
|---|---|
| `packages/ai-actions/src/action/*` | same |
| `packages/ai-actions/src/prompt/*` | same |
| `packages/ai-actions/src/output/*` | same |
| `packages/ai-actions/src/context/*` | same, with Story Kernel adapter |
| `packages/ai-actions/src/apply/*` | same, using snapshot/write ports |
| `apps/desktop/src/features/ai/context/*` | same |
| `apps/desktop/src/features/ai/drawer/*` | same |
| `docs/plans/ai-quick-actions-source-map.md` | `docs/plans/002-ai-quick-actions-source-map.md` per repository numbering rule |
| `docs/plans/ai-current-capability-matrix.md` | `docs/plans/003-ai-current-capability-matrix.md` per repository numbering rule |

## Gate boundary

Gate A/B may expose `review.consistency` as the integration test action because
its fixed Rust job purpose, JSON response and author-review workflow already
exist. This does not authorize the editor, character, timeline, world or other
specific quick actions. Those remain unavailable with explicit reasons until
their later adapters are implemented.
