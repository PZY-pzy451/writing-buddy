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

- Fixed product source: `79b8ab9`.
- Search, filter, fact selection, narrative position and retry expose five
  separate stable identities. All five source controls, all 110 source states
  and the existing product case are strictly mapped.
- One hundred same-frame retries start one replacement read. Load failures are
  localized and public-safe; a late result from an older project cannot replace
  the latest information, selected fact or narrative position.
- Two red failures converged to 16/16 focused/inventory tests, 2/2 information-
  domain impact tests and 30/30 QA infrastructure tests. Fixed-source
  sequential acceptance passed 189 frontend files / 979 tests, production
  build and 77 native tests with two reasoned ignores.
- Honest inventory expansion adds 2 controls and 44 states. Source mapped
  states rise from 66 to 110 and global mapped states rise by 50. Strict gaps
  fall by 12 from 9,799 to 9,787, selector gaps fall from 86 to 83 and unmapped
  tests fall from 872 to 871.
- Deterministic execution is 100%; strict coverage is 2,978/12,765 (23.33%),
  stable selectors are 415/498 (83.33%) and test mapping is 187/1,058 (17.67%).
  Release gates remain 1/4 complete (25%), so release stays blocked by strict
  traceability, real-provider smoke and packaged-EXE acceptance.
