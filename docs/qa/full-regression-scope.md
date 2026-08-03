# Writing Buddy full regression scope v2

Updated: 2026-08-03

## First-round contract

This round establishes Gates A-E and then records one real baseline. It does **not** enter Gate F, call a real AI provider, fix broad product behavior, package a release, or claim that full regression is complete.

The round is successful only as a regression-foundation delivery. Its product conclusion remains `PARTIAL` while any required feature, page, workspace, control, state, shortcut, native action, dependency, mock scenario, or test mapping is missing.

## Privacy and isolation

- Use sanitized repository fixtures and disposable project copies only.
- Never persist API keys, full prompts, full model output, real author prose, user directory names, or absolute machine paths in QA artifacts.
- AI behavior in this round is deterministic and local. Real DeepSeek validation is explicitly excluded.
- Each mutable test fixture must be reset before use and removed after use. A test must not depend on another test's execution order.

## Status vocabulary

Only these result states are valid:

- `NOT_RUN`
- `PASS`
- `FAIL`
- `BLOCKED`
- `STALE`
- `CACHED_PASS`
- `NOT_APPLICABLE`
- `SKIPPED_WITH_REASON`

`NOT_APPLICABLE` and `SKIPPED_WITH_REASON` require a non-empty reason. `CACHED_PASS` requires identical dependency fingerprints and an earlier passing result. Any changed or unknown input makes the result `STALE` and forces execution.

## Source map

| Layer | Repository-relative source | Responsibility | Primary verification |
| --- | --- | --- | --- |
| Desktop UI | `apps/desktop/src/` | React workspaces, Monaco editor, accessibility, state and interactions | Vitest, Testing Library, browser journeys |
| Desktop bridge | `apps/desktop/src/platform/` | Typed browser/Tauri boundary and browser fixture behavior | Vitest contract tests |
| Domain packages | `packages/domain`, `packages/project`, `packages/resource`, `packages/review` | Author/project domain rules without React/Tauri | Vitest |
| AI packages | `packages/ai`, `packages/ai-actions` | Requests, streaming events, parsing, application safety | Vitest plus deterministic provider contracts |
| Story Kernel | `packages/story-kernel`, `packages/schema` | Resource schemas, strict repair, repositories and transactions | Vitest schema/repository tests |
| Safety packages | `packages/version`, `packages/backup`, `packages/migration`, `packages/compatibility` | Snapshot, backup, compatibility and migration | Vitest plus sanitized fixtures |
| Ports/test support | `packages/platform-ports`, `packages/test-support` | External-effect contracts and resettable fakes | Vitest contract tests |
| Native runtime | `apps/desktop/src-tauri/src/` | Tauri commands, filesystem/path checks, AI adapter, archive, secrets | Cargo tests and Tauri build |
| Test orchestration | `scripts/self-test`, `scripts/acceptance`, `scripts/perf` | Change-aware selection, browser/native journeys and performance checks | Node tests and script exit status |
| Fixture corpus | `fixtures/` | Sanitized complete, corrupt, legacy and performance projects | Fixture validation and consumer tests |

The mapped source contains 153 TSX files, 155 TS files, 55 Tauri command declarations, 168 frontend/Node test files and 79 Rust `#[test]`/`#[tokio::test]` declarations at the branch baseline. Raw JSX inspection finds 476 buttons, 82 inputs, 33 selects and 34 textareas; these are discovery inputs, not proof that every semantic control is already mapped.

## Architecture invariants

- Dependency direction is UI to application/domain to ports to native adapters.
- Domain packages do not import React, Tauri, Monaco or VS Code APIs.
- UI code does not perform arbitrary filesystem access.
- Native commands validate project paths and use bounded, atomic operations where writes are involved.
- AI output is untrusted until parsed, normalized within explicit rules, strictly validated and confirmed by the author before a protected write.
- Snapshot/revision checks and fail-before-write behavior are regression-critical cross-cutting dependencies.

## Existing frameworks and commands

The baseline toolchain is Node 24, pnpm 10.32.1, TypeScript 5.9, Vitest 4.1 with jsdom, React Testing Library, Rust/Cargo 1.97, Vite and Tauri 2. Browser acceptance is driven by repository Node scripts against a local Vite app and Edge/CDP; native acceptance uses isolated Tauri builds and disposable projects.

| Intent | Command |
| --- | --- |
| Static checks | `pnpm lint`, `pnpm typecheck` |
| Frontend/unit/integration | `pnpm test` |
| Frontend coverage | `pnpm test:coverage` |
| Frontend production build | `pnpm build` |
| Native unit tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` |
| Change-aware plan | `pnpm self-test:plan` |
| Proportional execution | `pnpm self-test` |
| Full source checks | `pnpm self-test:full` |
| Release checks | `pnpm self-test:release` |
| Historical aggregate runner | `pnpm acceptance:full-regression` |

The existing self-test combines static-import related tests, feature/package leaf tests and explicit cross-cutting impact rules. The v2 dependency ledger extends this rather than replacing it.

## Fingerprints and invalidation

Every discovered test case receives independent source, transitive dependency,
fixture, mock-provider, schema, environment, build-configuration, test-
implementation and expected-behavior fingerprints. A prior `PASS` becomes
`CACHED_PASS` only when all nine values match and no mandatory-rerun rule
applies. Missing history, any changed value, or a P0/P1/release-critical policy
turns the result into `STALE` with a recorded reason.

`control-impact-map.json`, `test-dependency-map.json` and
`schema-impact-map.json` expose the graph inputs. `regression-ledger.json` owns
per-case decisions; `incremental-test-plan.json` lists selected and cached test
IDs. Generated reports use repository-relative paths only.

## Baseline policy

Historical evidence at the source baseline reports 168 Vitest files / 701 tests and 77 passing Rust tests, but that evidence belongs to another commit/environment fingerprint. It is recorded only as historical context and starts this round as `STALE`.

Current results remain `NOT_RUN` until the Gates A-E infrastructure is complete. The first baseline will run the existing checks and record exact command, duration, exit code, fingerprints and gaps. A passing command does not turn an incomplete traceability inventory into an overall `PASS`.

## Deterministic fixtures

`@writing-buddy/test-support` provides a manually advanced AI event runner and
resettable in-memory project fixtures. The AI catalog covers 24 success,
streaming, cancellation, transport/provider failure, structured-output,
apply-boundary and privacy scenarios. The project catalog covers eight clean,
dirty, conflicting, corrupt, legacy, read-only, long-form and save-failure
states.

Runs do not use network timers. The provider records only job and scenario IDs,
never request content. Project roots are synthetic, mutations and injected
failures reset between tests, and disposal clears all in-memory files.

## Environment constraints

- The optional PRPM package search command required by the testing-infrastructure skill is unavailable in the current environment. No package was installed because installation requires explicit approval.
- No real DeepSeek credential or network generation is permitted in this round.
- Release packaging and human cutover validation are deferred beyond Gate E.
