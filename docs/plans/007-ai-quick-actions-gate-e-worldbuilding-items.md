# AI Quick Actions Gate E — Worldbuilding and Items

Date: 2026-07-27

Status: accepted

## Goal

Complete original Tasks 15–17 with two dedicated, author-controlled workflows:

- generate structured locations, factions, cultures, religions, technology,
  magic, law, and general world rules;
- extract structured worldbuilding entries from one explicitly selected
  chapter;
- generate item cards and histories, or extract items, holders, locations, and
  transfer candidates from one chapter;
- write nothing until the author confirms individual fields and state events.

The dependency direction remains:

`React page -> application review service -> Story Repository / state port -> Rust AI boundary`.

## Fixed AI purposes

- `world-analysis`
- `item-analysis`

Both request contracts contain:

- one P0 author instruction;
- one bounded P1 chapter body with chapter ID, source hash, and narrative
  order;
- sanitized identities and revisions for only the relevant existing Story
  Kernel resources;
- an explicit action and, where required, target type or selected item ID.

Project roots, absolute paths, credentials, API keys, hidden history, and
author-secret information are forbidden at both TypeScript and Rust
boundaries.

## Worldbuilding contract

Actions:

- `generate-world-entry`
- `extract-worldbuilding`

Generation requires one target type:

- `location`
- `faction`
- `culture`
- `religion`
- `technology`
- `magic`
- `law`
- `world-rule`

The target type decides the strict candidate schema:

- Location: title, aliases, summary, location type, optional known parent, and
  scoped local rules.
- Faction: title, aliases, summary, ideology, goals, and optional known
  territories.
- World rule: title, aliases, category, statement, mandatory scope,
  exceptions, consequences, and explicit conflicts with known rules.

Culture, religion, technology, magic, and law are stored as structured
`WorldRule` resources with their matching category. `scope` is added as an
optional backward-compatible model field; AI-created rules require it.

Extraction may return up to 24 entries and requires exact JavaScript UTF-16
evidence for every entry. Long prose is split into independent candidates.

Candidate staging:

- deduplicates normalized titles and aliases within the batch;
- finds same-type existing resources by normalized title or alias;
- shows field conflicts and deselects them by default;
- validates parent/territory/conflict references against supplied identities;
- flags an existing rule with the same category and normalized scope but a
  different statement;
- never overwrites an existing resource without an explicit selected-field
  merge.

## Item contract

Actions:

- `generate-item`
- `generate-item-history`
- `extract-items`

Each candidate contains a strict item card plus zero or more state-event
candidates:

- card: title, aliases, item type, uniqueness, quantity unit, appearance or
  description, restrictions, and narrative function;
- event: acquired, transferred, used, lost, destroyed, or adjusted; quantity,
  optional known holder/location, condition, and exact story position.

Extraction requires exact evidence for the card and every returned event.
Holder and location IDs must come from the sanitized supplied identities.

Candidate staging:

- merges normalized duplicate candidates;
- treats same-name existing items as explicit merge candidates;
- presents card fields and state events as separately selectable;
- simulates the existing deterministic item rules before confirmation;
- blocks a state event that would create overlapping holders for a unique item
  and shows the conflict;
- creates confirmed `ItemState` records only for selected, non-blocking events.

## Apply safety

Before either workflow writes:

1. re-read the selected chapter and require the same source hash and content;
2. re-read the matched resource and require the staged revision;
3. validate selected field/event IDs and reject blocking candidates;
4. create a project snapshot;
5. create with `expectedAbsent` or update with the expected revision;
6. persist only selected item states through the existing atomic state-file
   port.

## Page UX

- Worldbuilding adds **AI 世界观助手** in the header and empty state.
- Items adds **AI 物品助手** beside transfer and in the empty state.
- Both reuse the warm-paper review drawer, Lucide icons, minimum 44px targets,
  visible keyboard focus, explicit loading/cancel/error/conflict/success
  states, independent scrolling, and responsive behavior at 1536, 1280, and
  1024px.
- Evidence buttons open the source chapter at the exact accepted range.
- No AI request starts merely by opening a drawer or selecting an action.

## Acceptance order

1. TypeScript schema and Rust request validation tests.
2. World and item staging/apply service tests for deduplication, evidence,
   conflicts, stale revisions, selected-only writes, and unique-item rules.
3. Page tests for entry points, structured candidates, conflict presentation,
   and evidence navigation.
4. Typecheck, smallest Vitest targets, full `pnpm acceptance`, Rust formatting
   and tests.
5. Sanitized browser captures and metrics at 1536, 1280, and 1024px.
6. One-job Cargo release build, desktop smoke, durable acceptance evidence,
   commits, and remote push.

## Acceptance

Accepted on 2026-07-27. Durable evidence:
`docs/acceptance/017-ai-quick-actions-gate-e-2026-07-27.md`.
