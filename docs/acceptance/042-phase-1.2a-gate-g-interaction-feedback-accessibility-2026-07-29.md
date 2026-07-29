# Phase 1.2A Gate G interaction feedback and accessibility acceptance

Date: 2026-07-29

## Decision

Gate G is complete and recommended for human approval. The implementation
stops before Gate H.

The gate finishes the existing writer interactions with semantic drag
previews, explicit saved-result feedback and Undo, one complete shortcut
contract, reliable focus restoration, responsive controls, restrained motion,
and reduced-motion support. It adds no AI action, Prompt, provider, Story
resource type, project index, cloud service, or resident process.

## Drag preview and result feedback

- Project structure drag handles remain keyboard reachable but are visually
  quiet until hover, focus-within, or active drag.
- Reorder lists use a 160 ms transform transition. Shared association panels
  use 160 ms backdrop and 200 ms panel feedback; result Toast uses 160 ms
  opacity/transform feedback.
- Visible drop previews and polite live regions use the same domain copy, for
  example **移动到“第二卷 雾中来客”末尾**,
  **关联为当前场景出场人物**, and **标记为伏笔回收**.
- Invalid targets state the reason in text, including
  **人物不能移动到卷结构中**, and never enter a mutation path.
- Result Toast titles identify the completed operation. Browser acceptance
  moved a chapter across volumes and observed **章节已移动并保存** plus the
  exact result **改变父级并改变顺序** and a working **撤销** action.
- Association results explicitly say whether a relation or state event was
  created and that manuscript order and parent were unchanged. Plot and
  timeline results state lifecycle/order effects.

## Complete shortcut and focus contract

One pure resolver now owns and tests the writer shortcuts:

| Action | Shortcut |
| --- | --- |
| Writer Navigator | Ctrl/Cmd+K |
| Full search | Ctrl/Cmd+Shift+F |
| New chapter | Ctrl/Cmd+N |
| Quick create | Ctrl/Cmd+Shift+N |
| Quick Capture | Ctrl/Cmd+Shift+Space |
| AI quick actions | Alt/Option+A |
| Focus mode | F11 |
| Save | Ctrl/Cmd+S |
| Close tab | Ctrl/Cmd+W |
| Restore tab | Ctrl/Cmd+Shift+T |
| Switch tab | Ctrl/Cmd+Tab |
| Undo | Ctrl/Cmd+Z |

- Settings exposes the same complete table.
- `Ctrl/Cmd+N` now opens a real chapter-creation dialog. Native creation uses
  the project lock, expected manifest revision, create-only manuscript write,
  atomic manifest replacement, rollback, and verified reopen.
- Quick create opens the existing menu and restores its exact focus origin.
  AI quick actions open the existing idle drawer without starting a paid job.
- Resource tabs support Left/Right/Home/End in addition to
  close/restore/switch shortcuts.
- Quick Capture and chapter creation use the shared modal focus trap. Escape
  closes exactly once and restores the connected element that opened them.
- Monaco and ordinary text controls retain native text Undo priority.

## Automated verification

All final commands used Node 24.14.0, pnpm 10.32.1, and
`CARGO_BUILD_JOBS=1` for native work.

| Check | Result |
| --- | --- |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Gate G targeted interaction suite | 9 files, 45 tests passed |
| Complete Vitest suite | 127 files, 468 tests passed |
| Change-aware self-test | Passed all selected frontend and Rust gates |
| Vite production build | Passed, 2,974 modules |
| Rust formatting | Passed |
| Rust tests | 55 passed, 2 explicit external gates ignored |
| Windows Tauri release | Passed |
| NSIS installer | Passed |
| Native launch / normal close | Responsive, exit code 0 |

The reusable `pnpm acceptance:gate-g` runner launches an isolated Edge
profile, drives the real React surface, captures screenshots, fails on
responsive/focus/interaction regressions, and writes machine-readable metrics.

## Visual and interaction acceptance

The deterministic browser fixture exercised the exact required viewports:

- [Semantic cross-volume drag preview, 1536×992](./screenshots/gate-writer-g/01-semantic-drag-preview-1536x992.png)
- [Ctrl/Cmd+N chapter dialog and focused title, 1280×800](./screenshots/gate-writer-g/02-chapter-shortcut-focus-1280x800.png)
- [Compact reduced-motion chapter dialog, 1024×720](./screenshots/gate-writer-g/03-compact-reduced-motion-1024x720.png)

All three viewports report zero document X/Y overflow and zero interactive
controls clipped outside a non-scrollable region. Acceptance also verified:

- drag handle opacity changes from 0 to 1 on hover without layout shift;
- keyboard drag pickup remains available;
- semantic preview, saved result, Undo, and verified undo completion;
- quick-create first-item focus and exact Escape restoration;
- idle Alt+A drawer focus and exact Escape restoration;
- chapter-title focus, dialog bounds, and zero controls below 44 px;
- F11 editor-only focus mode and Escape exit;
- matched reduced-motion media query with no named animation and an effective
  duration below 1 ms.

Machine-readable evidence is in
[`gate-writer-g-visual-metrics.json`](./gate-writer-g-visual-metrics.json).

## Build artifacts

- Portable:
  `apps/desktop/src-tauri/target/release/writing-buddy-next.exe`
  - 7,656,448 bytes
  - SHA-256
    `6FA315414D2BAA64DFDC4C106FA7920468205C869269D5F32195D8B959003BA2`
- NSIS:
  `apps/desktop/src-tauri/target/release/bundle/nsis/Writing Buddy_0.1.0_x64-setup.exe`
  - 3,452,920 bytes
  - SHA-256
    `99A9D961D2B001870272799C1BC5F69AC2B17D8EE6E8B9368DA7DC6EFCB3EA23`

Both are internal unsigned Windows x64 0.1.0 builds. The portable executable
was launched with isolated application-data directories as PID 33200. It
reached input idle, exposed a responsive main window titled `Writing Buddy`,
accepted normal close, and exited with code 0.

The production build retains the existing Monaco chunk-size advisory.

## Stop line

Do not create five writer profiles, claim real-user acceptance, or begin Gate
H until a new user direction explicitly authorizes it.
