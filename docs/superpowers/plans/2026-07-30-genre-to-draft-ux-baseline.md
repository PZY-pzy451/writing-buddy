# Phase 1.2B Genre-to-Draft UX Baseline

Date: 2026-07-30

Scope: Gate A UX baseline and Gate B/C interaction contract

## Current experience

The existing desktop already provides a coherent author journey, but its
new-project wizard defaults to “a few ideas” rather than genre-led creation.
The journey can generate story core, directions, an ordered outline, and three
chapter proposals. It already persists author edits, locks, ordering, impacts,
and restoration in the project.

Current acceptance evidence:

- `docs/acceptance/screenshots/phase-1.2c-guided-development/01-six-honest-starts-paper-1536x992.png`
- `docs/acceptance/screenshots/phase-1.2c-guided-development/04-reordered-outline-midnight-reduced-1280x800.png`
- `docs/acceptance/screenshots/phase-1.2c-guided-development/06-opened-first-chapter-paper-1024x720.png`

The baseline language is warm paper on the primary writing path, quiet
navy/chrome around it, restrained copper emphasis, compact status copy, and
author-owned confirmation. The genre journey must look like the same product.

## Current UX gaps

- Genre is not the primary new-project path.
- There is no focused quick/deep genre brief.
- Authors cannot inspect exactly what genre-generation sends or excludes.
- Genre-to-outline generation has no dedicated duplicate-click, cancellation,
  single-repair, or malformed-output recovery contract.
- The current outline presentation is a guided list, not a three-pane
  structure workspace with tree, cards, and inspector.
- Root-level outline fields and rich story-beat fields are not editable in one
  place.
- Reopen acceptance does not yet cover genre input plus outline order and
  lock restoration.

## Gate B target: genre entry and generation

### New-project route

The primary wizard route is “根据题材生成小说大纲”. It is selected by default
without hiding the five existing truthful start routes.

The card explains:

- what the author supplies: genre and premise, with optional controls
- what the AI returns: an editable structured outline
- what it does not do: create chapters, overwrite a manuscript, or silently
  write Story Kernel records

Creating the project opens the existing Creation Journey at its genre step.
No chapter is created merely to make navigation easier.

### Quick mode

Quick mode keeps the first viewport decisive:

- genre, required
- one-sentence premise, required
- story scale
- ending preference
- one primary button: “生成结构化大纲”
- one secondary disclosure: “查看生成依据”

Optional details remain collapsed. The form is locally saved as a project
draft while the author types. Saving the draft never invokes AI.

### Deep mode

Deep mode reveals audience, tone, themes, constraints, and inspiration.
Switching modes never deletes entered values. Deep fields are still bounded
and cannot attach files, paths, entire project data, or secrets.

### Context preview

“查看生成依据” opens a focus-contained preview with two explicit sections:

- included: the exact non-empty author fields and their bounded values
- excluded: project/root paths, API settings and secrets, unrelated
  manuscripts, unrelated Story Kernel records, hidden app state

This is a disclosure, not an editor. Escape closes it and restores focus to
the trigger.

### Generation states

| State | Visible behavior |
| --- | --- |
| Ready | One enabled primary action after required fields are valid |
| Starting/running | Primary action becomes a disabled progress action immediately; repeated clicks admit one request |
| Cancelling | Cancel remains visible; input stays readable and saved |
| Cancelled | No partial outline; author can edit or retry |
| Strict success | The generated outline draft becomes editable and the workspace opens |
| First structure failure | One bounded repair request occurs without creating partial state |
| Second structure failure | Show a response-structure message and retry action; do not blame settings/connection |
| Connection/settings failure | Show the actual runtime failure and the existing AI settings route |

The UI never renders raw Zod errors, internal resource names, stack traces,
paths, provider payloads, or secrets.

## Gate C target: structured-outline workspace

### Information architecture

At desktop width the workspace has three coordinated panes:

1. Left: compact outline tree with root, ordered story beats, lock state, and
   semantic drag position.
2. Center: readable beat cards containing the narrative sequence and the
   primary structural actions.
3. Right: inspector for the selected root/node and all editable detailed
   fields.

Selection is shared across the three panes. A node is never “selected” in one
pane and edited in another without visible synchronization.

### Author actions

- Edit root title, logline, genre summary, central conflict, and ending target.
- Edit a beat's title, summary, goal, conflict, outcome, hook, and optional
  POV.
- Reorder unlocked nodes by pointer.
- Reorder unlocked nodes with keyboard commands.
- Lock or unlock one node.
- Delete an unlocked node with explicit confirmation.
- Undo the latest structural change.
- Save automatically and expose the current save state.

Locked nodes remain selectable and readable. Their mutating controls are
disabled with a precise reason. Moving another node around a locked node must
not mutate the locked node's content or identity.

### Responsive behavior

At 1536x992:

- all three panes are visible
- the inspector remains a comfortable editing width
- the central card column is the visual focus

At 1280x800:

- all three panes remain usable with bounded widths
- the left tree and inspector may be narrower
- pane content scrolls independently; the page does not overflow horizontally

At 1024x720:

- tree and cards remain side by side
- the inspector becomes an explicit selected-node drawer or stacked detail
  region
- no primary action, lock control, field label, or save state is clipped

Small viewport adaptation must not introduce a second page or discard
selection. Any splitter uses a visible keyboard-focusable separator and
bounded widths.

## Interaction and accessibility baseline

The `ui-ux-pro-max` skill influences this contract directly:

- interactive targets are at least 44x44 CSS pixels
- every pointer reorder has keyboard parity
- focus indicators remain visible in Paper and Midnight themes
- modals/drawers trap focus and restore it on Escape/close
- status is not conveyed by color alone
- foreground/background contrast remains readable
- transitions stay within roughly 150-300 ms
- reduced motion removes non-essential movement
- icons use the existing SVG icon system, not decorative Unicode glyphs
- controls use concise verbs and one visible primary action per state

Drag feedback states the resulting order in text. Live announcements are
polite and do not repeat on every pointer movement.

## Loading, empty, error, and restoration states

- Empty genre draft: explain the two required fields without a dead-end blank
  pane.
- Empty outline: remain on the saved genre brief with a clear generation
  action.
- Loading: retain the form and disclose cancellation; no skeleton replaces
  author input.
- Error: retain input, identify the actual failure class, and offer the
  narrowest recovery.
- Restored: reopen the same project and reconstruct genre input, root text,
  beat text, order, selected valid node, and lock state from project storage.
- Stale downstream state: preserve author work and use existing impact/stale
  semantics; never silently regenerate.

## Acceptance tasks

The final silent acceptance uses visible controls only:

1. Create a fresh project with the default genre start.
2. Set genre to `都市悬疑`.
3. Enter a one-sentence premise.
4. Open generation-basis preview and verify included/excluded disclosure.
5. Generate one structured outline.
6. Edit one root field.
7. Move two nodes.
8. Lock one node.
9. Edit another node.
10. Close and reopen the project/application.
11. Verify the root edit, node edit, order, and lock state.

Acceptance must also verify:

- one AI request for rapid repeated activation
- cancel leaves saved input and no partial outline
- malformed first output gets one repair only
- malformed repaired output leaves state unchanged
- zero uncaught browser exceptions
- zero horizontal page overflow at all three required viewports
- no visible interactive control outside its scrollable region
- 44 px minimum targets, keyboard reorder, focus restoration, and reduced
  motion

## Explicit exclusions

Gate A-C do not:

- materialize chapters or scenes
- write a manuscript
- add contextual drafting actions to the editor
- reconcile post-writing Story Kernel facts
- redesign the project tree, DeepSeek runtime, AI Drawer, or StoryForge
- start Gate D
