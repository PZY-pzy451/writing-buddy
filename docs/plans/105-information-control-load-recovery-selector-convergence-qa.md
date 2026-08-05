# 105 Information control load recovery and selector convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `0605341` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,799 unmapped items. Test mapping is 186/1,058,
  leaving 872 discovered cases unmapped.
- Control inventory has 496 declarations and 86 missing stable selectors.
- `InformationControlPage.tsx` exposes three collapsed anonymous declarations:
  one button declaration and two inputs. All three lack stable identities and
  strict mappings. Filter options and generated fact rows are collapsed.
- Its only existing product case is unmapped despite exercising author-secret
  protection and the knowledge matrix.
- Loading renders private exception text verbatim and offers no explicit retry.
  Same-project retry and cross-project late-result isolation are absent, while
  the selected fact can remain stale after switching projects.

## Failure-first contracts

1. Search, filter options, generated fact rows and narrative position expose
   separate stable identities with accessible Chinese names.
2. A localized retry control appears after load failure and has its own stable
   identity; private paths and raw exceptions never enter the page.
3. One hundred same-frame retry actions start one replacement read, and an
   explicit retry remains possible after a failed attempt.
4. The latest project intent wins. A late result from an older project cannot
   replace current information, selected fact or narrative position.
5. Existing author-secret, AI-exclusion, filtering and knowledge-matrix
   behavior remains functional.
6. The existing product case gains a conservative mapping without increasing
   discovered test debt.

## Validation

- Extend the existing product and inventory cases, run them red, then implement
  the smallest load-isolation, recovery and stable-control boundary.
- Run information page, matrix and story-information impact tests under Node
  24, plus typecheck and zero-warning lint.
- Run all frontend tests, production build, Rust acceptance and QA
  infrastructure sequentially from a fixed product commit.
- Rebuild traceability and report inventory expansion separately from mapping
  progress against 9,799 aggregate gaps, 86 selector gaps and 872 unmapped
  tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

Pending execution.
