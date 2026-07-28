# AI Quick Actions source map

Updated: 2026-07-27

## Scope

This map freezes the baseline for
`Writing_Buddy_StoryForge_AI_Quick_Actions_Handoff_v1.0`. The first
implementation round is limited to Gate A and Gate B:

1. reusable action, prompt and structured-output contracts;
2. privacy-aware context composition;
3. one unified AI generation drawer;
4. guarded preview transactions.

Editor, character, relationship, world, timeline, item, plot and foreshadowing
actions remain future adapters. This round must not add a second provider,
transport, repository or AI history store.

## Baseline

Branch: `codex/ai-quick-actions-gate-ab`

Parent: `3af0462` (`feat: generate story kernel candidates with ai`)

| Gate | Result |
|---|---|
| `pnpm test` | 52 files, 153 tests passed |
| `pnpm typecheck` | passed |
| `pnpm lint` | passed |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | 35 passed, 2 release gates ignored |
| Runtime note | package requests Node 24; the shell used Node 25.2.1 and emitted an engine warning |

## Existing AI runtime

| Concern | Canonical path | Public contract / responsibility |
|---|---|---|
| TypeScript AI domain | `packages/ai/src/index.ts` | provider definition, job/request/event types, job state transitions, fixed prompts, request builders, response parsers |
| Desktop bridge | `apps/desktop/src/platform/bridge.ts` | `startAiGeneration(request, listener)`, `cancelAiJob(jobId)`, settings, models, balance and usage |
| Playground state | `apps/desktop/src/features/ai/stores/aiStore.ts` | isolated StoryForge test job and current provider preferences |
| Settings and test UI | `apps/desktop/src/features/ai/` | key configuration, provider verification, models, usage and test generation |
| Rust command boundary | `apps/desktop/src-tauri/src/ai/commands.rs` | Tauri commands for provider status, secrets, preferences, start/cancel and usage |
| Rust runtime | `apps/desktop/src-tauri/src/ai/runtime.rs` | one active DeepSeek stream, cancellation and event emission |
| Provider | `apps/desktop/src-tauri/src/ai/provider/deepseek.rs` | fixed-host HTTPS API, model/balance calls and SSE stream |
| Job isolation | `apps/desktop/src-tauri/src/ai/job_registry.rs` | cancels the previous job and prevents parallel paid work |
| SSE parsing | `apps/desktop/src-tauri/src/ai/sse_parser.rs` | incremental UTF-8/SSE parsing |
| Metadata storage | `apps/desktop/src-tauri/src/ai/storage.rs` | preferences, model cache and aggregate usage; no prompt or manuscript body |
| Secret storage | `apps/desktop/src-tauri/src/secrets/mod.rs` | Windows Credential Manager integration |

The new `@writing-buddy/ai-actions` package consumes the TypeScript contracts
above. It does not own credentials, HTTP, SSE, retry, cancellation, provider
selection or usage persistence.

## Existing context and candidate flows

| Concern | Canonical path | Reuse decision |
|---|---|---|
| P0-P6 context builder | `packages/story-kernel/src/query/ContextPackBuilder.ts` | adapt its selected-manuscript pack into the new generic context contract |
| Token policy | `packages/story-kernel/src/query/TokenBudgetPolicy.ts` | reuse token estimation and priority trimming |
| Existing context consent UI | `apps/desktop/src/features/story/ai-context/ContextPackPreview.tsx` | retain for selection rewrite; share visual and consent rules with the generic preview |
| Selection rewrite | `apps/desktop/src/features/story/ai-context/SelectionRewritePanel.tsx` | future Gate C adapter; no behavior change in Gate A/B |
| Story fact extraction | `apps/desktop/src/features/story/ai-context/PendingFactsReview.tsx` | future extraction adapter; no behavior change |
| Story Kernel generation | `apps/desktop/src/features/story/ai-context/StoryKernelGeneratorPanel.tsx` | future structured-resource adapter; keep its proven staging path |
| Generation staging | `apps/desktop/src/features/story/ai-context/StoryKernelGenerationService.ts` | reuse candidate validation and repository commit rules where concrete actions require them |
| Story repository transaction | `packages/story-kernel/src/transaction/StoryTransaction.ts` | canonical atomic structured write |
| Text Undo | `packages/project/src/index.ts` | `EditTransactionService` remains canonical for editor text |
| Snapshot / restore | `apps/desktop/src/platform/bridge.ts` | `createSnapshot(projectRoot, reason, label)` and `restoreVersion(projectRoot, snapshotId)` |

## UI shell mapping

| Handoff surface | Real path |
|---|---|
| Product header entry | `apps/desktop/src/shell/TopBar.tsx` |
| Chapter header entry | `apps/desktop/src/workspace/WriterHeader.tsx` |
| Existing writing assistant | `apps/desktop/src/assistant/AssistantPanel.tsx` |
| Global composition | `apps/desktop/src/app/App.tsx` |
| Shell layout and breakpoints | `apps/desktop/src/theme/workspace.css` |
| New unified drawer | `apps/desktop/src/features/ai/drawer/` |
| New generic context preview | `apps/desktop/src/features/ai/context/` |

The drawer uses one global store so page changes do not discard a preview. It
is 380px at 1440px and wider, an overlay from 1100px through 1439px, and a
full-height overlay from 800px through 1099px. All controls keep a minimum
44px target, visible focus, disabled async states and reduced-motion support.

## Proposed dependency direction

```text
React feature entry
  -> @writing-buddy/ai-actions
       -> @writing-buddy/ai (job and provider contracts only)
       -> @writing-buddy/story-kernel (existing token/context adapter only)
  -> DesktopBridge (existing Tauri/browser transport)

AI preview apply
  -> AiApplyService
       -> revision port
       -> existing Version snapshot port
       -> existing atomic write/StoryTransaction adapter
```

`packages/ai-actions` is framework-independent. It must not import React,
Zustand, Tauri APIs, absolute project paths or platform secret APIs.

## Public interfaces introduced in Gate A/B

```ts
AiActionRegistry.register(definition)
AiActionRegistry.get(actionId)
AiActionRegistry.list(category?)
AiActionRegistry.listAvailable(scope, category?)

PromptRegistry.register(template)
PromptRegistry.get(templateId, version?)
PromptRegistry.metadata(templateId, version?)

validateAiOutput(schema, rawText)
buildAiContextPack(action, scope)
adaptStoryKernelContextPack(action, project, pack)

openAiAction(actionId, input, scope)
AiApplyService.apply(transaction, selection, ports)
```

## Privacy and write boundaries

- Context types have no project-root or credential field.
- Author-secret entries are excluded unless the user explicitly enables them.
- Missing source modules produce empty collections and an exclusion reason;
  they never invent context.
- Ordinary logs expose action ID, prompt version, schema version, model ID and
  timing only.
- AI output remains a preview until revision validation, explicit acceptance
  and a successful safety snapshot.
- A failed write calls the supplied restore port before reporting failure.
