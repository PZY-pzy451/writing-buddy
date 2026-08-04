# AI drawer close-cancellation QA

Date: 2026-08-04

## User risk

Closing the global AI drawer currently hides only the dialog. A validating or
streaming provider request can continue invisibly, consume quota and publish a
late result into retained context. Button, Escape and backdrop dismissal must
share one truthful stop boundary.

## Contracts

1. Closing during validation, queueing, connection or streaming invalidates the
   attempt and requests cancellation at most once.
2. One hundred repeated close actions remain idempotent.
3. Closing clears job identity, Context Pack, input, output, transaction, error
   and the pending 40 ms stream buffer.
4. Delayed events and provider failures after close cannot reopen or mutate the
   drawer.
5. Close button, Escape and backdrop dismissal execute the same lifecycle and
   restore focus through the existing dialog contract.
6. A new quick action after close starts from fresh current context.

## Execution

- Record the hidden-job failure in the Store and all three rendered dismissal
  paths before changing close behavior.
- Route close through the already hardened full reset/single-cancel boundary.
- Run drawer, App, AI, session and save impact tests followed by complete Node
  24 and Rust acceptance.
- Keep product status `PARTIAL` while traceability, real-provider smoke and
  packaging gates remain open.
