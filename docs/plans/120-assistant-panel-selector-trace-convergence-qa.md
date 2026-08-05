# 120 Assistant Panel selector/trace convergence QA

Date: 2026-08-05

## Baseline

- Source baseline: `1cd6cc7` on `codex/full-regression-gates-a-e-v2`.
- Strict traceability has 9,009 unmapped items. Test mapping is 234/1,058,
  leaving 824 discovered cases unmapped.
- Control inventory has 511 declarations and 47 missing stable selectors.
- `AssistantPanel.tsx` has 5 inventoried declarations. Its dynamic pin, close
  and repeated selection-rewrite controls are anonymous to static inventory,
  even though the two heading controls expose runtime-computed accessible names.
- Writer Workspace already exercises opening, pinning, closing and contextual
  continuation, but those user paths do not assert the anonymous identities.

## Failure-first contracts

1. Pin and close retain their dynamic accessible names and gain distinct stable
   identities which do not depend on the currently selected writer tool.
2. Repeated selection-rewrite actions share one stable identity and expose the
   exact rewrite action as context.
3. The real writer path proves the identities while opening AI tools, changing
   a rewrite mode, focusing and pinning the panel, persisting the choice and
   closing the panel.
4. Contextual continuation remains reachable from the paragraph-end affordance.
5. No control, state or test is added solely to improve percentages.

## Validation

- Extend existing Writer Workspace cases first and preserve missing identities
  as the red baseline; add only semantic identity/context attributes.
- Add Assistant Panel declarations to the existing inventory contract without
  adding a discovered QA test.
- Run focused Writer Workspace tests, the affected writer/AI surface, typecheck,
  zero-warning lint and diff checks under Node 24.
- Rebuild traceability against 9,009 aggregate gaps, 47 selector gaps and 824
  unmapped tests; report mapped-control/state/test gains separately.
- Commit product behavior before running frontend, Rust and QA infrastructure
  gates sequentially from the fixed source.
- Keep release blocked until strict traceability, real-provider smoke and
  packaged-EXE acceptance complete.

## Result

- Product source: `709b254`.
- Two failure-first contracts reproduced the missing rewrite-action identity
  and the three anonymous inventory declarations. The corrected focused set
  passed 3/3 and the wider assistant/writer/AI impact set passed 97/97.
- Assistant Panel remains 5 controls / 110 states while stable identities rise
  from 2 to 5. Strictly mapped controls rise from 0 to 3, states from 0 to 51;
  both existing assistant-intent cases now enter strict mapping through real
  rendered open/close behavior.
- Global inventory remains 511 controls / 11,242 states / 1,058 tests. Mapped
  controls rise by 3, states by 51 and tests by 2; strict gaps fall by 56 to
  8,953, selector gaps by 3 to 44 and unmapped tests by 2 to 822.
- One initial full Vitest process exited at the Windows process level with
  `3221226505` before reporting any assertion. A clean bounded rerun passed 189
  frontend files / 979 tests plus production build; Rust passed 77 tests with
  two reasoned ignores and QA infrastructure passed 30/30.
- Strict coverage is 4,111/13,064 (31.47%), selector coverage is 467/511
  (91.39%) and test mapping is 236/1,058 (22.31%). Release remains 1/4 hard
  gates complete pending strict traceability, real-provider smoke and packaged
  EXE acceptance.
