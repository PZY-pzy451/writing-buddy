# Writing Buddy Next Agent Rules

## Scope

- This repository is the independent Tauri client.
- The Legacy Code-OSS repository at `D:\develop_tool\writing-buddy` is read-only during migration work.
- Never write a real user project while validating compatibility. Use sanitized fixtures or an explicit project copy.

## Architecture

- Preserve the dependency direction: UI -> application -> domain -> ports -> Rust adapters.
- Domain packages must not import React, Tauri, Monaco, or VS Code APIs.
- React code must not receive arbitrary filesystem access.
- All project-relative paths are validated in Rust before access.

## Validation

- Run TypeScript compilation before tests.
- Run the smallest relevant test first, then the complete acceptance command.
- A migration milestone is not complete without durable evidence under `docs/acceptance/`.
- M9 cutover requires the human session gates in the migration contract; automated checks cannot waive them.

## Durable Context

- Keep current status in `docs/progress.md`.
- Keep daily decisions and blockers in `docs/memory/YYYY-MM-DD.md`.
