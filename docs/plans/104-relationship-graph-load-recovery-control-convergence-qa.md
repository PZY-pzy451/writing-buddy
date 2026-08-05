# 104 Relationship graph load recovery and control convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `69b04f2` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,812 unmapped items. Test mapping is 185/1,058,
  leaving 873 discovered cases unmapped.
- Control inventory has 495 declarations and 88 missing stable selectors.
- `RelationshipGraphPage.tsx` exposes six collapsed declarations. Four are
  stable and strictly mapped; character nodes and SVG relationship edges lack
  stable identities. Existing and AI-candidate edges are collapsed into one
  anonymous declaration.
- Six of seven existing product cases are mapped. The narrative-position
  filtering case remains unmapped despite exercising an author-visible input.
- Relationship loading has no same-request single-flight boundary. A private
  loader exception is rendered verbatim, while a late result from an earlier
  project can overwrite the relationship data for the latest project.

## Failure-first contracts

1. Existing edges, pending AI edges and character nodes expose separate stable
   identities without changing their accessible names or keyboard behavior.
2. The narrative-position input has a stable identity and the existing filter
   case gains a conservative product mapping.
3. One hundred same-frame retries for the same project start one replacement
   load while the prior failed attempt remains retryable.
4. Loader failures become localized and public-safe; private paths and raw
   exception messages never enter the relationship page.
5. A newer project/load intent wins. Resolving an older request afterward
   cannot replace the newer graph, position or visible relationship count.
6. Existing matrix, inspector, AI candidate, evidence and save workflows remain
   functional, with no additional discovered test debt.

## Validation

- Extend existing relationship and inventory cases, run them red, then
  implement the smallest request-isolation and stable-control boundary.
- Run relationship graph/panel/inspector/service impact tests under Node 24,
  plus typecheck and zero-warning lint.
- Run all frontend tests, production build, Rust acceptance and QA
  infrastructure sequentially from a fixed product commit.
- Rebuild traceability and report honest inventory expansion separately from
  mapping progress against 9,812 aggregate gaps, 88 selector gaps and 873
  unmapped tests.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Fixed product source: `b6608f2`.
- Existing edges, AI candidate edges and character nodes now expose separate
  stable identities. All seven source controls and all seven existing product
  cases are strictly mapped without increasing the discovered test count.
- One hundred same-frame retries start one replacement read. Loader failures
  are localized and public-safe; resolving an older project's request after a
  newer project has loaded cannot replace the latest graph or position.
- Four red failures converged to 22/22 focused/inventory tests, 16/16
  relationship-domain impact tests and 30/30 QA infrastructure tests. Fixed-
  source sequential acceptance passed 189 frontend files / 979 tests,
  production build and 77 native tests with two reasoned ignores.
- Honest inventory expansion adds 1 control and 22 states. Source mapped states
  rise from 61 to 93 and global mapped states rise by 32. Strict gaps fall by
  13 from 9,812 to 9,799, selector gaps fall from 88 to 86 and unmapped tests
  fall from 873 to 872.
- Deterministic execution is 100%; strict coverage is 2,920/12,719 (22.96%),
  stable selectors are 410/496 (82.66%) and test mapping is 186/1,058
  (17.58%). Release gates remain 1/4 complete (25%), so release stays blocked
  by strict traceability, real-provider smoke and packaged-EXE acceptance.
