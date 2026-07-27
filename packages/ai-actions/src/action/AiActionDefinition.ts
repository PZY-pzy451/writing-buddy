import type { z } from 'zod';

export type AiActionId =
	| 'editor.polish'
	| 'editor.condense'
	| 'editor.expand'
	| 'editor.continue'
	| 'editor.dialogue'
	| 'editor.pacing'
	| 'editor.sceneOutline'
	| 'character.generateProfile'
	| 'character.generateBackstory'
	| 'character.generateArc'
	| 'character.generateVoice'
	| 'character.extractFromText'
	| 'relationship.generate'
	| 'relationship.analyzeEvolution'
	| 'world.generateLocation'
	| 'world.generateFaction'
	| 'world.generateRule'
	| 'world.generateCulture'
	| 'world.extractFromText'
	| 'timeline.generateEvent'
	| 'timeline.extractEvents'
	| 'timeline.inferOrdering'
	| 'timeline.detectConflicts'
	| 'item.generate'
	| 'item.extractFromText'
	| 'item.generateHistory'
	| 'plot.generateThread'
	| 'plot.generateConsequences'
	| 'plot.extractProgress'
	| 'foreshadowing.generateSeed'
	| 'foreshadowing.generatePayoff'
	| 'foreshadowing.extract'
	| 'review.consistency';

export type AiActionCategory =
	| 'editor'
	| 'character'
	| 'relationship'
	| 'world'
	| 'timeline'
	| 'item'
	| 'plot'
	| 'foreshadowing'
	| 'review';

export type AiContextKind =
	| 'project'
	| 'current-resource'
	| 'selection'
	| 'scene'
	| 'entity'
	| 'event'
	| 'plot-thread'
	| 'foreshadowing'
	| 'world-rule'
	| 'knowledge-rule'
	| 'style-profile';

export interface AiActionScope {
	readonly hasProject: boolean;
	readonly currentResourceType?: string;
	readonly selectionLength?: number;
	readonly selectedChapterCount?: number;
}

export type AiActionAvailability =
	| { readonly available: true }
	| { readonly available: false; readonly reason: string };

export type AiApplyPolicy =
	| { readonly type: 'text_diff'; readonly allowPartial: true }
	| { readonly type: 'field_patch'; readonly selectableFields: true }
	| { readonly type: 'create_resources'; readonly selectableItems: true }
	| { readonly type: 'create_links'; readonly selectableItems: true }
	| { readonly type: 'review_issues'; readonly maximumSeverity: 'warning' }
	| { readonly type: 'analysis_only' };

export interface AiContextPolicy {
	readonly requiredKinds: readonly AiContextKind[];
	readonly optionalKinds: readonly AiContextKind[];
	readonly maximumTokens: number;
	readonly includeAuthorSecretsByDefault?: false;
}

export interface AiActionDefinition<I = unknown, O = unknown> {
	readonly id: AiActionId;
	readonly title: string;
	readonly description: string;
	readonly category: AiActionCategory;
	readonly availability: (scope: AiActionScope) => AiActionAvailability;
	readonly inputSchema: z.ZodType<I>;
	readonly outputSchema: z.ZodType<O>;
	readonly outputSchemaName: string;
	readonly outputSchemaVersion: number;
	readonly contextPolicy: AiContextPolicy;
	readonly applyPolicy: AiApplyPolicy;
	readonly promptTemplateId: string;
	readonly defaultModelClass: 'fast' | 'reasoning';
}
