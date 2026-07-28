# AI Story Kernel direct generation plan

Date: 2026-07-27

Branch: `codex/ai-story-kernel-generation`

## Goal

Allow DeepSeek to generate complete, strict Story Kernel resource candidates
from the current chapter or selection and an explicit author instruction.
Candidates may represent characters, scenes, locations, factions, items, world
rules, timeline events, relationships, plot threads, foreshadowing or story
information.

"Direct generation" means the AI returns complete structured resources rather
than loose prose facts. It does not mean unreviewed direct writes. Formal
`story/**/*.json` data changes only after explicit single or batch author
confirmation.

## Trust boundary

The generation flow is:

```text
chapter/selection + author instruction
→ bounded generation request
→ DeepSeek JSON-only stream
→ strict response parser
→ hydrate system fields
→ StorySchemaRegistry validation
→ collision/dependency/conflict checks
→ pending generation batch
→ author review
→ pre-commit snapshot
→ atomic StoryRepository transaction
→ accepted candidate status
```

The AI cannot choose filesystem paths, schema versions, timestamps, revisions,
confirmation state or arbitrary evidence IDs. Those values are owned by the
application.

## Request contract

The request contains only:

- schema version;
- author instruction;
- current chapter/selection ID and revision;
- current chapter/selection text;
- selected target resource types;
- bounded existing-resource identities: type, ID, title and revision.

Existing author-secret information is excluded. Project roots, API keys,
credentials, absolute paths and hidden history are forbidden.

## Response contract

The JSON response contains at most 24 candidates:

```json
{
  "candidates": [
    {
      "operation": "create",
      "resource": {
        "id": "character:lin-yue",
        "type": "character",
        "title": "林越",
        "aliases": [],
        "tags": [],
        "factionIds": [],
        "goals": [],
        "desires": [],
        "fears": [],
        "values": [],
        "secrets": [],
        "evidenceIds": []
      },
      "confidence": 0.9,
      "rationale": "正文明确引入该人物。",
      "evidence": {
        "start": 0,
        "end": 2,
        "quote": "林越"
      }
    }
  ]
}
```

`operation` is `create` or `update`. The `resource` object must contain the
complete type-specific author fields, but must not contain `schemaVersion`,
`createdAt`, `updatedAt` or `revision`.

## Staging and conflicts

Staging:

- anchors evidence to the exact supplied UTF-16 range or rejects the anchor;
- strips AI-supplied evidence IDs and creates an application-owned evidence ID;
- sets schema version, timestamps and revision;
- preserves existing timestamps/evidence for updates;
- forces author-secret information to remain excluded from future AI context;
- validates every resource with `StorySchemaRegistry`;
- checks duplicate IDs in the response;
- distinguishes create collisions from missing update targets;
- verifies referenced Story IDs against current resources, the current chapter
  and other candidates in the same batch;
- records blocking conflicts without writing formal data.

## Confirmation

The author can:

- inspect type, operation, confidence, rationale and evidence;
- inspect the full normalized JSON;
- reject one candidate;
- confirm one unblocked candidate;
- select and atomically confirm multiple unblocked candidates.

Before a formal commit the UI creates a safety snapshot. Batch confirmation
uses one `StoryTransaction`/repository commit. A failed schema, revision or disk
operation leaves the complete batch pending.

## UI

The writing assistant gains a fourth **Kernel** tab:

- explicit instruction input;
- chapter/selection source indicator;
- target-type checkboxes;
- generate/cancel status;
- pending/blocked/accepted counters;
- candidate selection and batch confirmation;
- expandable normalized JSON;
- nearby validation and conflict messages.

Controls retain 44px targets, visible focus, labeled fields, no color-only
status, reduced-motion behavior and internal full-height scrolling at compact
widths.

## Implementation tasks

1. Add AI request/response contracts and isolated `story-kernel-generation`
   runtime purpose in TypeScript and Rust.
2. Add the pure generated-candidate model, storage file and staging service.
3. Add collision, dependency and atomic confirmation tests.
4. Add the assistant Kernel tab and candidate review UI.
5. Add browser-fixture generation, responsive tests and a vertical-slice test.
6. Run Node 24 acceptance, Rust tests, production Tauri build and desktop
   close/restart verification.

## Acceptance

- malformed or over-broad AI responses never reach `StoryRepository`;
- no formal Story file changes before author confirmation;
- create/update revision conflicts remain visible and pending;
- an all-valid selected batch commits atomically;
- generated author secrets are excluded from future AI context by default;
- keyboard and compact-width operation remain usable;
- existing tests and Gate F compatibility/recovery/performance contracts
  remain green.

## Completion

Implemented on 2026-07-27. Final validation:

- Node acceptance: 52 test files / 153 tests;
- Rust: 35 normal tests passed, two release-only gates explicitly ignored;
- 266,001-record release performance gate passed;
- sanitized real-project recovery restored 47/47 entries, preserved 6/6
  chapter hashes and resolved 89/89 backlinks;
- fresh Tauri executable and NSIS installer built in
  `tmp/ai-story-kernel-target-final`;
- normal close succeeded and the second production launch remained responsive.
