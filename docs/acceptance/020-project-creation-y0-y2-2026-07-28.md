# Project Creation Y0–Y2 acceptance — 2026-07-28

## Scope and stop line

This increment implements the first executable slice of
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`:

- Y0: source map, ordering contract, and semantic interaction baseline;
- Y1: global create entry, no-project welcome surface, and four-step wizard;
- Y2: typed preflight plus verified same-parent staging and atomic save.

The handoff explicitly requires stopping after Y2. Drag-and-drop reordering,
keyboard reordering, Undo, and conflict handling remain Y3–Y4 work and are not
mixed into this release.

## Delivered behavior

### No-project entry

- The top bar exposes a global **New** menu before a project is open.
- The welcome page and compact project shelf both expose **New project**,
  **Open project**, and up to three recent projects.
- Project-scoped creation commands remain visible but disabled with an
  explicit reason until their later implementation gate.

### Four-step creation wizard

1. Basics: name, optional description, parent directory, work type, language,
   and one of six built-in templates.
2. Initial structure: typed resources with template defaults and dependency
   protection.
3. Appearance: Paper, Midnight, Fog, or Focus theme; accent color; and
   manuscript-first or planning-first entry behavior.
4. Review: target path, resource count, expected directory/file count, and the
   safety transaction are shown before the write.

Validation is inline, summarized in the step rail, and announced through an
`aria-live` status. The modal traps focus, restores focus after close, and
prompts before discarding a changed draft.

### Safe native creation transaction

The Rust adapter:

1. validates names, Windows reserved names, target length, parent access,
   template IDs, appearance values, resource IDs, and dependencies;
2. refuses an existing target without overwriting it;
3. writes to a unique staging directory beside the final target;
4. writes `.writing-buddy/project.json` and
   `.writing-buddy/workspace.json`;
5. reopens the staged project through the existing migration reader;
6. atomically renames the verified directory into place;
7. removes staging on every failed path.

Sample prose is off by default. Optional sample content is a usage note only;
the creation path never invokes an AI provider.

### Canonical ordering and appearance

- `.writing-buddy/project.json` array order remains the canonical visible
  order. Filesystem discovery is compatibility-only and does not become an
  ordering source.
- Project appearance is stored separately in
  `.writing-buddy/workspace.json`.
- A reopened project restores its theme and accent through the existing
  application store.

## UI/UX baseline

- Warm-paper surfaces, 10–18px radii, compact shadows, and 100/160ms motion
  tokens are centralized.
- Selected, hover, keyboard focus, drag-source, valid/invalid drag target, AI,
  conflict, warning, success, and information states have semantic tokens in
  every theme.
- Keyboard focus uses a 2px outline plus halo.
- Controls remain readable when disabled and use Lucide icons.
- The 1440px desktop and 1024px compact layouts have no horizontal page
  overflow. The compact wizard collapses the step descriptions into a stable
  icon rail.
- Responsive icon-only top-bar actions retain explicit accessible names.
- `prefers-reduced-motion` continues to disable nonessential motion.

## Visual evidence

| Evidence | Capture |
| --- | --- |
| No-project welcome, 1440×960 | [01 welcome](./screenshots/project-creation-y0-y2/01-welcome-desktop-1440x960.png) |
| Wizard basics, 1440×960 | [02 step 1](./screenshots/project-creation-y0-y2/02-wizard-step1-desktop-1440x960.png) |
| Initial structure, 1440×960 | [03 step 2](./screenshots/project-creation-y0-y2/03-wizard-step2-structure-1440x960.png) |
| Theme preview, 1440×960 | [04 step 3](./screenshots/project-creation-y0-y2/04-wizard-step3-appearance-1440x960.png) |
| Final review, 1440×960 | [05 step 4](./screenshots/project-creation-y0-y2/05-wizard-step4-review-1440x960.png) |
| Created project reopened in Midnight | [06 created](./screenshots/project-creation-y0-y2/06-created-project-opened-1440x960.png) |
| Compact welcome, 1024×768 | [07 compact welcome](./screenshots/project-creation-y0-y2/07-welcome-narrow-1024x768.png) |
| Compact wizard, 1024×768 | [08 compact wizard](./screenshots/project-creation-y0-y2/08-wizard-step1-narrow-1024x768.png) |
| Global create menu | [09 global menu](./screenshots/project-creation-y0-y2/09-global-create-menu-1440x960.png) |
| Inline validation and step summary | [10 errors](./screenshots/project-creation-y0-y2/10-wizard-validation-errors-1440x960.png) |

The browser-plugin client bundled with this Codex runtime could not load
because it attempted to redefine a protected Node `process` property. Visual
acceptance therefore used Playwright 1.55.1 with the installed Microsoft Edge
binary through the same persistent Node QA runtime.

## Automated validation

Toolchain:

- Node.js `24.14.0`
- pnpm `10.32.1`
- Rust stable toolchain already pinned by the project

Results:

| Gate | Result |
| --- | --- |
| `pnpm acceptance` | passed |
| ESLint | passed with zero warnings |
| TypeScript | passed |
| Vitest | 79 files, 252 tests passed |
| Vite production build | passed |
| `cargo fmt --check` | passed |
| `cargo test` | 47 passed, 2 explicit external/release gates ignored |
| Template transaction coverage | all six templates create, verify, and reopen |
| Collision coverage | existing targets preserved; no staging residue |

No real author project was used. Rust creation tests use temporary sanitized
directories; browser acceptance uses the in-memory desktop bridge.

## Native smoke and artifacts

The portable build was launched with an isolated
`WEBVIEW2_USER_DATA_FOLDER`. It became responsive with title
`Writing Buddy`, accepted `CloseMainWindow`, and exited normally with code 0.

- Portable EXE:
  `artifacts/project-creation-y0-y2/Writing-Buddy-Portable-0.1.0-y0-y2.exe`
  - 7,288,832 bytes
  - SHA-256:
    `E366474A76D13DD6A4E3B1354657D54BE17BD8956A77D67BEE0E6D709C5C7C46`
- NSIS installer:
  `artifacts/project-creation-y0-y2/Writing-Buddy-Setup-0.1.0-y0-y2.exe`
  - 3,151,579 bytes
  - SHA-256:
    `B291858C37160C14CD74041718B73970C231D4BE591A9EC31456B7A0F38FD65C`

## Deferred work

- Y3: chapter/volume drag preview, drag handles, valid/invalid target feedback,
  keyboard parity, persistence, and Undo.
- Y4: resource drag flows, cross-group rules, collision handling, and recovery
  acceptance.

