# 002 — Legacy source map

| Capability | Legacy source | Next destination |
| --- | --- | --- |
| Project schema | `extensions/writing-buddy/src/projectModel.ts`, `projectSchema.ts` | `packages/domain`, `packages/compatibility` |
| Project repository | `projectRepository.ts`, `manifestWriter.ts`, `projectFileSystem.ts` | `packages/project`, Rust filesystem commands |
| Chapter session | `activeChapterController.ts`, `chapterTracking.ts` | `packages/project`, React Monaco session |
| Resource registry | `referenceCatalog.ts`, `resource/*` | `packages/resource`, React resource editors |
| Local review | `review*.ts`, `reviewRules/*` | `packages/review`, React task dock |
| AI | `ai/*` | `packages/ai`, Rust allowlisted HTTP adapter |
| Snapshots | `version/*` | `packages/version`, Rust archive/filesystem |
| Backups | `backup/*` | `packages/backup`, Rust archive commands |
| Integrity/migration | `integrity/*`, `migration/*` | `packages/migration`, Rust safety adapters |
| Appearance | `appearance/*` | React theme store and semantic tokens |
| Workbench | Code-OSS `src/vs/workbench/contrib/writingBuddy` | React product shell |

Tests are classified by path and imports, not by a hard-coded historical count.
The audited Legacy tree currently has 146 extension test files and 4 core
Writing Buddy test files.
