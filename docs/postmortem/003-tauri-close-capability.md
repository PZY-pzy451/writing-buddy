# Tauri close listener lacked destroy permission

Date: 2026-07-27

## Incident

The Windows title-bar Close button stopped closing Writing Buddy after a
frontend `onCloseRequested` listener was added for unsaved-content protection.
The UI stayed responsive and showed no dialog, so ordinary smoke launches and
unit tests did not expose the permission rejection.

## Root cause

Tauri's JavaScript `onCloseRequested` implementation destroys the window after
the application handler allows closing. The project's minimal capability used
`core:default`; its window default set contains read-only window queries but
not `core:window:allow-destroy`. The listener therefore converted a native
close into an IPC destroy request that the ACL denied.

## Why it escaped

- Previous acceptance stopped processes instead of invoking the real native
  close request.
- The test suite covered lock cleanup but not the capability required to reach
  Tauri's destroy command.
- The release did not expose the rejected IPC error in the product UI.

## Correction

- Grant `core:window:allow-destroy` only to the existing `main` capability.
- Compile-time test the capability JSON for that exact permission.
- Compare the old and rebuilt release using the same non-force native
  termination signal.

## Durable rule

Whenever a Tauri frontend registers lifecycle listeners whose library
implementation calls a core command, inspect the exact library source and add
an ACL regression test for the least required permission. A process-kill smoke
test is not a substitute for native title-bar close acceptance.
