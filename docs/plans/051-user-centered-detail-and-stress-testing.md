# Phase 1.2S user-centered detail and stress testing

Updated: 2026-08-02

## Objective

Validate Writing Buddy from the author's point of view at both detail and load:
every visible task must explain what happens, respond to pointer and keyboard,
survive realistic interruption, preserve author data and remain usable when the
project, manuscript or interaction rate grows.

This cycle extends Phase 1.2R. Passing implementation-oriented unit tests is not
enough; each gate must state the user task, the visible success signal and the
failure/recovery expectation.

## User perspectives

| User | Primary concerns |
| --- | --- |
| First-time author | Can start a project without understanding the data model |
| Returning author | Reopens at the expected chapter with trustworthy save state |
| Long-form author | Large manuscripts and projects remain responsive and intact |
| Keyboard-only author | All core tasks have reachable focus and predictable escape |
| Compact-screen author | Controls remain visible, readable and tappable at minimum size |
| Interrupted author | Reload, duplicate input, cancellation and failure do not lose work |
| Delivering author | Export, backup, restore and release evidence remain truthful |

## Detail contract

Each core surface is checked for:

1. one clear current task and no dead primary action;
2. accessible name, keyboard reachability, visible focus and Escape behavior;
3. minimum target size, viewport containment, intended internal scrolling and
   no control occlusion;
4. visible idle/loading/success/error feedback without raw implementation codes;
5. cancellation, retry, undo and reload behavior where the action mutates data;
6. persistence and source-freshness signals after reopening;
7. truthful empty, partial, invalid and read-only states.

Surfaces include Welcome, Writing Home, writer/navigation/editor, Planning,
Story Library and every resource view, Check, History/export/backup, Settings,
quick capture, contextual AI, Story Kernel candidates, import and project
creation.

## Stress contract

| Dimension | Deterministic load | Gate |
| --- | ---: | --- |
| Interaction soak | 30 workspace transitions with periodic reload | no runtime error, state drift or stuck overlay |
| Resize soak | 40 splitter drags across min/max | constraints persist; no clipped core action |
| Duplicate action | 100 rapid attempts | one in-flight mutation per logical action |
| Story Kernel repair | all 11 generatable resource types across valid, partial and malformed candidates | valid candidates remain confirmable; invalid candidates remain recoverable |
| Long manuscript | at least 100,000 visible characters | editor opens, edits, saves and reopens within budget |
| Large project | 1,000 chapters, 10,000 scenes, 5,000 resources, 50,000 events/states, 200,000 mentions | every indexed operation remains below its declared threshold |
| Recovery soak | 10 sanitized backup/restore/reopen cycles | exact chapter hashes and zero unresolved backlinks every time |
| Release soak | repeated production launch/close samples | no early exit, orphan process or debug port |

## Execution order

1. Inventory current coverage and map it to visible user tasks.
2. Add missing user-detail and deterministic stress gates.
3. Run focused gates and classify each failure as product, test, or host defect.
4. Fix reproducible product defects and strengthen the relevant assertion.
5. Run the complete Phase 1.2R matrix plus the new Phase 1.2S soak matrix.
6. Rebuild production portable/NSIS, smoke the final bytes and archive reports.

## Boundaries

- Tests use isolated temporary projects and deterministic AI fixtures; no user
  manuscript, credential or live paid provider is used.
- Stress targets are release gates for this Windows host, not universal hardware
  guarantees.
- A UI control is not considered tested merely because it exists in a snapshot;
  the task must produce a visible, user-meaningful result or safe refusal.

## Acceptance

- A machine-readable user-task coverage report identifies every tested surface,
  user intent, action, result, recovery and load sample.
- All stress samples pass their budgets without data loss, raw error leakage,
  stuck busy state, unbounded duplicate work or orphan processes.
- The expanded 26-step full regression remains green after the new gates.
- Phase 1.2S produces a dated acceptance note, current progress update, Git
  commit and refreshed production EXE/installer with hashes.

## Completion

- User-detail soak: passed, including 100,661-character save/reopen, 40 resize
  attempts, 30 workspace transitions, 17 audits and all Planning/Story Library
  views.
- Stress matrix: passed 2 browser, 5 performance, 10 recovery and 5 final
  portable launch samples.
- Full regression: 26/26 steps passed from a clean source state in 644,991 ms.
- Evidence:
  `docs/acceptance/076-phase-1.2s-user-centered-detail-stress-2026-08-02.md`.
