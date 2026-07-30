# Phase 1.2C AI Draft Insertion acceptance

Date: 2026-07-30

Repository: `D:\develop_tool\writing-buddy-genre-to-draft`

Branch: `codex/genre-to-draft-gates-a-c`

Baseline: `dc872efb test: validate genre to draft core journey`

## Accepted scope

The shortest author-controlled AI-to-manuscript path is complete:

- continue from the current cursor;
- polish and replace the current selection;
- place the generated result in an editable inline pending draft;
- keep pending text outside the Monaco model, word count and autosave;
- explicitly write or discard;
- block stale resource, revision, range or anchor targets;
- create a canonical `beforeDestructiveOperation` snapshot before mutation;
- commit with one Monaco edit transaction;
- autosave after commit;
- undo the complete AI edit with one native `Ctrl+Z`.

Whole-scene/chapter generation, partial-paragraph adoption, persisted pending
candidate recovery and automatic anchor relocation remain outside this round.

## Implementation evidence

- `PendingDraftCandidate` is transient Zustand state and is not included in
  workspace persistence.
- Cursor continuation and selection rewrite reuse their existing grounded
  Context Pack, strict parsers and duplicate-request guards, then hand valid
  output to the editor instead of applying it from the assistant panel.
- Monaco view zones reserve manuscript space. The accessible React card is
  rendered outside Monaco's `aria-hidden` view-zone subtree and tracks editor
  scrolling, layout changes and the responsive assistant overlay.
- The inline card exposes the exact target, bounded context explanation,
  editable text, stale/failure feedback, 44 px actions and focus-visible
  controls.
- Commit saves any dirty author text first, creates the canonical snapshot,
  revalidates the target, executes one edit, autosaves and verifies a clean
  session. Failed post-edit saves trigger one rollback and preserve the
  candidate with a visible error.

## Real in-app browser acceptance

Environment: `1280x720`, local browser fixture, first chapter initially
`94` words.

### Cursor continuation

1. Put the caret at the paragraph end and generate a grounded continuation.
2. Confirm that the inline card appears at the captured insertion target.
3. Edit the draft and verify that the chapter remains `94` words while
   pending.
4. Discard once and verify that the card disappears without manuscript
   mutation.
5. Generate again and write.
6. Verify the success notice, clean save state, AI highlight and word-count
   change from `94` to `123`.
7. Press native `Ctrl+Z` once and verify restoration from `123` to `94`, then
   save the restored manuscript.

### Selection rewrite

1. Select the opening manuscript fragment and generate a grounded rewrite.
2. Confirm target text `第一章 停摆的时钟 / 替换当前选区`.
3. Edit the pending text to `夜雨轻叩旧火车站的玻璃穹顶`; the chapter remains
   `94` words while pending.
4. Write once and verify snapshot/autosave success and word-count change to
   `95`.
5. Press native `Ctrl+Z` once and verify exact restoration to `94`, then save.

The task panel had previously been resized until the Monaco viewport was under
70 px high. The inline candidate state remained intact; `Ctrl+J` restored a
usable editor viewport and the card appeared at the exact target. This matches
the existing VS Code-style author-controlled layout behavior.

## Automated gates

All final commands used Node `24.18.0` and pnpm `10.32.1`.

- focused inline-draft tests: 4 files / 14 tests;
- visual contract regression: 2 files / 6 tests;
- ESLint: passed with zero warnings;
- TypeScript: passed;
- full Vitest: 156 files / 596 tests;
- production Vite build: passed;
- Cargo formatting: passed;
- Rust: 67 passed, 2 explicit external-data gates ignored;
- release self-test: passed;
- Tauri Release portable and NSIS installer: passed.

The portable executable reached input-idle with one `Writing Buddy` main
window, accepted normal close and exited with code `0`.

## Delivery

Directory: `artifacts/release/ai-draft-insertion-phase-1.2c/`

- `Writing-Buddy-0.1.0-ai-draft-insertion-portable.exe`
- `Writing-Buddy-0.1.0-ai-draft-insertion-setup.exe`
- `SHA256SUMS.txt`

SHA-256:

- portable:
  `EE16E60062CE60CC13799BE12C9060F2F9942C097473511D3BDE10D95D9E3030`
- installer:
  `868222F0D21CC4B9E09BBE9794E59B260B01093B1DD883E1DCEAD291FB19E2D6`
