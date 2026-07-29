# Phase 1.2A Gate D: Quick Capture and Entity Peek

Status: complete
Updated: 2026-07-29

## Goal

Let an author record an idea without leaving the manuscript, organize it later,
and inspect an exactly linked Story resource without changing the current route,
selection, cursor, or scroll position.

## Existing systems to reuse

- The current project, editor, writer-session, Story Repository, MentionLink,
  Evidence/TextAnchor, task dock, global create menu, status bar, and Story
  resource routes remain canonical.
- `createTextAnchor` / `resolveAnchor` provide portable manuscript anchoring.
- `MentionLink` remains the only exact manuscript-to-Story-resource binding.
- Story resources are fetched through `StoryRepository.get` only when a Peek is
  requested; the manuscript DOM will not receive the complete Story database.
- No new AI action, Story resource type, router, editor model, or parallel Story
  repository is introduced.

## Data contract

Project author data is stored in
`.writing-buddy/inbox/quick-captures.json`, included in snapshots and backups.
It is not stored only in browser preferences.

```ts
type QuickCaptureType =
  | 'idea'
  | 'revision'
  | 'foreshadowing'
  | 'character'
  | 'world';

type QuickCaptureStatus = 'inbox' | 'later' | 'converted' | 'dismissed';

interface QuickCapture {
  id: string;
  projectId: string;
  type: QuickCaptureType;
  text: string;
  chapterId?: string;
  sceneId?: string;
  anchor?: TextAnchor;
  status: QuickCaptureStatus;
  createdAt: string;
  updatedAt: string;
  convertedResourceId?: string;
}
```

The versioned state parser rejects malformed records and the native command
enforces a project write lock, JSON shape, size limit, expected hash, and atomic
write. Missing files load as an empty state.

## Quick Capture behavior

Entry points:

- `Ctrl/Cmd+Shift+Space`
- editor status bar **快速记录**
- global **新建** menu
- selection toolbar **记录想法**

The dialog:

- starts with the current selection when invoked from the selection toolbar;
- otherwise links the current paragraph around the cursor when a non-empty
  paragraph exists;
- records chapter, current scene, and a portable text anchor automatically;
- requires only type and text;
- saves with `Ctrl/Cmd+Enter`, closes with `Escape`, and restores manuscript
  focus without changing its selection;
- does no AI request and does not edit manuscript text.

## 待整理箱 behavior

The existing task dock gains a **待整理** tab with a project-scoped count.
Captures can be grouped or filtered by type and chapter, and support:

- converting to a formal character, location, item, foreshadowing, or world
  rule through the existing Story Repository;
- postponing to `later`;
- dismissing;
- jumping to a still-resolvable source anchor.

Conversion uses a deterministic capture-derived resource ID so a retry cannot
create duplicates. The capture retains `convertedResourceId`, and an anchored
capture creates a canonical MentionLink to the converted resource.

## Entity Peek behavior

- `Ctrl/Cmd+click` on an exact active MentionLink opens an inline card.
- Hover may open the card only for resource kinds whose opt-in manuscript
  highlighting is enabled.
- A point covered by multiple active mentions shows a chooser before loading
  one resource.
- No fuzzy name matching or guessed association is allowed.
- Peek loads only the selected Story resource and its backlinks.
- `Escape` closes and restores editor focus; `Enter` explicitly opens full
  details. Opening details is the only Peek action that changes the route.
- Closing Peek leaves the chapter route, editor selection, cursor, and scroll
  unchanged.

## Accessibility and responsive contract

The `ui-ux-pro-max` guidance is applied directly because the installed skill
does not contain its referenced search helper:

- 44 px interactive targets for primary dialog/dock controls;
- visible keyboard focus and semantic dialog/listbox/tab states;
- 150–300 ms transitions, disabled under reduced motion;
- no page-level horizontal overflow at 1536×992, 1280×800, or 1024×720;
- overlays remain inside the viewport and do not obscure their focus target.

## Test-first gates

1. Parser, serialization, anchor creation/resolution, and deterministic
   conversion tests fail before the model/service exists.
2. Bridge/native tests prove missing-file, invalid-state, stale-hash,
   read-only, atomic-write, snapshot/backup inclusion, and browser fixture
   parity.
3. React tests prove all four entry points, save/Escape shortcuts, count,
   inbox actions, source jump, and focus restoration.
4. Entity Peek tests prove exact-link-only lookup, overlap chooser,
   on-demand resource loading, route preservation, Enter/Escape behavior, and
   opt-in hover.
5. Full self-test, production build, Cargo format/tests, real responsive
   interaction, fresh Tauri release/NSIS package, and native launch/close pass
   before the exact Gate D commit.

## Stop line

Stop after Quick Capture, 待整理箱, TextAnchor association, Entity Peek, focus
restoration, acceptance evidence, and the exact commit:

`feat: add quick capture and inline story reference`

Contextual AI, Writer Navigator, chapter organization, new Story resource
types, and new AI actions remain out of scope.
