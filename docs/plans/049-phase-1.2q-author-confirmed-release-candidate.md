# Phase 1.2Q author-confirmed release candidate

Updated: 2026-08-02

## Product decision

After Phase 1.2P, Writing Buddy can prove that a whole-work export was created
from the exact current manifest and manuscript bytes. It still cannot answer a
different author-owned question: which of several exact exports is the version
the author intends to submit or publish.

This cycle adds one explicit, reversible confirmation record. It does not add
another export format, write project files, run AI or claim that the destination
file was read back.

## Priority

One cycle only:

| Candidate | Lens | RICE | Decision |
| --- | --- | ---: | --- |
| Author-confirmed release candidate | Enabler | `35 × 1 × 0.60 ÷ 2 = 10.50` | Build now |
| Export-destination byte recheck | Enabler | `25 × 2 × 0.45 ÷ 5 = 4.50` | Defer: arbitrary-path security and platform cost remain uncertain |
| Cross-project series bible | Enabler | `25 × 2 × 0.40 ÷ 6 = 3.33` | Defer |

Confidence remains below 100% because no production telemetry or user study is
available. The selected item closes the highest-scoring remaining ambiguity in
the already implemented publication path.

## Contract

1. Only a whole-work receipt with a valid exact source fingerprint can be
   confirmed.
2. A project has at most one active confirmed receipt. Confirming another exact
   receipt clears the previous active confirmation for that project only.
3. Confirmation is local receipt metadata (`confirmedAt`). It never modifies the
   manuscript, manifest or exported file.
4. The publication check passes delivery only when the confirmed receipt still
   matches a fresh, clean, read-only source inspection.
5. A later export does not silently replace an already confirmed current
   candidate. A source or manifest change makes that confirmation visibly stale.
6. Malformed confirmation timestamps and confirmations attached to legacy or
   chapter receipts are discarded during persistence parsing.
7. History labels the active candidate and offers an explicit reversible action.
   Initial confirmation is routed through Check, where current-source equality is
   already established.

## Acceptance

- An exact but unconfirmed export remains `待确认` and exposes
  `确认此交付版本`.
- Confirmation immediately turns the delivery row into `已通过`, records an ISO
  timestamp and survives persistence parsing.
- A same-word-count manifest/source change makes the confirmed delivery stale.
- History displays `已确认发布版本`; cancellation removes the marker and returns
  Check to `待确认` without touching project or export files.
- Existing/legacy receipts continue loading safely.
- Focused tests, full lint/type/unit/build gates, Rust gates, self-tests, browser
  interaction/responsive probes, Release/NSIS build and portable EXE smoke pass.

## Non-goals

- Reading back, hashing, opening or deleting arbitrary export destinations.
- Cloud publication, upload, ISBN, store submission or collaboration approval.
- Mutating project data to store a machine-local export path.
