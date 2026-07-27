import { z } from 'zod';
import {
	type AiActionCategory,
	type AiActionDefinition,
	type AiActionId,
	type AiActionScope
} from './AiActionDefinition';

export interface AiActionListEntry {
	readonly definition: AiActionDefinition;
	readonly available: boolean;
	readonly unavailableReason?: string;
}

export class AiActionRegistry {
	private readonly definitions = new Map<AiActionId, AiActionDefinition>();

	register<I, O>(definition: AiActionDefinition<I, O>): void {
		if (this.definitions.has(definition.id)) {
			throw new Error(`aiActionAlreadyRegistered:${definition.id}`);
		}
		this.definitions.set(definition.id, definition);
	}

	get(actionId: AiActionId): AiActionDefinition {
		const definition = this.definitions.get(actionId);
		if (!definition) {
			throw new Error(`aiActionNotFound:${actionId}`);
		}
		return definition;
	}

	list(category?: AiActionCategory): readonly AiActionDefinition[] {
		return [...this.definitions.values()]
			.filter(definition => !category || definition.category === category);
	}

	listAvailable(
		scope: AiActionScope,
		category?: AiActionCategory
	): readonly AiActionDefinition[] {
		return this.list(category)
			.filter(definition => definition.availability(scope).available);
	}

	listWithAvailability(
		scope: AiActionScope,
		category?: AiActionCategory
	): readonly AiActionListEntry[] {
		return this.list(category).map(definition => {
			const availability = definition.availability(scope);
			return {
				definition,
				available: availability.available,
				...(availability.available
					? {}
					: { unavailableReason: availability.reason })
			};
		});
	}
}

const consistencyInputSchema = z.object({
	instruction: z.string().trim().max(500).default('')
}).strict();

const gateDInputSchema = z.object({
	instruction: z.string().trim().min(1).max(2_000),
	sourceResourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	selectedCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u).optional(),
	targetCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u).optional()
}).strict();

const gateDEvidenceSchema = z.object({
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	quote: z.string().min(1).max(4_000)
}).strict();

const characterFieldCandidateSchema = z.object({
	key: z.string().min(1).max(80),
	value: z.unknown(),
	evidence: gateDEvidenceSchema.nullable()
}).strict();

const characterCandidateOutputSchema = z.object({
	candidates: z.array(z.object({
		title: z.string().min(1).max(160),
		role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']).optional(),
		confidence: z.number().min(0).max(1),
		rationale: z.string().min(1).max(2_000),
		fields: z.array(characterFieldCandidateSchema).min(1).max(24)
	}).strict()).max(12)
}).strict();

const relationshipCandidateOutputSchema = z.object({
	candidates: z.array(z.object({
		sourceCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u),
		targetCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u),
		relationshipType: z.string().min(1).max(160),
		strength: z.number().min(0).max(1).optional(),
		visibility: z.enum(['public', 'private', 'secret']),
		description: z.string().max(10_000).optional(),
		confidence: z.number().min(0).max(1),
		rationale: z.string().min(1).max(2_000),
		evidence: gateDEvidenceSchema.nullable()
	}).strict()).max(24)
}).strict();

function gateDAvailability(
	surface: 'character-center' | 'relationship-graph',
	scope: AiActionScope
) {
	if (!scope.hasProject) return { available: false as const, reason: '请先打开作品' };
	if (scope.currentResourceType !== surface) {
		return {
			available: false as const,
			reason: surface === 'character-center'
				? '请在人物中心使用此动作'
				: '请在人物关系图使用此动作'
		};
	}
	return { available: true as const };
}

export function createCharacterAiActions(): readonly AiActionDefinition[] {
	const definitions: readonly {
		readonly id:
			| 'character.generateProfile'
			| 'character.generateBackstory'
			| 'character.generateArc'
			| 'character.generateVoice'
			| 'character.extractFromText';
		readonly title: string;
		readonly description: string;
		readonly applyPolicy: AiActionDefinition['applyPolicy'];
	}[] = [{
		id: 'character.generateProfile',
		title: '生成三个人物',
		description: '生成三个不同的人物候选，并逐字段确认。',
		applyPolicy: { type: 'create_resources', selectableItems: true }
	}, {
		id: 'character.generateBackstory',
		title: '补全人物背景',
		description: '为当前人物生成背景字段候选。',
		applyPolicy: { type: 'field_patch', selectableFields: true }
	}, {
		id: 'character.generateArc',
		title: '设计人物弧',
		description: '生成目标、欲望、恐惧和价值观候选。',
		applyPolicy: { type: 'field_patch', selectableFields: true }
	}, {
		id: 'character.generateVoice',
		title: '生成语言风格',
		description: '生成人物语言风格候选。',
		applyPolicy: { type: 'field_patch', selectableFields: true }
	}, {
		id: 'character.extractFromText',
		title: '从正文提取人物',
		description: '从明确选择的章节提取人物、状态、知识和持有物。',
		applyPolicy: { type: 'field_patch', selectableFields: true }
	}];
	return definitions.map(definition => ({
		...definition,
		category: 'character',
		availability: scope => gateDAvailability('character-center', scope),
		inputSchema: gateDInputSchema,
		outputSchema: characterCandidateOutputSchema,
		outputSchemaName: 'CharacterAnalysisResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource'],
			optionalKinds: ['entity'],
			maximumTokens: 12_000
		},
		promptTemplateId: 'character.analysis',
		defaultModelClass: 'reasoning'
	}));
}

export function createRelationshipAiActions(): readonly AiActionDefinition[] {
	const definitions: readonly {
		readonly id: 'relationship.generate' | 'relationship.analyzeEvolution';
		readonly title: string;
		readonly description: string;
		readonly applyPolicy: AiActionDefinition['applyPolicy'];
	}[] = [{
		id: 'relationship.generate',
		title: '生成双向关系',
		description: '生成方向明确、可分别接受的关系候选。',
		applyPolicy: { type: 'create_links', selectableItems: true }
	}, {
		id: 'relationship.analyzeEvolution',
		title: '分析关系变化',
		description: '从明确选择的章节提取有证据的关系变化。',
		applyPolicy: { type: 'create_links', selectableItems: true }
	}];
	return definitions.map(definition => ({
		...definition,
		category: 'relationship' as const,
		availability: (scope: AiActionScope) => gateDAvailability('relationship-graph', scope),
		inputSchema: gateDInputSchema,
		outputSchema: relationshipCandidateOutputSchema,
		outputSchemaName: 'RelationshipAnalysisResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource' as const],
			optionalKinds: ['entity' as const],
			maximumTokens: 12_000
		},
		promptTemplateId: 'relationship.analysis',
		defaultModelClass: 'reasoning' as const
	}));
}

export const consistencyReviewOutputSchema = z.object({
	issues: z.array(z.object({
		start: z.number().int().nonnegative(),
		end: z.number().int().nonnegative(),
		target: z.string().min(1).max(4_000),
		severity: z.enum(['info', 'suggestion', 'warning', 'error']),
		title: z.string().min(1).max(80),
		message: z.string().min(1).max(500),
		replacement: z.string().max(4_000).optional()
	}).strict()).max(50)
}).strict();

export function createConsistencyReviewAction(): AiActionDefinition<
	z.infer<typeof consistencyInputSchema>,
	z.infer<typeof consistencyReviewOutputSchema>
> {
	return {
		id: 'review.consistency',
		title: '一致性审查',
		description: '复用现有章节审校任务，在统一抽屉中预览候选问题。',
		category: 'review',
		availability: scope => {
			if (!scope.hasProject) {
				return { available: false, reason: '请先打开作品' };
			}
			if (scope.currentResourceType !== 'chapter') {
				return { available: false, reason: '请先打开一个章节' };
			}
			return { available: true };
		},
		inputSchema: consistencyInputSchema,
		outputSchema: consistencyReviewOutputSchema,
		outputSchemaName: 'ChapterReviewResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource'],
			optionalKinds: [],
			maximumTokens: 12_000
		},
		applyPolicy: { type: 'review_issues', maximumSeverity: 'warning' },
		promptTemplateId: 'review.consistency',
		defaultModelClass: 'reasoning'
	};
}

export function createDefaultAiActionRegistry(): AiActionRegistry {
	const registry = new AiActionRegistry();
	registry.register(createConsistencyReviewAction());
	for (const action of createCharacterAiActions()) registry.register(action);
	for (const action of createRelationshipAiActions()) registry.register(action);
	return registry;
}
