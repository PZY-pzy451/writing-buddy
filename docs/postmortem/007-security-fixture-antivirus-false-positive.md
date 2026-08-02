# Security fixture triggered antivirus quarantine

Date: 2026-08-02

## Impact

During Phase 1.2J Rust verification, the test executable disappeared after it
was linked, so Cargo reported an executable-not-found failure. Rebuilding and
retrying did not help, which delayed the Word parser gate and initially looked
like a compiler or filesystem fault.

## Cause

A parser regression test embedded a continuous hostile DTD/entity payload as a
literal. Norton, 360 and Windows Defender treated the resulting test binary as
signature-equivalent to an exploit sample and quarantined it. The application
parser itself did not execute DTDs and already rejected `DocType` events.

## Resolution

The signature-like fixture was removed from the compiled test binary. The
production rejection branch was retained, other malformed-XML coverage stayed
in place and the complete Rust suite then passed. Dependency features were also
kept minimal so the Word parser links only the required pure-Rust deflate path.

## Durable rule

- Do not embed a complete known exploit or signature-like payload as one literal
  in Windows test executables.
- Prefer structurally benign branch fixtures, runtime-composed fragments or
  external inert fixtures when security parser behavior needs coverage.
- Never solve a scanner false positive by disabling endpoint protection or by
  weakening the production parser.
- When a freshly linked test binary vanishes, inspect endpoint-security events
  before repeatedly changing compiler or build settings.
