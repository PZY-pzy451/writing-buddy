# Project structure drag Y3 acceptance — 2026-07-28

## Scope and stop line

This increment implements Y3 from
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`:

- volume reordering;
- chapter reordering within a volume;
- chapter movement across volumes;
- pointer and keyboard parity;
- atomic persistence, revision conflicts, reopen verification, and Undo.

Y4 resource association dragging is not included. Scene cross-chapter movement
also remains deferred because the current chapter schema has one metadata
object while Story Kernel scenes carry manuscript evidence/position anchors.
That operation requires an explicit anchor-migration contract rather than a
synthetic array reorder.

## Delivered behavior

### Pointer and keyboard interaction

- Every volume and chapter row has a dedicated 40×40 drag handle.
- Handles appear on row hover and remain visible on keyboard focus.
- Pointer pickup uses a six-pixel activation threshold.
- Space or Enter picks up and drops, arrows select a destination, and Esc
  cancels without a write.
- Keyboard navigation can move a chapter from one volume directly into the
  next volume.
- dnd-kit auto-scroll remains enabled for scrollable project-tree regions.
- Read-only projects and filtered trees disable reordering with an explicit
  author-facing reason.

### Drag feedback

- Source, valid, invalid, and insertion states use the Y0 semantic tokens.
- Before/after targets render a three-pixel line and leading dot.
- Inside-volume targets render a complete target outline.
- The overlay identifies the entity type and title and is constrained to the
  viewport.
- A visible status chip and polite live regions describe the current target.

### Persistence and Undo

The command path is:

`ProjectStructureTree` → `ProjectStructureMoveService` →
`DesktopBridge.moveProjectStructure` → native write-locked command.

The native command:

1. canonicalizes the project root;
2. hashes the exact manifest bytes and rejects a stale expected revision;
3. validates the source stable ID, container, and index;
4. changes only the canonical manifest array order;
5. writes through the existing atomic text writer;
6. reopens through the canonical migration reader;
7. restores the previous manifest if reopen verification fails;
8. returns the fresh revision and exact inverse command.

The chapter ID and Markdown path are preserved across same-volume,
cross-volume, and inverse moves. Successful moves display a six-second Undo
toast; the button and Ctrl+Z outside editable surfaces invoke the same
revision-safe inverse command.

## Visual evidence

| Evidence | Capture |
| --- | --- |
| Idle tree and hover-revealed handle, 1440×1000 | [01 idle](./screenshots/project-structure-drag-y3/01-idle-hover-1440x1000.png) |
| Keyboard cross-volume target and overlay | [02 keyboard target](./screenshots/project-structure-drag-y3/02-keyboard-cross-volume-target-1440x1000.png) |
| Persisted cross-volume result and Undo toast | [03 success](./screenshots/project-structure-drag-y3/03-cross-volume-success-undo-1440x1000.png) |
| Invalid/no-change target feedback | [04 invalid](./screenshots/project-structure-drag-y3/04-invalid-no-change-volume-1440x1000.png) |
| Compact project tree, 1024×768 | [05 compact](./screenshots/project-structure-drag-y3/05-compact-1024x768.png) |
| Narrow overlay sidebar, 800×720 | [06 narrow](./screenshots/project-structure-drag-y3/06-narrow-800x720.png) |
| Filtered tree with explicit disabled-reorder reason | [07 filtered](./screenshots/project-structure-drag-y3/07-search-disables-reorder-800x720.png) |

All three viewports had zero horizontal page overflow. The 1024px check found
and fixed a real overlap between the structure tree and reference tree by
giving both sections independent vertical scrolling.

The bundled browser-plugin client could not load because it attempted to
redefine a protected Node `process` property. Visual acceptance therefore
used Playwright 1.55.1 with the installed Microsoft Edge binary through the
same isolated local QA runtime.

## Automated validation

Toolchain:

- Node.js `24.14.0`
- pnpm `10.32.1`
- Rust stable toolchain already pinned by the project

| Gate | Result |
| --- | --- |
| `pnpm acceptance` | passed |
| ESLint | passed with zero warnings |
| TypeScript | passed |
| Vitest | 83 files, 271 tests passed |
| Vite production build | passed |
| `cargo fmt --check` | passed |
| `cargo test` | 49 passed, 2 explicit external/release gates ignored |
| Same-volume move + inverse | passed |
| Cross-volume move + reopen + inverse | passed |
| Stale revision leaves manifest bytes unchanged | passed |
| Chapter stable ID and file path preservation | passed |
| Search/read-only disabled behavior | passed |
| Toast Undo and Ctrl+Z parity | passed |

No real author project was used. Rust acceptance used temporary sanitized
projects; browser acceptance used the in-memory desktop bridge.

## Native smoke and artifacts

The build is based on implementation commit `9276ff39`. The portable
application was launched with an isolated `WEBVIEW2_USER_DATA_FOLDER`, became
responsive with title `Writing Buddy`, accepted `CloseMainWindow`, and exited
normally with code 0.

- Portable EXE:
  `artifacts/project-structure-drag-y3/Writing-Buddy-Portable-0.1.0-y3.exe`
  - 7,336,448 bytes
  - SHA-256:
    `F0A79555B4B83520A4139B92C0DCEB2D2F7D3FE539CD1DA558D8B44458F149C2`
- NSIS installer:
  `artifacts/project-structure-drag-y3/Writing-Buddy-Setup-0.1.0-y3.exe`
  - 3,179,126 bytes
  - SHA-256:
    `184958C48D1D335917E3FD588D577121C1F59A47C5E449932F094D5D583E5C64`

## Deferred work

- Y4: resource association dragging, rule-specific conflicts, collision
  handling, and recovery acceptance.
- Scene cross-chapter moves: manuscript-anchor migration design and tests.

