# Monaco undo resource-isolation QA

## Objective

Protect the active chapter when an AI manuscript insertion leaves a one-click
undo notice and the author switches chapters, opens another text resource or
returns after the editor model has changed. Close P0 `FEATURE-01-09` without
weakening Monaco's native per-model undo stack.

## Risk observed

The committed-draft notice currently stores only the post-insertion content and
message. Its enabled state compares only the active session content. A different
chapter with identical text can therefore make the stale notice actionable; its
handler triggers `undo` against the currently mounted Monaco model and saves that
unrelated chapter.

## Red contracts

1. A notice is actionable only for the project, resource and Monaco model that
   received the AI insertion.
2. Switching to another chapter with identical content disables and removes the
   stale action without triggering an editor undo or save.
3. Returning to the original chapter does not resurrect a notice whose editor
   model lifecycle was interrupted.
4. Editing the original chapter after the insertion disables the one-click
   action; native Monaco undo remains available.
5. One hundred same-tick notice clicks perform one undo and one queued save.
6. A save failure keeps the restored content dirty and exposes normal save
   recovery instead of claiming the AI insertion was safely undone.

## Repair boundaries

- Bind the notice to project, resource and model URI in addition to content.
- Clear the notice when the active resource/model changes.
- Acquire a synchronous one-click undo guard before the first awaited save.
- Never trigger undo against a model that does not match the receipt.
- Preserve Monaco-native undo/redo behavior for normal author edits.

## Verification

- Pure receipt/predicate tests for resource/model/content identity.
- Rendered notice tests for switching, identical content, repeated action and
  failure behavior.
- Impacted editor, writer-session, save, workspace and shortcut suites.
- Node 24 lint, typecheck, complete Vitest/build and Cargo baseline.

## Release conclusion

Execution may pass when all selected checks pass. Product/release remains
`PARTIAL` until strict traceability, real-provider smoke and packaging gates are
complete.

## Result

- The behavior-preserving predicate extraction produced a 3-failure red baseline
  in four identity tests: cross-resource, recreated-model and cross-project
  collisions were all accepted when content matched.
- The repaired predicate and rendered banner passed 7/7 focused tests. The
  editor/save/session/workspace/shortcut impact set passed 81/81.
- One hundred same-tick clicks now call the undo action once; failure is localized
  and releases for an explicit retry. Identity changes dismiss the stale notice.
- Full Node 24 acceptance passed 178 files / 822 tests, lint, typecheck and the
  production build. Cargo collected 79, passed 77 and retained two reasoned
  ignores.
- Inventory initially exposed one new missing stable selector for the dynamic
  button label. Adding `aria-label="撤销 AI 正文写入"` restored the global count
  from 222 to the prior 221, and the complete frontend gate was rerun afterward.
