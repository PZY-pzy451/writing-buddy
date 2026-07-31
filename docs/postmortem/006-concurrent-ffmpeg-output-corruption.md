# Concurrent ffmpeg output corruption

Date: 2026-07-31

## Incident

Two promotional-build processes were allowed to write to the same final MP4
path. The resulting file had plausible size and metadata but failed a full
decode. A separate clean build remained valid and became the accepted output.

## Cause

The compositor script wrote ffmpeg output directly to the public filename.
The shell timeout ended the parent command without guaranteeing that its
ffmpeg child had stopped. A second build then opened the same destination.

## Corrective action

- The zero-to-novel compositor now acquires an exclusive build lock.
- ffmpeg writes to a PID-scoped temporary MP4.
- The public filename is replaced only after ffmpeg exits successfully.
- Temporary output and the lock are cleaned in `finally`.
- The accepted public cut must pass a complete ffmpeg decode before
  publication, not only metadata probing or contact-sheet review.

## Durable rule

Never let capture or encode processes write directly to a shared accepted
artifact. Use a unique working output, serialize promotion to the public
filename and require a complete decode before handoff.
