# 001 — Desktop white screen and stale save indicators

## Summary

The release WebView initially showed a blank white surface even though the
static Vite bundle rendered in Chromium. After startup was fixed, saves reached
disk but the React header and word counts could remain stale.

No real manuscript was at risk: all reproduction and repair work used
sanitized project copies.

## Root causes

1. Tauri `freezePrototype: true` made inherited prototype properties
   read-only. Monaco initializes `KeyCodeUtils.toString` by assignment, so its
   production module threw before React mounted.
2. `DocumentSession` is mutable. The store wrote the same session reference
   back to Zustand after edits and saves, so subscribers could skip rerendering
   even though the object had changed.
3. Generated WebView2 profile JavaScript lived under `tmp` but ESLint did not
   ignore `tmp`, making a later full lint inspect browser-owned code.

## Why earlier gates missed them

- TypeScript, Vitest and Vite validate module construction but do not execute
  the bundle inside Tauri's production WebView security environment.
- Disk-level save tests proved atomicity but did not assert synchronized UI
  counters and dirty-state indicators.
- The initial lint run occurred before a WebView2 profile existed.

## Resolution

- Set production `freezePrototype` to `false`; retain strict CSP, local content,
  minimal capabilities and Rust-side path validation.
- Add `DocumentSession.copy()` and publish a new session reference after edits,
  cursor changes, saves, forced saves and external reloads.
- Update active resource and project word counts in the same store transition.
- Ignore generated `tmp` and `artifacts` trees in ESLint.
- Keep CDP diagnostic configuration isolated from production.

## Durable prevention

- Always execute one packaged Tauri render test after a production build.
- For stateful domain objects, tests must assert both disk outcome and visible
  store-derived status.
- Create diagnostic output only in directories ignored by source tooling.
- Record production artifact hashes and confirm the production configuration
  contains no remote-debugging argument.
