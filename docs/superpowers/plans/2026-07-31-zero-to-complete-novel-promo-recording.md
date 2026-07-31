# Zero-to-Complete Novel Promotional Recording Plan

Date: 2026-07-31

Baseline: `91b52b2c fix: repair malformed AI manuscript responses`

Status: complete

## Objective

Replace the previous promotional recording with an honest, reproducible
end-to-end demonstration that starts before a Writing Buddy project exists
and ends with a complete novella written and saved by the Windows desktop
client.

The final video must visibly cover project creation, genre and premise,
Story Kernel and outline decisions, chapter and scene materialization,
AI-assisted drafting inside the editor, explicit author confirmation,
automatic saving, completion statistics and the finished ending.

## Truth contract

- The target project directory must not exist before the recorded take.
- The app must create the project through its visible new-project flow.
- No chapter or manuscript file may be copied into the project behind the UI.
- A recording-only deterministic AI transport may make the take repeatable,
  but every generated result must enter through Writing Buddy's normal
  candidate and author-confirmation workflow.
- All project creation, hierarchy materialization, snapshots and manuscript
  writes must use the normal desktop bridge and native project files.
- The final report must independently count the native chapter files and
  non-whitespace manuscript characters after the take.
- The opening frame may contain no existing demo project. The closing frame
  must show the completed project and final chapter.

## Demonstration scope

The recording will create a compact complete Chinese novella:

- one volume;
- three substantial chapters following a three-act arc;
- two planned scenes per chapter;
- approximately 25,000–35,000 non-whitespace Chinese characters;
- a resolved ending rather than an outline-only or sample-chapter result.

This is intentionally described as a complete novella, not as a claim that a
single AI request writes a commercial-length novel.

## Recorded journey

1. Start on Writing Buddy's empty welcome state.
2. Choose **New project**, name the novel and select a new empty parent
   directory.
3. Choose **Generate an outline from genre**, enter genre, premise and
   creative constraints, then generate the editable Story Kernel/outline.
4. Review the structure and explicitly confirm one volume, three chapters
   and two scenes per chapter.
5. Choose **Start writing**, confirm native project materialization and open
   the first chapter in the editor.
6. Draft each chapter through the visible AI continuation panel, review the
   candidate and choose **Write to manuscript**. Show save/snapshot feedback.
7. Make at least one short direct author edit so the demonstration includes
   both AI assistance and normal writing.
8. Open the ending, verify that the conflict resolves, then return to the
   project overview and show chapter/character counts and completion state.

## Automation and capture

- Use the real Windows desktop client and its WebView compositor.
- Drive only visible Writing Buddy controls during the recorded take.
- Intercept only folder selection and AI generation in the disposable
  diagnostic WebView. Do not change production provider settings or release
  AI transport.
- Capture the WebView with a fixed-frame-rate CDP screencast because Windows
  GDI capture omits compositor-backed panels.
- Build a clean 2560×1440 H.264 public cut with concise Chinese captions, a
  title card, an ending card and a separate SRT file.

## Quality gates

- No terminal, debug console, API key, local personal project, raw schema
  error or unrelated window appears in the final cut.
- No duplicate generation request is possible while an AI job is running.
- Every AI response is schema-valid and all manuscript inserts survive a
  save-and-reopen check.
- The final project opens without repair prompts or invalid-resource errors.
- Automated tests cover any product defect fixed during rehearsal.
- The packaged Windows executable is rebuilt and smoke-tested after code
  changes.
- The final MP4 decodes successfully and its duration, resolution, frame
  rate, captions and representative frames are verified.

## Delivery

Artifacts will be written under:

`artifacts/promo/zero-to-complete-novel-2026-07-31/`

The reproducible scripts will live under `scripts/recording/`. The acceptance
record will be indexed under `docs/acceptance/`.

## Completion

- Recorded target directory was absent before the take and created by the
  visible Writing Buddy new-project flow.
- Completed `《零点回声》` through the normal editable outline, hierarchy
  confirmation, manuscript candidate, explicit insertion, snapshot and save
  paths.
- Final native project contains 1 volume, 3 chapters, 6 scene anchors and
  30,441 non-whitespace manuscript characters. The application dashboard
  reports 26,210 author-facing characters.
- Accepted public cut is 2:44, 2560×1440, H.264 High, yuv420p and 24 fps. It
  passed a full ffmpeg decode and representative-frame review.
- Rebuilt the production Tauri portable executable and NSIS installer after
  recording. The portable smoke remained responsive, showed the expected
  title, closed normally and did not expose the diagnostic port.
- Detailed evidence is recorded in
  `docs/acceptance/058-zero-to-complete-novel-promotional-recording-2026-07-31.md`.
