# Workspace layout shortcuts

Updated: 2026-07-29

## Goal

Make the resizable workspace panes operable through familiar global shortcuts,
not only by pointer drag or after tabbing to a separator.

## Mapping

| Workspace action | Windows/Linux | macOS |
| --- | --- | --- |
| Toggle project sidebar | `Ctrl+B` | `Cmd+B` |
| Toggle writing assistant | `Ctrl+Alt+B` | `Cmd+Option+B` |
| Toggle task/review dock | `Ctrl+J` | `Cmd+J` |

The primary sidebar and panel combinations follow VS Code. The secondary
sidebar combination keeps the same `B` mnemonic while requiring Alt/Option so
it cannot collide with the primary sidebar.

## Behavior contract

- Shortcuts work globally, including while the manuscript editor has focus.
- Auto-repeat, Shift-modified variants, IME composition, and unrelated
  Ctrl/Cmd combinations are ignored.
- Each recognized shortcut prevents the browser/WebView default.
- Project-sidebar visibility persists with the other workspace layout state.
- Hidden panes retain their last user size and restore at that exact size.
- Compact and Story Studio layouts do not reserve an empty sidebar column.

## Discoverability and accessibility

- Layout buttons expose a visible tooltip/title containing the shortcut.
- Buttons use `aria-keyshortcuts` with both Control and Meta variants.
- Settings > Appearance includes a Workspace shortcuts reference.
- Existing focused-separator arrows, Home/End, Enter, and double-click reset
  remain unchanged.

## Validation

1. Unit tests cover every Control and Meta mapping, conflict rejection,
   composition/repeat rejection, action dispatch, and default prevention.
2. Store tests cover sidebar visibility toggling and preservation of pane sizes.
3. CSS contract tests cover zero-width/overlay/sidebar-closed layouts.
4. Browser checks exercise all three shortcuts from the editor at 1536 and
   1024 widths, confirm exact restoration, and verify the Settings reference.
5. Full frontend, Rust, Tauri packaging, and isolated native close gates pass.
