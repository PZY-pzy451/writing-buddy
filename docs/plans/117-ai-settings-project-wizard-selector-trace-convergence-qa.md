# 117 AI settings and project wizard selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `c66435cc` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,247 unmapped items. Test mapping is 216/1,058,
  leaving 842 discovered cases unmapped.
- Control inventory has 510 declarations and 55 missing stable selectors.
- `AiSettingsSection.tsx` has 7 inventoried declarations, 4 stable identities,
  3 strictly mapped controls and 33/154 mapped states. Its API-key input,
  composite model/thinking selector and composite inline-feature checkbox are
  anonymous. The related AI experience suite has 8/22 mapped product cases.
- `ProjectCreationWizard.tsx` has 20 stable declarations, 16 strictly mapped
  controls and 224/440 mapped states. Nine of its twelve exact product cases
  map; the remaining cases already cover accessible start routes, local outline
  import and project-scoped actions without an open project.

## Failure-first contracts

1. The API-key input exposes one stable identity without making the secret
   persistent or visible.
2. Default-model and thinking-mode selects share one stable composite identity
   plus an exact preference key.
3. Inline language and plot feature toggles share one stable composite identity
   plus an exact feature key.
4. The existing settings cases drive the rendered identities while retaining
   latest-preference-wins and explicit long-output warning behavior.
5. Four project starts remain individually accessible, with genre the only
   primary action.
6. Outline import is explicitly local/offline and creates the expected chapter
   structure without starting a paid AI request.
7. Without an open project, global creation keeps project entry points enabled
   while project-scoped actions remain disabled and keyboard focus is restored.
8. No discovered test, control or state is added solely to improve percentages.

## Validation

- Extend existing tests first and capture absent AI settings identities as the
  red baseline; add only semantic identity/context attributes.
- Rename the three existing wizard cases to state the already asserted unique
  accessibility, offline and disabled contracts; strengthen only missing proof.
- Run AI settings, project creation, global create and Writer Workspace impact
  tests under Node 24, plus typecheck, zero-warning lint and diff checks.
- Rebuild traceability against 9,247 aggregate gaps, 55 selector gaps and 842
  unmapped tests; report mapped-control/state/test gains separately.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source: `93b3e56`.
- Three isolated failure-first assertions reproduced the missing API-key,
  generation-preference and inline-feature identities. The corrected focused
  set passed 34/34 cases and the wider impact set passed 224/224.
- AI settings remains 7 controls / 154 states while stable identities rise from
  4 to 7, mapped controls from 3 to 6 and mapped states from 33 to 78. Related
  mapped product cases rise from 8/22 to 10/22.
- Project Wizard remains 20/20 stable and 16/20 control-mapped. All 12/12 exact
  product cases now map and mapped states rise from 224 to 272.
- Global inventory remains 510 controls / 11,220 states / 1,058 tests. Mapped
  controls rise by 3, states by 113 and tests by 5; strict gaps fall by 121 to
  9,126, selector gaps by 3 to 52 and unmapped tests by 5 to 837.
- Fixed-source sequential gates passed 189 frontend files / 979 tests plus
  production build, 77 Rust tests with two reasoned ignores, and 30/30 QA
  infrastructure tests.
- Strict coverage is 3,915/13,041 (30.02%), selector coverage is 458/510
  (89.80%) and test mapping is 221/1,058 (20.89%). Release remains 1/4 hard
  gates complete pending strict traceability, real-provider smoke and packaged
  EXE acceptance.
