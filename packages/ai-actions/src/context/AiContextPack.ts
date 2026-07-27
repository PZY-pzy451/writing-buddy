import type { AiActionId, AiContextKind } from '../action/AiActionDefinition';

export type AiContextExclusionReason =
	| 'author-secret'
	| 'token-budget'
	| 'missing-source'
	| 'policy-excluded'
	| 'user-excluded';

export interface AiContextExclusion {
	readonly key: string;
	readonly label: string;
	readonly reason: AiContextExclusionReason;
}

export interface AiContextRecord {
	readonly key: string;
	readonly kind: AiContextKind;
	readonly title: string;
	readonly summary: string;
	readonly resourceId?: string;
	readonly required: boolean;
	readonly included: boolean;
	readonly authorSecret: boolean;
	readonly tokenEstimate: number;
}

export interface AiContextSelection extends AiContextRecord {
	readonly kind: 'selection';
	readonly start: number;
	readonly end: number;
}

export interface AiContextPack {
	readonly actionId: AiActionId;
	readonly project?: AiContextRecord;
	readonly currentResource?: AiContextRecord;
	readonly selection?: AiContextSelection;
	readonly scene?: AiContextRecord;
	readonly entities: readonly AiContextRecord[];
	readonly events: readonly AiContextRecord[];
	readonly plotThreads: readonly AiContextRecord[];
	readonly foreshadowing: readonly AiContextRecord[];
	readonly worldRules: readonly AiContextRecord[];
	readonly knowledgeRules: readonly AiContextRecord[];
	readonly styleProfile?: AiContextRecord;
	readonly exclusions: readonly AiContextExclusion[];
	readonly tokenEstimate: number;
	readonly budgetTokens: number;
}

export function listAiContextRecords(pack: AiContextPack): readonly AiContextRecord[] {
	return [
		...(pack.project ? [pack.project] : []),
		...(pack.currentResource ? [pack.currentResource] : []),
		...(pack.selection ? [pack.selection] : []),
		...(pack.scene ? [pack.scene] : []),
		...pack.entities,
		...pack.events,
		...pack.plotThreads,
		...pack.foreshadowing,
		...pack.worldRules,
		...pack.knowledgeRules,
		...(pack.styleProfile ? [pack.styleProfile] : [])
	];
}
