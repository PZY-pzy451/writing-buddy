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
