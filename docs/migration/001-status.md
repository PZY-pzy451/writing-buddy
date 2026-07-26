# 001 — Migration status

## Legacy state

- Repository: `D:\develop_tool\writing-buddy`
- Audited commit: `ea0a3eb7`
- Branch: `writer/phase-0.9-windows-distribution`
- Worktree: dirty; it contains substantial uncommitted 0.9–0.12 work.
- Freeze tag: intentionally not created yet because a tag cannot include the
  dirty worktree.
- Legacy remains available for rollback and compatibility inspection.

## Runtime contracts found

- Manifest: `.writing-buddy/project.json`, schema version 1.
- Chapters: project-relative UTF-8 Markdown paths declared in the manifest.
- References: `references/characters`, `references/worldbuilding`,
  `references/timeline.json`, `references/items`, `references/notes`.
- Review: `.writing-buddy/review/issues.json` and `settings.json`.
- Version history: `.writing-buddy/history`.
- Backups: `*.wbbackup` framing version 1.

The older `docs/developer/DataSchema.md` directory-style model does not match
the current runtime schema. The compatibility reader accepts both forms but
never rewrites an older form during preflight.

## Stage policy

The Next client only writes project copies until human cutover gates have
passed. No automated task may mark the 30-session M9 gate complete.
