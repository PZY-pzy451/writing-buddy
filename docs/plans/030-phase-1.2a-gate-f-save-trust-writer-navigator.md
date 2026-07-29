# Phase 1.2A Gate F: save trust and Writer Navigator

Status: complete
Updated: 2026-07-29

## Goal

Make manuscript persistence continuously understandable and recoverable, and
let an author reach chapters, scenes, manuscript occurrences, Story resources,
settings, and existing commands from one keyboard-first navigator.

This gate adds no Story resource type, AI action, Prompt, provider, router,
cloud service, resident process, or second project/search database.

## Existing systems to reuse

- `DocumentSession`, its Monaco model, original content, disk hash, version,
  cursor, EOL/BOM, and the native hash-checked atomic writer remain the only
  manuscript save path.
- The existing external-conflict dialog already preserves both local and disk
  content and exposes save-copy, reload, and explicit overwrite operations.
- Writer Session version 2, project-local Quick Capture writes, AI candidate
  stores, snapshots, backups, Story Repository, Story routes, resource tabs,
  and `requestEditorReveal` remain canonical.
- `TextAnchor`, `createTextAnchor`, and `resolveAnchor` remain the only
  manuscript position portability contract.
- `DesktopStoryRepository` and the project snapshot provide resource metadata.
  Manuscript occurrence search reads chapter files only after a non-empty
  author query; it is not part of startup.
- `Ctrl/Cmd+Shift+F` keeps the existing full search page. `Ctrl/Cmd+K` opens
  the new task-oriented Writer Navigator.

## Save-state contract

Use one explicit runtime state:

```ts
export type SaveState =
  | { type: 'clean'; savedAt: string }
  | { type: 'dirty' }
  | { type: 'saving'; startedAt: string }
  | { type: 'offline'; pendingChanges: number }
  | { type: 'failed'; errorCode: string; retryable: boolean }
  | { type: 'external_conflict'; detectedAt: string };
```

Transitions:

- opening or reloading a document establishes `clean`;
- the first content change establishes `dirty`;
- an explicit save establishes `saving`;
- successful atomic write establishes `clean` only if the editor content still
  equals the payload that reached disk;
- edits made while an earlier write is in flight remain `dirty` after that
  write completes;
- an external hash mismatch establishes `external_conflict` without
  overwriting either side;
- unavailable storage establishes `offline`; other safe error codes establish
  `failed`;
- retry, save-copy, disk reload, and explicit overwrite reuse the existing
  write operations.

All visible save surfaces use the same text-first state. The writer header and
status bar may repeat the state where focus mode requires it, but they cannot
derive their own dirty/clean wording. Persistent failure uses an inline fixed
recovery banner with **重试**, **另存副本**, and collapsed safe diagnostics.
Transient global success toasts are not introduced.

The save engine must fix the existing concurrent-edit hazard: a completed
write records the exact payload sent to disk, not whatever content happens to
be in the mutable session at completion time.

## Close-protection contract

A pure close decision distinguishes:

- `clean`: flush Writer Session and allow normal close;
- `saving`: prevent close and show a waiting state until the in-flight write
  resolves;
- `dirty`, `offline`, `failed`, or `external_conflict`: prevent silent close
  and show a keyboard-accessible protection dialog.

The dialog offers context-appropriate save/retry, save-copy, explicit discard,
and cancel actions. It states that Quick Captures are already persisted and
that unconfirmed AI candidates are not written into the manuscript. A final
accepted close flushes Writer Session last and destroys only the current Tauri
window. Browser `beforeunload` retains the native browser warning fallback.

## Writer Navigator contract

`Ctrl/Cmd+K` and the top search control open one modal command palette. Opening
is synchronous and does not wait for an index, Story resource list, manuscript
scan, or AI.

Results are visually grouped as:

- chapters;
- scenes;
- manuscript occurrences;
- characters, locations, items, events, plot threads, foreshadowing, and
  other existing Story resource kinds;
- settings;
- existing local commands.

Behavior:

- Up/Down moves the active option; Home/End jump within the result set;
- Enter opens the selected result;
- Ctrl/Cmd+Enter keeps the palette open and shows a side preview;
- Escape closes and restores the previously focused element;
- manuscript results carry an exact `TextAnchor`; opening rereads the current
  chapter, resolves the anchor, then uses the existing resource/reveal path;
- a stale anchor falls back to its bounded nearby offset and reports a
  non-blocking notice rather than opening a modal;
- only stable result IDs are remembered as recent choices; author text,
  titles, paths, Prompts, and AI output are never persisted;
- commands and search results have distinct roles and visual treatment;
- no Writer Navigator action sends an AI request.

Manuscript search is an on-demand, bounded-concurrency scan with an in-memory
per-project chapter cache. It never blocks application startup, creates no
project index, and discards its cache when the app process exits.

## Accessibility and responsive contract

The installed `ui-ux-pro-max` package lacks its required `scripts/search.py`,
so its fully loaded rules are applied directly:

- one primary recovery action, with lower-weight alternatives;
- 44 px effective controls and visible focus;
- input label, combobox/listbox semantics, active-descendant announcement,
  and logical keyboard order;
- status uses text and icon rather than color alone;
- 150–220 ms opacity/transform transitions and reduced-motion override;
- no page overflow or clipped controls at 1536×992, 1280×800, or 1024×720.

## Test-first gates

1. `DocumentSession` and save-state tests fail before exact-payload completion,
   deterministic state transitions, safe error classification, and shared
   wording exist.
2. Store tests fail before saving/dirty/concurrent-edit/conflict/retry/save-copy
   behavior is represented by one state.
3. Close-decision and UI tests fail before saving wait, persistent failure,
   explicit discard, session flush, and focus-safe cancellation exist.
4. Navigator model/service tests fail before grouped metadata, bounded
   manuscript search, exact TextAnchor results, recent stable IDs, and stale
   fallback exist.
5. Navigator UI/integration tests fail before Ctrl/Cmd+K, keyboard selection,
   Enter, Ctrl/Cmd+Enter preview, Escape focus restore, and no-AI navigation
   pass.
6. Full self-test, production build, Cargo format/tests, real responsive
   interaction, fresh Tauri Release/NSIS, native launch/close, and the exact
   Gate F commit pass before handoff.

## Stop line

Stop after save trust, recovery/close protection, Writer Navigator,
TextAnchor navigation, acceptance evidence, and the exact commit:

`feat: improve save trust and writer navigation`

Drop Preview wording, drag-result Toasts, the broader shortcut/accessibility
polish pass, Gate H human profiles, new AI actions, and new Story resource
types remain out of scope until a new user direction authorizes Gate G.
