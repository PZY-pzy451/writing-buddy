# Phase 1.2A Gate H real experience acceptance

Updated: 2026-07-29

Status: Complete. Five isolated test profiles passed all 50 task instances;
final evidence is in
`docs/acceptance/043-phase-1.2a-gate-h-real-experience-2026-07-29.md`.

## Goal

Validate the completed writer-centered core experience with five isolated test
profiles performing the same ten no-explanation tasks. Gate H is an acceptance
gate, not a feature expansion gate.

The profiles are deterministic test profiles, not human participants. The
report must state this plainly and must not claim qualitative human research.

## Required no-explanation task sequence

Every profile must complete, through visible labels and normal keyboard or
pointer interactions:

1. Open Writing Buddy.
2. Find and activate **继续上次位置**.
3. Confirm the expected chapter, cursor vicinity, scroll, and layout.
4. Write at least 300 Chinese characters and save.
5. Enter and exit focus mode.
6. Switch to planning and back to writing.
7. Resize the chapter sidebar and close the application.
8. Start a second time and continue the restored position.
9. Experience one injected write failure and recover through the visible
   retry action.
10. Confirm manuscript content and workspace layout were not lost.

The journey may not call store actions or feature functions directly. Fixture
setup, one-shot failure injection, virtual browser-file rehydration, evidence
reads, and process control stay outside the task sequence.

## Five profiles

- 1536×992 Paper, pointer-first.
- 1280×800 Paper, keyboard-first.
- 1024×720 Paper, compact-layout.
- 1536×992 Midnight with reduced motion.
- 1280×800 Midnight, keyboard-first.

Each profile uses a separate Edge user-data directory. The measured second
startup uses a new browser process with the same profile directory.

The browser fixture keeps files in renderer memory rather than on disk. The
runner therefore captures the saved manuscript before close and rehydrates
that exact verified content after the new renderer starts, before the user
continues. Session and workspace data remain real profile-local persisted
state. A final Tauri Release smoke test separately validates native disk and
window lifecycle.

## Success thresholds

- Continue Writing found: 5/5.
- Input without explanation: at least 4/5.
- Focus mode found and completed: at least 4/5.
- Save-state understanding: 5/5.
- Save failure recovered: 5/5.
- Second-start session restore: 5/5.
- Content and layout loss: 0/5.
- Blocking crash: 0/5.

Any content loss, silent save failure, incorrect project/chapter restore, or
blocking crash fails Gate H immediately.

## Performance evidence

Record metadata only:

- shell visible;
- recent project dashboard interactive;
- Continue-to-editor;
- planning switch;
- writing switch;
- focus enter/exit;
- save failure visible;
- retry-to-clean;
- second-start dashboard and editor.

Do not record manuscript text, Prompt, AI output, names, paths, or API keys in
the metrics report. Per-profile booleans, durations, viewport, theme, and
failure codes are allowed.

Targets follow the established budget:

- shell visible under 2 seconds;
- project interactive under 5 seconds;
- restored editor input under 10 seconds;
- workspace switch perceived under 150 ms where the environment permits.

If a target is missed, record the actual value and mark it honestly.

## Verification

- Pure five-profile contract test.
- Five-profile real Edge/CDP task runner and screenshots.
- Existing Gate G interaction runner.
- Complete frontend acceptance and change-aware self-test.
- Cargo formatting and complete Rust tests.
- Fresh Tauri Release/NSIS.
- Isolated native startup, responsive window, normal close, and exit code 0.

## Commit and stop line

Commit exactly:

`test: validate writer centered core experience`

After the commit, report Phase 1.2A complete only if the complete chain and all
five profiles pass. Do not start a new feature phase without explicit user
direction.
