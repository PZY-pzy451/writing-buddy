# Promotional recording utilities

These scripts reproduce the Writing Buddy complete-novel promotional capture.
They are intentionally separate from production application code.

## Scripts

- `capture-webview.mjs` records the compositor-backed Writing Buddy WebView
  through a diagnostic CDP port. Use this for accepted footage.
- `capture-window.mjs` records a Windows window or desktop with ffmpeg GDI.
  It is retained as a fallback, but WebView tool panels may be absent.
- `install-complete-novel-promo-fixture.mjs` installs deterministic AI
  responses into the currently connected diagnostic WebView only.
- `build-complete-novel-promo.mjs` removes the rejected preflight segment,
  adds title/outro cards, burns the approved ASS captions and creates the
  2560×1440 public cut.
- `install-zero-to-novel-promo-fixture.mjs` prepares a truly empty welcome
  state, intercepts only folder selection and deterministic AI responses,
  and refuses to run if the target project already exists.
- `drive-zero-to-novel-promo.mjs` visibly creates a new project, confirms a
  one-volume/three-chapter/six-scene structure, writes every chapter through
  the normal temporary-draft confirmation flow and independently verifies the
  native files.
- `build-zero-to-novel-promo.mjs` trims the accepted take, normalizes it to
  2560×1440, adds title/outro cards and burns the zero-to-novel captions.

## Safety boundary

The AI fixture is installed at runtime in a disposable diagnostic browser
context. It does not modify provider configuration, production AI transport,
release application code or the canonical complete-novel fixture.

All recordings and ffmpeg binaries belong under `artifacts/promo/`, which is
ignored by Git.

## Build the public cut

From the repository root:

```powershell
node scripts/recording/build-complete-novel-promo.mjs
```

The default inputs and outputs target
`artifacts/promo/complete-novel-writing-2026-07-31/`. Every path and timing
boundary can be overridden with the command-line flags documented in the
script.

For the replacement zero-to-complete-novel cut:

```powershell
node scripts/recording/build-zero-to-novel-promo.mjs
```

Its default inputs and outputs live under
`artifacts/promo/zero-to-complete-novel-2026-07-31/`.
