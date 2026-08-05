# 096 Manuscript continuation control and write convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `b2f3dea` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 10,029 unmapped items. Test mapping is 162/1,057,
  leaving 895 discovered cases unmapped.
- Control inventory has 484 declarations and 103 missing stable selectors.
- `ManuscriptContinuationPanel.tsx` exposes seven logical control groups but
  inventory collapses them into six declarations; two are missing stable
  selectors. Six of its ten existing component tests are unmapped.
- An unexpected snapshot/persistence exception is displayed verbatim, so a
  private manuscript path can escape into the author-facing alert.

## Failure-first contracts

1. Generate, per-candidate Insert and Undo have distinct stable identities;
   the source has seven mapped declarations and zero selector gaps.
2. One hundred same-frame Generate actions start one provider request. One
   hundred same-frame Insert actions start one snapshot and one manuscript
   insertion while acceptance is pending.
3. Wrapped valid output remains available; malformed output stays localized
   and performs zero snapshot or manuscript writes.
4. A successful insertion can be undone after the host mounts the exact new
   content, restoring the original manuscript.
5. Unknown snapshot/persistence failures expose no private path, preserve the
   same candidate and succeed on explicit retry without regeneration.
6. All ten existing component cases receive conservative control/state
   mappings without adding a discovered test case.
7. Co-located component tests outrank same-token QA inventory tests so product
   interaction evidence cannot be replaced by selector-string meta coverage.

## Validation

- Run the changed panel and inventory contracts red before implementation.
- Run continuation, inline draft, grounded AI and QA impact tests.
- Run Node 24 lint, typecheck, all frontend tests and production build from a
  fixed product commit.
- Run Rust tests, rebuild traceability and record movement from 10,029 aggregate
  gaps / 103 selector gaps / 895 unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source `657abcf` exposes Generate, per-candidate Insert and Undo as
  distinct stable controls. Honest inventory expands from six collapsed
  declarations to seven, with 7/7 mapped and zero local selector gaps.
- One hundred same-frame Generate actions start one provider request. One
  hundred Insert actions start one snapshot and one manuscript insertion while
  persistence is pending.
- Malformed output remains localized and performs zero writes. Unknown snapshot
  failures expose no private path; the candidate survives and succeeds on retry
  after two snapshot attempts without another generation.
- The exact inserted content can be undone after the host mounts it, restoring
  the original manuscript without touching later edits.
- Traceability now prefers co-located component tests over same-token QA
  inventory meta-tests. All ten existing continuation cases are mapped without
  increasing the 1,057-case inventory.
- Six failure-first assertions converged to 25/25 focused tests. The impact set
  passed 172/172 and QA infrastructure passed 29/29.
- Fixed-source Node 24 acceptance passed lint, typecheck, 188 files / 978 tests
  and production build. Rust passed 77 with two reasoned ignores.
- Strict gaps fell from 10,029 to 9,960. Selector gaps fell from 103 to 101.
  Mapped tests rose from 162 to 166 and unmapped tests fell from 895 to 891.
- Release remains blocked at 1/4 hard gates: strict traceability, real-provider
  smoke and packaged-EXE acceptance remain open.
