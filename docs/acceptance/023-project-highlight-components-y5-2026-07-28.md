# Project highlight and shared interaction Y5 acceptance — 2026-07-28

## Scope and stop line

This increment completes Y5 from
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`:

- shared project-tree, drop-indicator, drag-overlay, association-menu, Undo,
  and AI-candidate presentation primitives;
- opt-in manuscript highlights for character, location, item, and
  foreshadowing links;
- consistent pending, conflict, accepted, rejected, and stale AI states;
- field-specific Story Kernel Schema diagnostics;
- a regression fix for the supplied **信号塔的无声警告** narrow candidate.

The Story Kernel schema remains authoritative. Invalid provider values are
diagnosed but never coerced, accepted, or written. Y6 application-wide visual
polish, cross-chapter scene movement, and cross-project copying remain outside
this gate.

## Delivered behavior

### Shared interaction primitives

`apps/desktop/src/features/shared/interaction` now owns:

- `TreeRow` with independent selected, source, valid, invalid, and conflict
  states;
- `DropIndicator` for line, inside, association, and invalid destinations;
- viewport-bounded `DragOverlayCard`;
- focus-trapped and responsive `AssociationMenu`;
- one accessible, polite `UndoToast`;
- `AiCandidateFrame` with icon-and-label state semantics.

The existing project-tree and Y4 association domains consume these primitives.
No mutation, persistence, or Undo transaction moved into presentation code.

### Manuscript entity highlights

- **资料高亮** is off by default.
- 人物、地点、物品、伏笔 can be enabled independently.
- Preferences are stored per project in local UI state; manuscript bytes and
  mention records are unchanged.
- Only active `MentionLink` records receive Monaco decorations.
- Each entity kind has its own quiet background and underline tokens in Paper,
  Midnight, Fog, and Focus.
- Navigation is active only for visible highlighted mentions.

### Actionable candidate diagnostics

The supplied invalid value `readerVisibility: "hidden"` now produces:

- field: `readerVisibility`;
- expected: `0–1 之间的数字`;
- actual: `"hidden"`;
- author-facing guidance explaining that `hidden` is not valid for this field;
- a visible consequence: the candidate cannot be confirmed or written.

Evidence is labeled **正文证据** and reports its character count. Raw JSON is
collapsed behind **查看结构**, explicitly marked diagnostic-only, and scrolls
inside the candidate. The generation prompt now states the ambiguous scalar
and enumeration contracts that commonly caused this failure.

## UI/UX acceptance

`ui-ux-pro-max` guided semantic token use, non-color state labels, 44px
targets, visible focus, reduced motion, and responsive containment. The
installed skill package did not include its referenced search helper, so those
rules were applied directly.

| Evidence | Capture |
| --- | --- |
| Four real manuscript link highlights, 1440×1000 | [Entity highlights](./screenshots/project-highlight-components-y5/entity-highlights-paper-1440x1000.png) |
| Supplied invalid-schema case, 1024×800 | [Field diagnostic](./screenshots/project-highlight-components-y5/kernel-invalid-candidate-1024x800.png) |
| Raw structure expanded on demand | [Expanded structure](./screenshots/project-highlight-components-y5/kernel-invalid-expanded-1024x800.png) |
| Paper theme | [Paper](./screenshots/project-highlight-components-y5/kernel-invalid-paper-1024x800.png) |
| Midnight theme | [Midnight](./screenshots/project-highlight-components-y5/kernel-invalid-midnight-1024x800.png) |
| Fog theme | [Fog](./screenshots/project-highlight-components-y5/kernel-invalid-fog-1024x800.png) |
| Focus theme | [Focus](./screenshots/project-highlight-components-y5/kernel-invalid-focus-1024x800.png) |

At 1024×800, document and page horizontal overflow were both zero. The 297px
candidate card contained its content, both visible action buttons were 44px
high, and the 264px raw-structure viewport kept overflow internal. Theme
captures were produced through the real Settings controls, so both Monaco and
the candidate surface changed together.

The bundled browser client could not initialize because its runtime attempted
to redefine a protected Node `process` property. Visual acceptance therefore
used Playwright with the installed Microsoft Edge binary against the same
isolated local QA runtime.

## Automated validation

| Gate | Result |
| --- | --- |
| Focused Y5 suite | 9 files, 42 tests passed |
| `pnpm acceptance` | passed |
| ESLint | passed with zero warnings |
| TypeScript | passed |
| Vitest | 89 files, 287 tests passed |
| Vite production build | passed |
| `cargo fmt --check` | passed |
| `cargo test` | 49 passed, 2 explicit external gates ignored |
| `pnpm tauri:build` | portable binary and NSIS installer built |

The first focused run completed all 39 scheduled assertions but one Vitest
worker exited while TypeScript and ESLint were running in parallel. The same
expanded nine-file suite was rerun alone with one worker and passed 42/42; the
subsequent full acceptance also passed 287/287.

No real author project or provider credential was used. Browser checks used an
isolated fixture, and native smoke used an isolated WebView profile.

## Native smoke and artifacts

The implementation artifact is based on commit `830deedd`.

The portable app started from the copied artifact with title `Writing Buddy`.
`CloseMainWindow` returned true, the app exited normally within five seconds,
no force was required, and the exit code was 0.

- Portable EXE:
  `artifacts/project-highlight-components-y5/Writing-Buddy-Portable-0.1.0-y5.exe`
  - 7,348,736 bytes
  - SHA-256:
    `0B695EC6CAFACB22226A85FE205CEAC1F288814D9D151DE05E8B407D52D4DFE9`
- NSIS installer:
  `artifacts/project-highlight-components-y5/Writing-Buddy-Setup-0.1.0-y5.exe`
  - 3,192,248 bytes
  - SHA-256:
    `6397FD6B76FDDE5D5D7251541CC12DC58B3213DEC4066BE942F7F393BB24B982`

## Deferred work

- Y6 remains the broad application-wide spacing, empty-state, icon, visual
  density, and responsive polish pass.
- Cross-chapter scene movement remains blocked on an explicit
  manuscript-anchor migration contract.
- Real-key generation quality remains a human/provider acceptance gate.
