# StoryForge professional editor

StoryForge is the structured long-form writing workspace in Writing Buddy. It
keeps manuscript text, story facts, continuity findings and AI suggestions
connected while leaving every manuscript change under author control.

## Install and run

The Windows installer is generated under:

```text
tmp/gate-f-target-final/release/bundle/nsis/
```

For local development, use Node.js 24 and pnpm 10:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

For the desktop development shell:

```powershell
pnpm tauri dev
```

For a production Windows build:

```powershell
$env:CARGO_TARGET_DIR = "$PWD\tmp\gate-f-target-final"
pnpm tauri build
```

The portable executable is then available at:

```text
tmp/gate-f-target-final/release/writing-buddy-next.exe
```

## Open and recover a work

1. Select **Works**, then **Choose project**.
2. Choose a Writing Buddy project directory, not an individual Markdown file.
3. If another live process owns the project, open it read-only or close the
   other process.
4. Close the window normally. The next launch restores the last healthy
   project and active workspace.
5. Use **Versions** before large edits to create a local safety snapshot.
6. Use **Settings / Backup** for a portable `.wbbackup` archive.

Opening a project never silently rewrites old formal Story Kernel data. A
future schema migration must first stage a validated candidate and retain an
exact rollback payload.

## Professional workspace

The Story navigation groups the editor into connected views:

- **Overview** shows project scale, recent work and continuity status.
- **Manuscript** links chapter text to scenes and precise text anchors.
- **Characters** tracks current state, goals, relationships, appearances and
  evidence.
- **Relationships** provides directed graph, matrix, time-slice and Inspector
  views.
- **Timeline** separates story chronology from narrative order and offers
  visual tracks plus an accessible list.
- **World** structures locations, factions and rules.
- **Assets** tracks item holder, location, quantity, condition and transfer
  history.
- **Plots** tracks plot-thread state and foreshadowing from plant to payoff.
- **Information** separates story truth, reader reveal, character knowledge
  and misconceptions.
- **AI context** previews exactly what will be sent for a selected rewrite.
- **Continuity** combines deterministic and optional AI-assisted review.

At narrower window sizes, the assistant becomes a drawer and dense tables gain
their own scroll region. The project page remains full height; navigation and
primary actions remain keyboard reachable.

## Manual and automatic review

Review supports both modes:

- **Manual/local review** runs deterministic text and Story Kernel checks
  without an AI key.
- **Automatic AI review** sends a bounded chapter request to the configured
  DeepSeek model and adds suggestions to the review list.

AI findings are candidates. They do not change manuscript text or confirm a
story fact automatically. Review each finding, inspect both evidence sources,
then explicitly apply, resolve or reject it.

## Grounded AI rewrite

1. Open a chapter and select the text to revise.
2. Choose polish, concise, grammar, dialogue or pacing.
3. Inspect the Context Pack. It may include the current scene, dynamic
   character state, location, assets, world rules, plot threads, foreshadowing
   and information permissions.
4. Disable any optional context you do not want to send.
5. Start generation.
6. Compare original, suggestion and Diff.
7. Accept all, accept an edited subset, save a note or reject.
8. Use **Undo** to restore the exact source text after an accepted rewrite.

Author secrets are excluded by default. AI-extracted facts enter the pending
facts area and require individual author confirmation, evidence and a story
position before they become canonical.

## Performance and recovery model

The manuscript and `story/**/*.json` files are canonical. Search/backlink
indexes under `.writing-buddy/cache/` are derived and may be deleted or rebuilt
without losing author data. Large character and timeline views render bounded
windows rather than every row at once.

Snapshots and backups include manuscript, formal Story Kernel resources,
review decisions and pending author-reviewed facts. They exclude process
locks, derived indexes and incomplete AI jobs. Restore verifies archive
hashes, rejects unsafe paths, clears stale caches and rebuilds indexes from
canonical files.

## Known limitations

The professional baseline intentionally does not include:

- cloud synchronization;
- real-time collaboration;
- whole-book automatic generation;
- an advanced fictional-calendar engine;
- a complex visual map editor.

DeepSeek model discovery, account balance and real streaming require a valid
user-provided API key and network access. The key is stored through Windows
Credential Manager and is never written into the project.
