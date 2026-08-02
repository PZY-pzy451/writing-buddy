# Phase 1.2N publish readiness

Date: 2026-08-02

## Why this cycle

The remaining product candidates were re-scored for one cycle:

| Candidate | Reach | Impact | Confidence | Effort | RICE | Lens |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Publish-readiness task | 45 | 2 | 50% | 4 | 11.25 | Blocker |
| Cross-project series bible | 25 | 2 | 40% | 6 | 3.33 | Enabler |

Publish readiness is the highest remaining candidate and a release Blocker:
Writing Buddy can draft, review, inspect consistency and export a whole work,
but it does not yet tell the author whether the current project is safe to hand
off or which exact condition should be fixed first.

## Outcome

Add an explainable `发布前检查` task to the primary Check page:

- derive one project-wide result from the current manuscript, save state,
  project integrity, review backlog, chapter completion metadata and durable
  whole-work export receipts;
- distinguish blocking conditions, author decisions and passed checks in both
  text and color;
- show the exact affected count and the first actionable target;
- route the author to save, the affected chapter, Planning, whole-work review or
  History without running AI or writing project data automatically;
- keep the checklist collapsed until requested while leaving the result and
  counts visible at a glance.

## Truthful readiness contract

- `阻断` means a safe handoff should not proceed: there is no manuscript, one
  or more chapters are empty, current edits are not safely saved, a project
  integrity error exists or an unresolved review error remains.
- `待确认` means the author can decide: chapters are not all marked complete,
  the project is read-only, integrity warnings or non-error review suggestions
  remain, or there is no whole-work receipt matching the current chapter and
  word counts.
- `可以交付` means all deterministic checks currently pass. It is not a claim
  that AI reviewed every line or that a matching export is byte-identical to
  the current project.
- A matching export receipt proves only format, destination, time, chapter
  count and author-facing word-count scale. The interface must say so.

## Safety and compatibility

- The model is a pure local projection. Opening the checklist performs no AI
  request, snapshot, save or Story Kernel write.
- The project schema and persisted workspace schema remain unchanged.
- Existing chapter, review, consistency and History routes remain the only
  mutation and delivery mechanisms.
- Unknown, malformed or stale evidence becomes visible attention instead of
  being interpreted as success.

## Verification gates

1. Pure model tests cover empty projects, empty chapters, save failures,
   integrity errors/warnings, review severity, completion metadata and matching
   versus stale whole-work receipts.
2. Visible experience tests cover checklist disclosure and direct save,
   manuscript, review and History actions.
3. ESLint, TypeScript, complete Vitest and production build pass.
4. Real-browser acceptance covers blocked, expanded and responsive states with
   no page overflow, clipped controls, sub-44 px actions, occlusion or runtime
   errors.
5. Full/release self-tests, Tauri Release/NSIS and native Windows smoke pass.
6. Installer and portable executable are copied to a dated release directory
   with machine-readable SHA-256 hashes.

## Non-goals

- Automatic publishing, upload, ISBN or store submission.
- Claiming semantic correctness when no full-work review was run.
- Byte-for-byte verification of a previously exported document.
- A new chapter-status editor or a new persisted publication workflow.
