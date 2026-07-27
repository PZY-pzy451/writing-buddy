# StoryForge migration, version and recovery acceptance

Date: 2026-07-27

Branch: `codex/phase-1.0a-deepseek-ai-foundation`

Task: Gate F / Task 23

## Outcome

Story Kernel schema v1 now has a pure v0-to-v1 staging contract. A migration
produces a validated candidate and an exact rollback payload before any caller
is allowed to write. It never mutates the supplied author object and does not
silently migrate an unsupported v2+ resource.

Version snapshots and `.wbbackup` archives retain formal `story/**/*.json`
resources and author-reviewed AI pending facts. Rebuildable indexes, runtime
locks, AI temporary jobs and AI caches are excluded. Restore clears those
derived directories and invalidates the in-memory Story Index so the next read
rebuilds from restored canonical files.

## Migration contract

`packages/story-kernel/src/schema/migrations/v0-to-v1.ts` provides:

- `stageStoryResourceV0ToV1(input, migrationTimestamp)`
- `commitStoryResourceV0ToV1(plan)`
- `rollbackStoryResourceV0ToV1(plan)`

The staged migration:

- changes only `schemaVersion: 0` or an unversioned v0 resource;
- maps legacy `name` to `title`;
- adds deterministic base defaults and timestamps supplied by the caller;
- validates the complete type-specific result through `StorySchemaRegistry`;
- preserves author-secret policy;
- keeps an exact JSON rollback copy;
- performs no filesystem or network operation.

Four focused tests cover non-mutation, commit, exact rollback, author secrets,
invalid resources and unsupported versions.

## Inclusion policy

| Path | Snapshot | `.wbbackup` | Reason |
| --- | --- | --- | --- |
| `.writing-buddy/project.json` | included | included | canonical project |
| `chapters/**/*.md` | included | included | author manuscript |
| `references/**` | included by known type | included | legacy-compatible author data |
| `story/**/*.json` | included | included | formal Story Kernel facts |
| `.writing-buddy/review/**` | included | included | author review decisions |
| `.writing-buddy/ai/pending-facts/**` | included | included | author-reviewed candidates |
| `.writing-buddy/ai/story-kernel-generation/**` | included | included | validated AI resource batches awaiting author decisions |
| `.writing-buddy/cache/**` | excluded | excluded | rebuildable index |
| `.writing-buddy/runtime/**` | excluded | excluded | process-local state |
| `.writing-buddy/ai/tmp/**` | excluded | excluded | incomplete AI jobs |
| `.writing-buddy/ai/cache/**` | excluded | excluded | rebuildable AI cache |
| `.writing-buddy/history/**` | external to snapshot payload | excluded | avoids recursive archives |

Snapshot policy is exercised by Rust unit tests. Backup policy is verified both
with a minimal fixture and the sanitized six-chapter project copy.

## Sanitized real-project drill

Command:

```powershell
.\scripts\acceptance\verify-storyforge-recovery.ps1
```

Source: `tmp/storyforge-gate-d-project-20260727`, copied to an isolated staging
directory before the drill.

Result:

| Check | Result |
| --- | --- |
| Project ID | `project-0000000a` |
| Backup entries | 47 |
| Restored entries | 47 |
| Formal Story files | 30 |
| Chapter hashes | 6/6 identical to `fixture.expected.json` |
| Story ID backlinks checked | 89 |
| Unresolved backlinks | 0 |
| First restored open | passed, writable |
| Second restored open | passed, same project ID |
| Derived Story Index in archive | absent |
| AI temporary job in archive | absent |

The test compares every policy-included byte before backup and after restore,
not only the manifest. Machine-readable evidence is in
[`storyforge-data-recovery.json`](./storyforge-data-recovery.json).

## Recovery safety

- Archive metadata and every entry retain SHA-256 verification.
- Paths reject absolute, traversal, separator-confused and duplicate entries.
- Restore prepares a pre-restore snapshot through the desktop command.
- Formal files are written atomically.
- Rebuildable caches are removed after the destination root is canonicalized.
- Story Index memory and disk caches are invalidated after version or backup
  restore.
- The original sanitized source copy is read-only during the drill; all writes
  occur in temporary staging and restore directories that are removed after
  verification.

## Verification

- Migration tests: 4/4 passed
- Rust archive policy test: passed
- Sanitized real-project recovery test: passed
- Second open: passed
- Backlinks: 89/89 resolved
- Manuscript hash compatibility: 6/6 unchanged
