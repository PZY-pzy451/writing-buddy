# 004 — System layout and AI review acceptance, 2026-07-27

## Outcome

The system-page layout defect is fixed across Search, Review, Versions,
AI Test, and Settings. Those routes now own one full-height canvas row, their
scroll surface fills the center workspace, and readable content uses one shared
responsive boundary.

Review now exposes two explicit modes:

- Local manual review runs deterministic rules without network access.
- AI automatic review sends only the current editor chapter after a direct
  author action and returns validated review issues.

Both modes produce suggestions only. Manuscript changes still require an
explicit Accept action from the author.

## Automated gates

| Gate | Result |
| --- | --- |
| ESLint | Passed, zero warnings |
| TypeScript | Passed |
| Vitest | 9 files, 27 tests passed |
| Vite production build | Passed |
| Rust formatting | Passed |
| Rust unit tests | 15 passed |
| Diff hygiene | `git diff --check` passed |
| Secret/log scan | No key, long Bearer token, or source console logging found |
| Tauri release build | Passed in an isolated target directory |
| NSIS bundle | Passed in an isolated target directory |

## Layout evidence

At a `1920 × 1080` viewport:

- AI Test, Search, Versions, Settings, and Review all had a `1528px` canvas and
  a matching `1528px` page surface.
- Page `scrollWidth` equaled `clientWidth`; no horizontal overflow was present.
- The scrollbar stayed on the right edge of the center workspace rather than
  inside a capped page in the middle of the screen.
- AI Test expanded its prompt and output cards across the available content
  area.

At `1024 × 768`, the Review dashboard changed from two columns to one column.
At `768 × 900`, the review-mode cards also changed to one column and document
horizontal overflow remained `0`.

Visual checks covered Local manual review, AI automatic review, the explicit
chapter-transmission notice, the missing-key state, and author-confirmed
editing. Browser console inspection returned no warnings or errors.

## AI review security evidence

- Every AI generation request declares a job type:
  `storyforge-test` or `chapter-review`.
- Rust accepts one fixed system prompt per job type.
- The chapter-review user message accepts only `schemaVersion` and `content`;
  unknown fields such as a project path are rejected.
- Chapter content is capped at 100,000 characters.
- The response must be a strict JSON object with at most 50 issues.
- Every returned target is checked against current source text. Ambiguous or
  unresolvable anchors are discarded.
- Private `reasoning_content` remains discarded in Rust.
- Prompts, responses, and reasoning remain memory-only. The usage log records
  only provider, model, job type, duration, status, and token counts.
- Re-running one origin replaces only that origin for the current resource;
  local and AI issues can coexist.

## Release build evidence

The canonical release executable was open in a user-owned Writing Buddy window,
so the first bundle attempt could not overwrite it. The window was not closed
or interrupted. The same build completed with an isolated `CARGO_TARGET_DIR`:

- EXE:
  `tmp/tauri-target-phase-1.0b/release/writing-buddy-next.exe`
  - 6,705,152 bytes
  - SHA-256:
    `370ca68610a2fc664c602f4ef558eae15c7826648101fd7ed99ac67fa352f72b`
- NSIS:
  `tmp/tauri-target-phase-1.0b/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 2,915,578 bytes
  - SHA-256:
    `145fbff5b3ab55d79f74e7c8e01deab72e2719f238da1791cd146e894100d1e2`

The currently open canonical EXE remains the earlier build. Close it before
running the normal `pnpm tauri:build` command to replace canonical artifacts.

## Open manual gates

- Validate AI automatic review with a user-provided real DeepSeek key,
  including successful results, Stop, malformed provider output, restart, and
  deletion.
- Continue the existing M9 human cutover sessions. Legacy remains the rollback
  source until M9 is complete.
