# Project Creation Y0–Y2 implementation contract

Updated: 2026-07-28

## Goal

Implement the first reviewed slice of
`Writing_Buddy_Project_Creation_Drag_Highlight_Visual_Handoff_v1.0`:

- semantic interaction tokens and visual baseline;
- global and empty-state creation entry points;
- an accessible four-step creation wizard;
- six versioned project templates;
- native preflight with explicit error codes;
- same-parent staged creation, re-read verification, and atomic rename;
- recent-project and project appearance restoration.

## Non-goals

- drag/drop behavior or a drag dependency;
- volume/chapter/scene movement;
- association drops;
- persistent project-structure undo;
- AI calls during creation;
- legacy `main` changes or real author-project writes.

## Gates

### Y0

- source map and ordering contract are durable;
- Paper, Midnight, Fog, and Focus expose the complete highlight token set;
- the pre-change test baseline is known.

### Y1

- top-bar create menu works with and without an open project;
- welcome workspace and compact sidebar are not duplicate prose blocks;
- the 960×760 four-step wizard is keyboard navigable and focus trapped;
- 1024×720 uses a compact step rail and one-column appearance cards;
- field errors are local, clear, and announced.

### Y2

- registry validates duplicate/unknown template IDs;
- project names reject empty, overlong, reserved, and invalid Windows names;
- preflight performs no project writes;
- creation uses a unique sibling staging directory;
- verification uses the existing project reader;
- success atomically renames staging to the final directory;
- all failures remove staging and never overwrite an existing target;
- creation opens the project and first chapter, then records it in recent
  projects;
- the created files contain no API key.

## Validation

Run in order:

1. TypeScript compilation.
2. Focused registry, service, store, wizard, and Rust command tests.
3. Full `pnpm acceptance`.
4. `cargo fmt --check` and `cargo test`.
5. Browser visual evidence at 1536×992, 1280×800, and 1024×720 for Paper and
   Midnight where required.
6. Native create/reopen smoke test using a generated sanitized project.
7. Portable Windows build.

## Stop condition

After Y0–Y2 evidence and commit, stop for review. Y3 dragging begins only after
the user explicitly continues from this accepted slice.

