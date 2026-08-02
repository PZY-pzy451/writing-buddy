# Phase 1.2P verifiable delivery freshness

Date: 2026-08-02

## Why this cycle

The remaining candidates were re-scored for one delivery cycle:

| Candidate | Reach | Impact | Confidence | Effort | RICE | Lens |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Exact delivery freshness | 40 | 2 | 75% | 3 | 20.00 | Blocker |
| Publish confirmation record | 35 | 1 | 60% | 2 | 10.50 | Enabler |
| Cross-project series bible | 25 | 2 | 40% | 6 | 3.33 | Enabler |

The current publication check accepts the newest whole-work receipt when only
chapter count and word count match. Rewriting a sentence to a different sentence
with the same counted length therefore leaves a stale delivery marked current.
This is a deterministic trust failure in the main draft-to-delivery journey, so
exact delivery freshness wins both the RICE score and the Blocker lens. The
other candidates stay outside this cycle.

## Outcome

Make a whole-work delivery receipt verifiable against the exact local source
state used to create it:

- expose the raw manuscript hash for every readable chapter in the native
  project snapshot;
- build a versioned SHA-256 source fingerprint from the exact manifest revision
  and the ordered chapter ID, path and raw-file hash tuples;
- attach that fingerprint only to successful whole-work export receipts;
- inspect the live local manifest and chapter hashes when Check evaluates the
  latest delivery;
- pass the delivery check only when both fingerprints are present and equal;
- treat old receipts, unavailable live inspection, unsaved prose and changed
  source state as explicit attention states rather than silently trusting counts.

## Safety and compatibility

- Existing chapter and whole-work receipts remain readable. A legacy receipt
  without a fingerprint remains useful history but cannot prove freshness.
- Malformed persisted fingerprints are discarded rather than compared.
- Fingerprint generation is local and deterministic. It does not run AI, write
  project files, create a snapshot or read the exported destination back.
- A fingerprint proves that the local source state matches the source used for
  export. It does not claim that a destination file still exists or that an
  external application has not changed it.
- Live inspection is read-only. If the manifest changed outside the visible
  workspace, Check reports that the project must be reopened instead of mixing
  two revisions.

## Verification gates

1. Pure tests prove that changes to manifest revision, chapter order, path or
   same-word-count manuscript content produce different fingerprints.
2. Receipt and readiness tests cover legacy compatibility, malformed input,
   exact match, unsaved prose, unavailable inspection and stale equal-count
   content.
3. Store tests prove successful whole-work export records the hashes actually
   read for export and cancellation/failure creates no false trusted receipt.
4. Rust tests prove project snapshots expose the exact SHA-256 chapter hash and
   omit unreadable files while retaining integrity errors.
5. Real-browser acceptance proves an exact receipt passes, then a chapter status
   change invalidates it without changing word count.
6. ESLint, TypeScript, complete Vitest, production build, Cargo format/tests,
   full/release self-tests, Tauri build and native portable smoke pass.

## Non-goals

- Reading back or cryptographically signing the exported destination file.
- Upload, submission, ISBN, storefront or publisher workflows.
- A publish confirmation ledger or cross-project series database.
- Changing manuscript text, chapter status or Story Kernel data.
