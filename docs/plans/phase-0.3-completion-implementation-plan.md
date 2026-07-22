# Phase 0.3 Completion Pass — Implementation Plan

## Goal
Mark `Phase 0.3 — Writer Workbench Layout Prototype COMPLETE` by closing scope creep, completing the core feature loop (chapter switching, word counts, save state, second-launch restore), and running a full acceptance.

## Scope split
- 30%: disable / isolate scope-creep features
- 50%: close the core feature loop
- 20%: visual cleanup, build, acceptance

## Final state

### Keep
- Left novel tree (single volume, three chapters, characters/world/timeline/notes as placeholders)
- Monaco Chinese text editor
- Three-column layout
- Chapter open + sample fixtures
- Chinese input, undo/redo, find, replace, save
- Reusable word-count logic
- Hot exit + editor restore from Code-OSS

### Disable (not just visually hide)
- AI suggestions / review / context tabs
- Polish suggestion cards (accept/ignore/diff)
- Quick actions (polish, condense, grammar, dialogue, rhythm)
- Inline content annotations (character/location/foreshadow)
- Sign In, Accounts entry, sign-in notifications
- Pending / diff / background tasks / backup records status items
- Daily word count, target word count, backup status indicators
- Open sample novel prompt, forceReuseWindow reload
- Product header webview panel (Action bar buttons; simplify to a minimal top breadcrumb)

These must be removed, not hidden:
- Do not register commands
- Do not create webviews
- Do not add decorations
- Do not start background tasks
- Do not call the network

### Defer
- AI model calls
- TipTap
- Character / worldbuilding / timeline / notes editing
- New work
- Drag-to-reorder
- Cloud sync
- Account system
- Real backup management
- Installer + auto-update
- Unknown commit fix
- Mermaid proposal error fix

## Frozen UI

### Left
- 我的小说
  - 第一卷
    - 第一章 停摆的时钟
    - 第二章 迷路的旅人
    - 第三章 深夜的访客
- 人物, 世界观, 时间线, 笔记 (placeholder entries; no click-into-VS-Code fallback)
- 今日写作 (entry; no autosave backend)

### Middle
- Monaco editor, no line numbers, no minimap, no breadcrumb, no decorations
- Auto wrap, 1.8 line height, side margins
- No encoding / EOL / indentation / language indicators
- Markdown `#` heading remains (not blocking)

### Right
- 章节资料 (single panel, static)
- Field rows: 场景, 时间, 视角人物, 出场人物, 本章目标, 备注
- Three chapters pre-configured
- Updates on active chapter change
- "本章资料未设置" fallback

### Bottom status
- 本章 170 字
- 全书 532 字
- 未保存 / 已保存
- All other items hidden

## Architecture

### Feature gate
```
phase03Features = {
  aiSuggestions: false,
  aiDecorations: false,
  aiQuickActions: false,
  accountUi: false,
  dailyWriting: false,
  backupStatus: false,
  productHeader: false,
  contentAnnotations: false,
  volumeDuplication: false,
  placeholderLinks: false
}
```

### Unified chapter model
- `ChapterDescriptor { id, title, relativePath, volumeId }`
- `ChapterMetadata { chapterId, location, time, pov, characters, goal, notes }`

### Single active chapter controller
A controller that owns:
- Click tree node
- onDidChangeActiveTextEditor
- onDidChangeTextDocument (debounced ~200ms)
- onDidSaveTextDocument
- onDidCloseTextDocument

And updates:
- left tree highlight
- center editor
- right chapter metadata (or fallback)
- chapter word count
- novel word count
- save state
- last active chapter persisted via `workspaceState`

URI → chapterId resolution is the single source of truth.

## Word counts

`countWritingUnits(text)` is the only counting function:
- Each CJK char (Han, Hiragana, Katakana, Hangul) = 1
- Each contiguous ASCII letter sequence = 1
- Each contiguous digit sequence = 1
- Punctuation, whitespace, markdown markers = 0
- No full markdown parsing

Word counts:
- Chapter: Monaco document memory content (live), 200ms debounced
- Novel: in-memory override > disk content, summed across the three chapters

Single service, consumed by both the left tree and the bottom status.

## Save state

Two states only: 未保存 / 已保存. Source of truth: `TextDocument.isDirty`.

Tracked via:
- onDidChangeActiveTextEditor
- onDidChangeTextDocument
- onDidSaveTextDocument
- onDidCloseTextDocument

Switching chapter shows the target chapter's actual save state.

## Second-launch restore

Persist: `currentWorkspace` (implicit), `lastChapterId` (workspaceState).

Priority on launch:
1. Code-OSS already restored an editor → use it
2. Else lastChapterId exists → open that chapter
3. Else first launch → open Chapter 001

On restore sync: tree highlight, editor content, metadata, word counts, save state.

## Account handling

Order:
1. Product config (settings.json) hides the entry
2. Disable menu / contribution
3. Last resort: minimal workbench source change

Forbidden: CSS masking, timer-based notification killing, DOM removal hacks, swallowing errors.

Acceptance:
- No Sign In
- 30s of running: no account request
- No sign-in-failed notification
- No Accounts menu nudge
- Edit + save works

## Task order
- Task 0: source path map (`docs/plans/phase-0.3-source-map.md`)
- Task 1: feature gate + AI removal
- Task 2: account removal
- Task 3: chapter tree stabilization
- Task 4: static chapter metadata
- Task 5: unified word counts
- Task 6: save state
- Task 7: second-launch restore
- Task 8: visual cleanup
- Task 9: automated tests
- Task 10: full acceptance

## Commit order
- docs: map phase 0.3 source responsibilities
- refactor: gate unfinished writing assistant features
- fix: remove account sign-in from writer workbench
- feat: stabilize novel outline chapter switching
- feat: show static chapter metadata
- feat: consolidate chapter and novel word counts
- feat: restore save and active chapter state
- style: simplify writer workbench shell
- test: cover phase 0.3 writer workflow
- docs: record phase 0.3 acceptance evidence

Per commit:
- `git status --short`
- `git diff --check`

## Completion criteria

- Default: no AI suggestions, decorations, quick actions
- No Sign In, no sign-in-failed notification
- Three chapters can be cycled stably
- Left, center, right, status stay in sync
- Chapter and novel word counts correct
- Unsaved / saved states correct
- Second launch restores the last chapter
- Chinese editing is safe
- Isolated data directory works
- Full Watch has no new blocking errors
- Electron starts cleanly
- Unknown commit (deferred)
- Mermaid proposal (deferred)
- Clean working tree
- Local and bare origin in sync
