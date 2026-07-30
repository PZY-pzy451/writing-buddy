# Story Kernel generation resilience acceptance

Date: 2026-07-30
Status: passed
Branch: `codex/phase-1.2c-guided-development`

## Accepted behavior

- Two `生成 Story Kernel 候选` clicks dispatched in the same event turn start
  exactly one AI request.
- Missing `aliases`, `tags`, and `evidenceIds` arrays are safely repaired to
  empty arrays.
- A malformed candidate is excluded without discarding valid candidates.
- A fully malformed response performs no Story Kernel write and is described
  as a response-structure problem with retry guidance.
- Raw `invalidStoryKernelGenerationResource` diagnostics and `检查 AI 设置`
  guidance do not appear for response-structure failures.
- Candidate confirmation and the existing pre-write snapshot boundary are
  unchanged.

## Automated results

- Focused: 4 Vitest files / 64 tests.
- Complete frontend: 135 Vitest files / 507 tests.
- Production frontend build: passed.
- Rust: 60 passed; 2 explicit external-data gates ignored by design.
- Real Edge: complete new-project-to-three-chapter journey plus Story Kernel
  rapid-click and partial-response flow passed with zero browser exceptions.
- Edge result: 8 valid or repairable candidates visible; malformed candidate
  9 isolated; requests started by the two rapid clicks: 1.
- Release self-test and NSIS packaging: passed.

Visual evidence:
[`06a-story-kernel-partial-response-paper-1024x720.png`](./screenshots/phase-1.2c-guided-development/06a-story-kernel-partial-response-paper-1024x720.png)

Machine-readable evidence:
[`phase-1.2c-guided-development-metrics.json`](./phase-1.2c-guided-development-metrics.json)

## Windows delivery

Directory:
`artifacts/release/story-kernel-resilience-2026-07-30/`

- `Writing-Buddy-0.1.0-story-kernel-resilience-x64.exe`
  - 7,980,032 bytes
  - SHA-256
    `A9A49B71F27D9866A8D62DACA3055431C01AEAD5237C72DC7E9B2242AD164781`
- `Writing-Buddy-0.1.0-story-kernel-resilience-x64-setup.exe`
  - 3,530,324 bytes
  - SHA-256
    `140413F18ED497FA885255444D4BE1AB61CB75D635D62FFA0A487B92D97C7801`

The portable executable exposed a responsive `Writing Buddy` main window,
accepted a normal close request, and exited with code 0. These internal builds
are unsigned.
