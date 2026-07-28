# Project association drag Y4 acceptance — 2026-07-28

## Scope and stop line

This increment completes Y4 from
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`:

- character and item association with a concrete scene;
- position-aware item transfer to a character;
- foreshadowing plant, reminder, and payoff association;
- narrative-order timeline reordering with a causality guard;
- plot-thread lifecycle dragging;
- pointer and keyboard parity, guarded confirmation, atomic persistence, and
  revision-safe Undo.

Dragging never invokes AI. No release gesture silently writes an operation that
needs story meaning or a concrete position. No operation changes manuscript
text, resource IDs, file paths, scene anchors, project order, or another
project.

Scene movement across chapters remains deferred. It needs a manuscript-anchor
migration contract and must not be represented as an array reorder.

## Delivered behavior

### Association workbench

The Story workspace now includes **关联编排**:

- the source shelf groups characters, items, and foreshadowing;
- chapter and scene targets accept scene-level associations;
- character targets accept item-holder transfers;
- dropping on a chapter resolves to a concrete scene before save;
- item transfers require effective narrative order and quantity;
- foreshadowing requires plant, reminder, or payoff intent;
- a valid release opens confirmation instead of writing immediately;
- widths below 1100px use a full-width bottom sheet;
- successful operations expose a toast Undo action and Ctrl+Z parity.

Scene appearance data remains backward compatible through optional
`StoryScene.itemIds`. Story resources commit through the existing atomic
repository, while item state continues through the existing hash-protected
item-state store.

### Timeline reorder and causality guard

- Story-time mode explains why manual dragging is unavailable.
- Narrative-order mode exposes a horizontally scrollable reorder rail.
- Reordering preserves the existing narrative-order slots.
- Moving an event before a declared predecessor opens an alert dialog listing
  the conflicts before any write.
- Confirmed writes and Undo both require the expected live revisions.

### Plot lifecycle board

- Plot cards move between lifecycle columns with pointer or keyboard.
- Column targeting has explicit hover, focus, and live-announcement feedback.
- No-op drops do not write.
- Successful status changes persist immediately and expose guarded Undo.
- The inspector derives its draft status from the active thread, including
  after reload and Undo.

## UI/UX acceptance

`ui-ux-pro-max` guided the final interaction pass: visible focus, 44px minimum
targets, Lucide icons, non-color status labels, reduced motion, and responsive
containment. Browser inspection also found and fixed the narrow Story sidebar
overlay: at 800px the source shelf and destination workspace are both visible,
with horizontal scrolling contained inside the workbench instead of leaking to
the page.

| Evidence | Capture |
| --- | --- |
| Association workbench, 1440×1000 | [Workbench](./screenshots/project-association-drag-y4/association-1440x1000.png) |
| Persisted association and Undo toast | [Saved association](./screenshots/project-association-drag-y4/association-saved-1440x1000.png) |
| Responsive workbench, 1024×768 | [1024 layout](./screenshots/project-association-drag-y4/association-1024x768.png) |
| Narrow workbench with both panes visible, 800×720 | [800 layout](./screenshots/project-association-drag-y4/association-800x720-final.png) |
| Narrow confirmation bottom sheet | [800 confirmation](./screenshots/project-association-drag-y4/association-confirm-sheet-800x720-final.png) |
| Narrative-order rail and 44px handles | [Timeline rail](./screenshots/project-association-drag-y4/timeline-narrative-reorder-1440x1000-final.png) |
| Causality conflict confirmation | [Causality guard](./screenshots/project-association-drag-y4/timeline-causality-confirm-1440x1000.png) |
| Plot lifecycle drag target | [Plot drag](./screenshots/project-association-drag-y4/plot-board-drag-1440x1000.png) |
| Persisted plot status and Undo | [Plot moved](./screenshots/project-association-drag-y4/plot-board-moved-1440x1000.png) |

The 1440px and 1024px checks had zero document and page overflow. The final
800px check also had zero document/page overflow; its 116px overflow is
deliberately contained inside the association workspace scroller. The
timeline had four 44×64 handles, and all scoped interactive controls in the
responsive and plot checks met the 44px effective-target rule.

The bundled browser client could not initialize because its runtime attempted
to redefine a protected Node `process` property. Visual acceptance therefore
used Playwright 1.55.1 with the installed Microsoft Edge binary against the
same isolated local QA runtime. Final browser console and page-error lists were
empty.

## Interaction verification

- Character → scene opened the correct scene confirmation; confirm changed
  participant count from 2 to 3, and Undo restored 2.
- Item → character required an effective position and used the existing item
  state store.
- At 800px, pointer drag opened the correct full-width confirmation sheet.
- A narrative move before its predecessor opened **确认因果顺序冲突**, listed
  the violated predecessor, and **返回调整** cancelled without a write.
- Plot thread **遗失笔记** moved from active to resolved; Undo restored active.
- Reloaded plot inspector showed the restored `active` status.
- Story-time mode displayed its explicit non-draggable explanation.

## Automated validation

| Gate | Result |
| --- | --- |
| Focused transaction/page suite | 5 files, 13 tests passed |
| `pnpm acceptance` | passed |
| ESLint | passed with zero warnings |
| TypeScript | passed |
| Vitest | 86 files, 279 tests passed |
| Vite production build | passed |
| `cargo fmt --check` | passed |
| `cargo test` | 49 passed, 2 explicit external gates ignored |

No real author project or provider credential was used. Browser tests used an
isolated fixture, and native smoke used an isolated WebView profile.

## Native smoke and artifacts

The implementation is based on commit `7983332f`.

The release and NSIS outputs completed in the Tauri build log. The command
wrapper reached its 121-second limit after packaging, so acceptance additionally
verified the fresh output timestamps, copied artifact hashes, and native
startup. The portable app became responsive with title `Writing Buddy`,
accepted `CloseMainWindow`, and exited normally with code 0.

- Portable EXE:
  `artifacts/project-association-drag-y4/Writing-Buddy-Portable-0.1.0-y4.exe`
  - 7,344,640 bytes
  - SHA-256:
    `28E534CB52267E469DA6FCE743AB40D979B61573746E3C587A711D018CA79990`
- NSIS installer:
  `artifacts/project-association-drag-y4/Writing-Buddy-Setup-0.1.0-y4.exe`
  - 3,188,644 bytes
  - SHA-256:
    `14AA6C781DBED0ED40810BB01BA79802CCB78347D9E3C9E8FA872276778DB268`

## Deferred work

- Cross-chapter scene movement remains blocked on an explicit
  manuscript-anchor migration contract.
- Cross-project resource copying remains outside Y4.
- The next handoff increment is shared highlight and visual-state convergence,
  building on the accepted Y0–Y4 semantic tokens and drag behavior.
