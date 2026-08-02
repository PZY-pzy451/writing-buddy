# Acceptance drift and reload races

Date: 2026-08-02

## Incident

The repository had broad automated coverage, but several long-lived browser
journeys still targeted retired labels or navigation. One legacy visual runner
also recorded clipped controls without failing. After those were corrected, a
full rerun exposed an intermittent Gate G timeout because `Page.reload` returned
while the old document could still satisfy a readiness selector. Native
automation separately assumed a production WebView would expose a debugging
port.

## Cost

The release matrix had to be restarted twice after expensive frontend and
Tauri builds. Individual focused runs had passed, so the defects were in test
orchestration and sequencing rather than the tested product contract.

## Root causes

- Acceptance selectors were coupled to copy and information architecture but
  had no single full-matrix entrypoint to reveal drift.
- Metrics were treated as evidence without always being enforced as gates.
- Readiness checks could match elements from the pre-reload document.
- Production and acceptance executable responsibilities were not separated.

## Durable actions

- Keep `pnpm acceptance:full-regression` as the release-hardening entrypoint.
- Make visual metrics fail on contract violations; do not only serialize them.
- Wait for an explicit navigation/load event before asserting post-reload DOM.
- Build native acceptance with an explicit local-only configuration, archive
  production bytes first, and restore production before distribution smoke.
- When current copy or navigation changes, update the corresponding reusable
  journey in the same commit and run its focused gate.
