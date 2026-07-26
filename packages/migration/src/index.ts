import type { CompatibilityIssue } from '@writing-buddy/compatibility';

export type MigrationStage = 'preflight' | 'copy-trial' | 'takeover' | 'complete';

export interface MigrationReport {
	readonly schemaVersion: 1;
	readonly projectId?: string;
	readonly sourceKind: 'legacy-current' | 'legacy-early-directory';
	readonly stage: MigrationStage;
	readonly readOnly: boolean;
	readonly inspectedAt: string;
	readonly issues: readonly CompatibilityIssue[];
	readonly snapshotId?: string;
	readonly backupPath?: string;
}

export function canTakeOver(report: MigrationReport): boolean {
	return report.stage === 'copy-trial'
		&& report.readOnly
		&& !report.issues.some(issue => issue.severity === 'error')
		&& Boolean(report.snapshotId)
		&& Boolean(report.backupPath);
}
