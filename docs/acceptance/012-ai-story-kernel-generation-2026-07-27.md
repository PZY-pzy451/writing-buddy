# AI Story Kernel direct generation acceptance

Date: 2026-07-27

Branch: `codex/ai-story-kernel-generation`

## Outcome

Writing Buddy can now ask DeepSeek to generate complete Story Kernel resource
candidates directly from the current chapter or selection. The result is not
written silently: it is strictly parsed, hydrated with application-owned
metadata, checked for schema/reference/concurrency conflicts, persisted as a
pending batch and shown to the author. Only selected, conflict-free candidates
enter formal `story/**/*.json` files.

## Author flow

```text
chapter or selection
→ author instruction and allowed types
→ bounded DeepSeek JSON stream
→ strict complete-resource candidates
→ evidence/schema/reference/dependency checks
→ pending batch
→ author inspection and selection
→ safety snapshot
→ one atomic StoryRepository transaction
→ accepted status
```

The writing assistant now has a fourth **Kernel** tab. It provides:

- a generation instruction;
- eleven target-type controls;
- chapter/selection and privacy disclosure;
- streaming length and cancellation state;
- candidate operation, confidence, rationale and evidence;
- blocking conflict messages that do not rely on color alone;
- expandable normalized JSON;
- per-candidate rejection and multi-select confirmation.

All primary controls retain 44px minimum targets, visible keyboard focus and an
internal scrolling region. Read-only projects cannot start a write-producing
generation.

## Trust and data safety

- The AI never receives a project root, credential, API key, absolute path or
  author-secret information identity.
- The AI cannot supply filesystem paths, schema version, timestamps, revision,
  confirmation state or evidence IDs.
- Responses are capped at 24 candidates and parsed as strict JSON.
- Full type-specific Story schemas run before a candidate can be selected.
- Duplicate IDs, create collisions, missing update targets, invalid evidence,
  missing references and blocked dependencies are explicit blocking conflicts.
- Generated author-secret information is forced to
  `excludeFromAiByDefault: true`.
- Create confirmation uses `expectedAbsent`; update confirmation uses the
  staged expected revision.
- A failed repository transaction leaves all candidate decisions pending.
- The UI creates a local safety snapshot before the single atomic commit.

Pending batches live at:

```text
.writing-buddy/ai/story-kernel-generation/index.json
```

They are included in snapshots and `.wbbackup` archives. Derived AI cache and
incomplete job paths remain excluded.

## Automated verification

Node 24 acceptance:

```text
52 test files passed
153 tests passed
ESLint passed
TypeScript passed
Vite production build passed
```

Focused coverage includes:

- request/response boundaries and forbidden system fields;
- create-only repository protection;
- successful multi-resource dependency validation;
- one-call atomic batch confirmation;
- collision and dependent-candidate blocking;
- transaction failure with zero partial writes;
- snapshot-before-commit UI ordering;
- read-only UI protection;
- snapshot and backup inclusion.

Rust:

```text
35 normal tests passed
0 failed
2 release-only gates ignored by the normal suite
```

Release performance:

| Metric | Result |
| --- | ---: |
| Project interactive | 441.7083 ms |
| Resource switch | 0.7005 ms |
| Single resource save | 0.0056 ms |
| Timeline feedback | 4.2447 ms |
| Filtered graph | 0.1968 ms |

Sanitized recovery:

| Check | Result |
| --- | --- |
| Backup/restored entries | 47 / 47 |
| Manuscript hashes | 6 / 6 identical |
| Story backlinks | 89 / 89 resolved |
| Second launch | passed |

## Production artifacts

Portable executable:

```text
tmp/ai-story-kernel-target-final/release/writing-buddy-next.exe
SHA-256 53e399e3a29c32baa9091ae2ab1534f29c7b869d2aa1ffcfb1a706f0540dd852
```

NSIS installer:

```text
tmp/ai-story-kernel-target-final/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe
SHA-256 3b3ab29f8687f7991a7a75ed80cb2f0470248b6623cd8bf0850a7573d8486628
```

The first production launch accepted a normal window close and exited. The
second launch remained responsive and was left running for the user.

## Known external validation

The browser fixture and deterministic tests exercise the complete flow without
a real credential. Live model discovery, account balance, generation quality
and cancellation still require the user's valid DeepSeek key and network
access. No key is stored in the repository or project.
