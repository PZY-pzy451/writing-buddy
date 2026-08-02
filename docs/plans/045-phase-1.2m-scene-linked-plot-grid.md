# Phase 1.2M scene-linked plot grid

Date: 2026-08-02

## Why this cycle

The remaining product candidates were re-scored for one cycle:

| Candidate | Reach | Impact | Confidence | Effort | RICE | Lens |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Scene-linked plot grid | 55 | 2 | 60% | 4 | 16.5 | Enabler |
| Publish-readiness task | 45 | 2 | 50% | 4 | 11.25 | Blocker |
| Cross-project series bible | 25 | 2 | 40% | 6 | 3.33 | Enabler |

The grid is the highest-scoring candidate and closes an explicit planning gap:
authors can already create scenes and plot threads, but cannot scan which real
scenes advance which thread. The implementation must reuse the existing Story
Kernel instead of introducing a second planning model.

## Outcome

Add a third `场景网格` view to `剧情线与伏笔`:

- rows are real Story Kernel scenes in manuscript order;
- columns are real plot threads, with reciprocal links distinguished from
  one-sided links that need synchronization;
- the fixed scene column exposes chapter, scene title, goal and conflict without
  opening a form;
- summary and filters reveal linked, unlinked and incomplete scenes;
- selecting a scene opens its complete beat details and can locate the exact
  manuscript range through the existing evidence-navigation contract;
- empty projects remain actionable through the existing AI plot action.

## Safety and truthfulness

- The grid is a projection only. It performs no project write and no AI request.
- It recognizes associations recorded on either `scene.plotThreadIds` or
  `plotThread.sceneIds`, but labels one-sided data `待同步` rather than claiming
  a healthy reciprocal relationship.
- Missing chapters and unknown relation IDs remain visible as data-quality
  states instead of being silently discarded.
- Sorting is deterministic: known chapter order, scene narrative order, title,
  then ID.

## Verification gates

1. Pure model tests cover ordering, reciprocal/one-sided links, unknown chapters,
   empty beats and filtering.
2. Component tests cover the new tab, semantic table, filters, scene inspector
   and manuscript navigation.
3. ESLint, TypeScript, complete Vitest and production build pass.
4. Real-browser acceptance covers populated and filtered grids at 1440×900,
   1024×720 and 820×720 with no page overflow, clipped controls, sub-44 px
   interactive controls, occlusion or runtime errors.
5. Full/release self-tests, Tauri Release/NSIS and native Windows smoke pass.
6. Installer and portable executable are copied to a dated release directory
   with machine-readable SHA-256 hashes.

## Non-goals

- Editing scene beats or associations inside the grid.
- Dragging scenes between chapters.
- Creating a new plot-thread schema or migrating projects.
- Claiming that one-sided associations are already repaired.
