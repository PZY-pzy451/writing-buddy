# Long Output and Complete Novel Acceptance

Date: 2026-07-30

Baseline: `c77c854d feat: add inline ai draft insertion`

## Objective

Expand the DeepSeek output ceiling from the legacy 8,192-token boundary to
the provider's current 384K maximum, then validate Writing Buddy with one
complete, importable novel rather than isolated three-paragraph fixtures.

This milestone must preserve author control: a larger output allowance is not
permission to write directly into the manuscript or to generate an entire
book in one opaque request.

## Provider contract

DeepSeek's current official model page reports:

- `deepseek-v4-flash` and `deepseek-v4-pro`;
- 1M context;
- maximum output of 384K.

Sources:

- `https://api-docs.deepseek.com/quick_start/pricing/`
- `https://api-docs.deepseek.com/api/create-chat-completion/`

The application will expose bounded presets through `384,000`. The default
remains `2,048` to avoid silently increasing latency or cost for existing
authors.

## Engineering scope

1. Extend the shared TypeScript preference contract, Zod validation, browser
   fixture and Rust command boundary with the same preset list.
2. Replace duplicate Rust `matches!` lists with one canonical predicate.
3. Make the runtime hard deadline scale with the requested maximum while
   retaining connection, first-content, idle and cancellation limits.
4. Surface 64K+ presets as long-form/high-cost choices in settings, with a
   visible explanation that the value is a ceiling and that chapter/scene
   generation remains recommended.
5. Treat `finish_reason = length` as a partial result. Structured JSON jobs
   must fail with a clear output-limit message instead of passing truncated
   JSON to downstream parsers.
6. Keep focused inline grammar and Tab expansion requests at their existing
   1,024/512-token limits.

## Complete novel acceptance

The provisional fixture is a near-future suspense novel:

- working title: `《零点回声》`;
- target: approximately 30,000 Chinese characters;
- structure: three acts, twelve chapters, at least two scenes per chapter;
- style: restrained cinematic prose;
- completion rule: the central mystery, protagonist arc and planted clues all
  resolve by the final chapter.

If the author supplies a different genre, length or style before prose
generation begins, those preferences replace this provisional brief.

The deliverable must be both:

- readable as a standalone manuscript; and
- importable as a valid Writing Buddy project with manifest, chapter files,
  creation journey/outline state and Story Kernel resources.

## Acceptance matrix

### Contract and persistence

- every preset round-trips through TypeScript, browser and Rust;
- unknown/non-preset values fail closed;
- saved 8,192-token preferences continue to reopen;
- 384,000 reaches the provider request body unchanged;
- high-output runtime deadline exceeds the former ten-minute ceiling;
- cancel remains responsive and partial text is retained.

### Author journey

- create/open the novel project;
- verify volumes, twelve chapters and scene ordering;
- open every chapter and confirm non-empty completed prose;
- exercise cursor continuation and selection rewrite without auto-write;
- write one accepted candidate, verify snapshot/autosave, then undo once;
- run offline outline checks and AI-facing fixture checks;
- save, close, reopen and verify the same chapter count, order and text;
- produce a full-project export/backup and verify restore.

### Quality gates

- no placeholder text, duplicated chapter bodies or unresolved TODO markers;
- chapter titles and scene objectives match the canonical outline;
- final chapter resolves the declared hook;
- all local structural checks pass;
- no raw paths, keys or private author data enter AI payload fixtures;
- responsive UI at 390, 1024, 1280 and 1536 widths;
- Node 24 full/release self-tests, native startup and normal close pass.

## Delivery

- updated source and tests;
- complete novel project and standalone manuscript under
  `artifacts/novels/zero-hour-echo/`;
- release portable EXE and NSIS installer;
- numbered acceptance report with hashes and exact test totals.
