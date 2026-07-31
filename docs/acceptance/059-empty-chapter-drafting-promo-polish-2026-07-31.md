# Empty chapter drafting and promotional polish acceptance

Date: 2026-07-31

Branch: `codex/genre-to-draft-gates-a-c`

## Accepted product behavior

- A materialized chapter containing only its Markdown headings and
  `writing-buddy-scene` anchors is now treated as an opening-draft target.
- Continue Paragraph and Three Directions resolve that target to the first
  planned scene even when the cursor is at the beginning of the document.
- The grounded context states that the chapter has structure but no prior
  prose. The visible action is `确认资料并生成开篇`.
- Generation still creates a temporary, editable candidate. It does not
  mutate the manuscript until the author explicitly writes it.
- A truly empty chapter without a plan shows a calm next step instead of a red
  continuation error.
- Continuation, scene planning and Story Kernel progress text is
  provider-neutral.

The real in-app interface was exercised with a fresh project. The scaffold-only
chapter showed `将从首个场景开始起草`, the opening action, and no red error or
console warning. Evidence:

`artifacts/acceptance/2026-07-31-empty-chapter-drafting/scaffold-opening-draft.png`

## Automated verification

- `pnpm acceptance`
  - ESLint: passed with zero warnings.
  - TypeScript: passed.
  - Vitest: 158 files / 618 tests passed.
  - Production Vite build: passed.
- `cargo fmt -- --check`: passed.
- `cargo test`: 68 passed / 2 explicit external gates ignored.
- `pnpm tauri:build`: Release executable and NSIS installer produced.
- Production portable smoke:
  - title `Writing Buddy`;
  - process responsive;
  - six WebView2 processes started;
  - no diagnostic port `9751` or `9223`;
  - normal close requested.

## Promotional recording acceptance

The new take starts on an empty Writing Buddy welcome screen and visibly
creates `《零点回声》`, confirms its premise and outline, materializes one
volume / three chapters / six scenes, drafts all three chapters through the
author-confirmed AI flow, and ends on the completed dashboard.

The second and third chapters use the new scaffold-only opening path. The take
contains no old red `光标前没有正文` state, no loading skeleton presented as a
result, and no automatic hidden manuscript write.

Accepted cut:

- duration: 1:42;
- video: 2560×1440, H.264 High, yuv420p, 24 fps;
- audio: 48 kHz mono AAC, locally generated Chinese narration;
- captions: burned Chinese captions plus standalone SRT and ASS;
- media verification: complete decode passed;
- visual verification: title, project creation, premise, outline,
  materialization, temporary draft, confirmed write, completed dashboard and
  outro frames reviewed.

Files:

- `artifacts/promo/zero-to-complete-novel-polished-2026-07-31/Writing-Buddy-zero-to-complete-novel-polished.zh-CN.mp4`
- `artifacts/promo/zero-to-complete-novel-polished-2026-07-31/captions.zh-CN.srt`
- `artifacts/promo/zero-to-complete-novel-polished-2026-07-31/promo-build-manifest.json`
- `artifacts/promo/zero-to-complete-novel-polished-2026-07-31/contact-sheet-final.png`

The recording driver now adds a visible pointer and click feedback, waits for
the resolved dashboard statistics, and records at 24 fps. The compositor uses
sequential low-memory segment encoding before final caption/audio composition,
so it remains reliable on machines with a small page file.

## Windows delivery

Directory:

`artifacts/release/empty-chapter-promo-polish-2026-07-31/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Writing-Buddy-portable.exe` | 8,363,008 | `ccc79708c863f38bbc54398f9737dd1d2d2d1c8d358606a6524bea2ac6a5e296` |
| `Writing-Buddy-0.1.0-x64-setup.exe` | 3,629,476 | `74536335c55b63b3db3441ed9c8185c25f877ff308669cac2092fffa3763c206` |
| Promotional MP4 | 6,506,322 | `eb05f3eb931367168bc3816b0c24c3a85042f5420abfb49e6be91fa2d61be91d` |

The deterministic AI used for the recording is confined to the diagnostic
recording configuration. The delivered production binaries use the normal AI
configuration and contain no recording/debug port.
