# Complete Novel Promotional Recording Plan

Date: 2026-07-31

Baseline: `e57e7c64 feat: add long-output novel acceptance`

Status: completed

## Objective

Produce a polished, reproducible screen recording that demonstrates Writing
Buddy as an end-to-end novel-writing workspace. The recording must use the
actual Windows desktop client and the complete `《零点回声》` project.

The source recording is promotional material, so it must contain no API key,
personal path, debug console, terminal window, raw schema error or misleading
claim that one opaque AI request wrote the whole novel.

## Recording contract

- Target duration: 4–6 minutes.
- Capture: Writing Buddy application window only, 1280×800 or larger.
- Output: H.264 MP4, clean raw cut, captioned promotional cut, SRT captions,
  shot list and acceptance report.
- Project: a disposable copy generated from the canonical complete-novel
  fixture.
- AI: deterministic, clearly documented recording fixture installed only in
  the diagnostic build. Production AI behavior and Release artifacts remain
  unchanged.
- Author control: every AI suggestion remains a candidate until the visible
  author confirmation action.

## Storyboard

1. Open the complete project dashboard and establish the 12-chapter,
   26K-word manuscript.
2. Open the Creation Journey and show the confirmed three-act structure.
3. Return to the manuscript, open chapter one and demonstrate the focused
   writing surface.
4. Trigger one grounded AI continuation/outline alternative, review the
   visible candidate differences and explicitly adopt one option.
5. Show save/snapshot trust feedback and the unchanged author-controlled
   workflow.
6. Visit Story Kernel material for characters, locations and plot continuity.
7. Open the final chapter and show that the story has a completed ending.
8. Return to the project overview for the closing frame.

## Quality gates

- No visible runtime or console error.
- No secret, credential, personal recent-project entry or unrelated window.
- Chinese text is crisp and not clipped.
- Mouse movement is intentional; no dead time longer than three seconds.
- Every shot begins and ends on a stable UI state.
- MP4 decodes successfully and has the planned dimensions, frame rate and
  duration.
- The disposable demo project can be discarded without changing the
  canonical fixture or the production release.
- Any product bug found during rehearsal receives a focused regression test
  before the final recording.

## Delivery

Artifacts will be written under:

`artifacts/promo/complete-novel-writing-2026-07-31/`

The final acceptance record will be indexed under `docs/acceptance/`.

## Completion

- Recorded a 6:24 direct WebView source take from the real Windows client.
- Removed the 00:01:19–00:01:32 cursor preflight warning.
- Added title/outro cards and burned-in Chinese captions.
- Delivered a 2560×1440, 24 fps, 6:27 public cut, separate SRT and shot list.
- Fixed and regression-tested the accepted-candidate stale-warning defect
  found during rehearsal.
- Acceptance:
  `docs/acceptance/056-complete-novel-promotional-recording-2026-07-31.md`.
