# Phase 1.2K — Daily writing progress

Updated: 2026-08-02

## Outcome

Give authors a small, trustworthy reason to return tomorrow: Writing Buddy
shows how many net-new manuscript words were produced today, how much remains
against a project-specific goal and whether today's goal is complete. Progress
survives restart without changing or polluting the project files.

## Priority decision

The comparison uses a normalized cohort of 100 target authors per quarter.
There is no production analytics baseline, so confidence remains at or below
60%. RICE is `Reach × Impact × Confidence ÷ Effort`.

| Candidate | Lens | RICE calculation | Score |
| --- | --- | --- | ---: |
| Daily writing goal | Enabler | `75 × 1 × 0.50 ÷ 1.5` | 25 |
| One-click whole-work consistency pass | Enabler | `45 × 2 × 0.60 ÷ 3` | 18 |
| Scene plot grid | Enabler | `55 × 2 × 0.60 ÷ 4` | 16.5 |

Daily progress is selected for this cycle. It has the highest score and closes
the explicit daily-use gap in the writer-centered product brief. No Blocker is
present in this candidate set after safe import, recovery and export shipped.

## Gate A — deterministic progress model

- Keep a project-scoped daily goal and bounded local-day ledger.
- Count only net manuscript word changes produced through the editor. Undo and
  failed AI insertion rollback must reverse the corresponding credited words;
  opening or importing existing prose must not inflate today's result.
- Use local calendar dates instead of UTC dates for day rollover.
- Guard and migrate persisted values; malformed or excessive data falls back
  safely and at most 120 recent days remain.

## Gate B — quiet writer integration

- Show today's words and target beside the existing chapter/save information.
- Keep goal editing inside a secondary disclosure with an explicit label,
  numeric bounds, keyboard submission and adjacent validation feedback.
- Keep a compact progress reading in the status bar; on narrow windows it has
  priority over less important counters.
- Do not add a new navigation destination or turn the writing page into an
  analytics dashboard.

## Gate C — useful writing-home summary

- Show the same project progress on the writing home without duplicating state.
- Explain remaining words or completion in plain language.
- State that the metric is a local, net-new manuscript count so authors know
  what it measures.

## Gate D — evidence and release

- Cover date rollover, malformed persisted data, goal validation, edit/undo/
  redo behavior and project isolation with unit and experience tests.
- Verify keyboard focus, 44 px actions and no horizontal overflow at desktop
  and narrow viewports.
- Run TypeScript, focused tests, complete self-test, Tauri/NSIS packaging and
  native executable smoke before delivery.
