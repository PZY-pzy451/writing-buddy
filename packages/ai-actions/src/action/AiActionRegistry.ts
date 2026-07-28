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

const manuscriptOrganizationInputSchema = z.object({
	instruction: z.string().trim().min(1).max(2_000),
	sourceResourceIds: z.array(
		z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u)
	).min(1).max(1_000),
	targetTypes: z.array(z.enum([
		'character',
		'scene',
		'location',
		'faction',
		'item',
		'worldRule',
		'timelineEvent',
		'relationship',
		'plotThread',
		'foreshadowing',
		'information'
	])).min(1).max(11)
}).strict();

const manuscriptOrganizationOutputSchema = z.object({
	runId: z.string().regex(/^extraction-run:[a-z0-9][a-z0-9-]*$/u),
	status: z.enum([
		'planned',
		'running',
		'stopped',
		'completed',
		'completed-with-errors'
	]),
	tokenEstimate: z.number().int().positive(),
	chapterCount: z.number().int().positive()
}).strict();

const crossChapterConsistencyInputSchema = z.object({
	instruction: z.string().trim().min(1).max(2_000),
	sourceResourceIds: z.array(
		z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u)
	).min(2).max(12)
}).strict();

const crossChapterConsistencyOutputSchema = z.object({
	issues: z.array(z.object({
		ruleId: z.string().regex(/^ai-[a-z0-9][a-z0-9-]*$/u),
		severity: z.enum(['info', 'suggestion', 'warning']),
		title: z.string().min(1).max(120),
		evidenceCount: z.number().int().min(2).max(4),
		storyFactResourceId: z.string().optional()
	}).strict()).max(50)
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

const gateEWorldInputSchema = z.object({
	instruction: z.string().trim().min(1).max(2_000),
	sourceResourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	targetType: z.enum([
		'location',
		'faction',
		'culture',
		'religion',
		'technology',
		'magic',
		'law',
		'world-rule'
	]).optional()
}).strict();

const gateEWorldBase = {
	title: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)).max(40),
	confidence: z.number().min(0).max(1),
	rationale: z.string().min(1).max(2_000),
	evidence: gateDEvidenceSchema.nullable()
};
const gateEWorldOutputSchema = z.object({
	candidates: z.array(z.discriminatedUnion('kind', [
		z.object({
			kind: z.literal('location'),
			...gateEWorldBase,
			summary: z.string().min(1).max(10_000),
			locationType: z.string().min(1).max(160),
			parentLocationId: z.string().regex(/^location:[a-z0-9][a-z0-9-]*$/u).nullable(),
			rules: z.array(z.string().min(1).max(2_000)).max(40)
		}).strict(),
		z.object({
			kind: z.literal('faction'),
			...gateEWorldBase,
			summary: z.string().min(1).max(10_000),
			ideology: z.string().min(1).max(5_000),
			goals: z.array(z.string().min(1).max(1_000)).max(40),
			territoryLocationIds: z.array(
				z.string().regex(/^location:[a-z0-9][a-z0-9-]*$/u)
			).max(100)
		}).strict(),
		z.object({
			kind: z.literal('worldRule'),
			...gateEWorldBase,
			category: z.enum(['culture', 'religion', 'technology', 'magic', 'law', 'other']),
			statement: z.string().min(1).max(10_000),
			scope: z.string().min(1).max(2_000),
			exceptions: z.array(z.string().min(1).max(2_000)).max(40),
			consequences: z.array(z.string().min(1).max(2_000)).max(40),
			conflicts: z.array(z.object({
				resourceId: z.string().regex(/^world-rule:[a-z0-9][a-z0-9-]*$/u),
				reason: z.string().min(1).max(2_000)
			}).strict()).max(24)
		}).strict()
	])).max(24)
}).strict();

const gateEItemInputSchema = z.object({
	instruction: z.string().trim().min(1).max(2_000),
	sourceResourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	selectedItemId: z.string().regex(/^item:[a-z0-9][a-z0-9-]*$/u).optional()
}).strict();

const gateEItemOutputSchema = z.object({
	candidates: z.array(z.object({
		title: z.string().trim().min(1).max(160),
		aliases: z.array(z.string().trim().min(1).max(160)).max(40),
		itemType: z.string().trim().min(1).max(160),
		unique: z.boolean(),
		quantityUnit: z.string().trim().min(1).max(160).nullable(),
		description: z.string().trim().min(1).max(10_000),
		restrictions: z.array(z.string().trim().min(1).max(1_000)).max(40),
		plotFunction: z.string().trim().min(1).max(5_000),
		confidence: z.number().min(0).max(1),
		rationale: z.string().min(1).max(2_000),
		evidence: gateDEvidenceSchema.nullable(),
		states: z.array(z.object({
			action: z.enum(['acquired', 'transferred', 'used', 'lost', 'destroyed', 'adjusted']),
			quantity: z.number().finite().nonnegative(),
			holderCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u).nullable(),
			locationId: z.string().regex(/^location:[a-z0-9][a-z0-9-]*$/u).nullable(),
			condition: z.string().trim().min(1).max(1_000).nullable(),
			evidence: gateDEvidenceSchema.nullable()
		}).strict()).max(12)
	}).strict()).max(16)
}).strict();

const gateFInputSchema = z.object({
	instruction: z.string().trim().min(1).max(2_000),
	sourceResourceIds: z.array(
		z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u)
	).min(1).max(12),
	selectedResourceId: z.string().max(160).optional(),
	includeAuthorSecrets: z.boolean().optional()
}).strict();

const gateFPositionSchema = z.object({
	chapterId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	narrativeOrder: z.number().int().nonnegative()
}).strict();

const gateFTimelineOutputSchema = z.object({
	candidates: z.array(z.object({
		clientCandidateId: z.string().regex(/^candidate:[a-z0-9][a-z0-9-]*$/u),
		sourceResourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
		title: z.string().trim().min(1).max(160),
		aliases: z.array(z.string().trim().min(1).max(160)).max(40),
		summary: z.string().trim().min(1).max(10_000),
		eventType: z.string().trim().min(1).max(160),
		storyTimeKind: z.enum(['exact', 'date', 'relative', 'range', 'unknown']),
		storyStart: z.string().trim().min(1).max(160).nullable(),
		storyEnd: z.string().trim().min(1).max(160).nullable(),
		narrativeOrder: z.number().int().nonnegative(),
		participantIds: z.array(z.string()).max(100),
		locationIds: z.array(z.string()).max(100),
		itemIds: z.array(z.string()).max(100),
		predecessorIds: z.array(z.string()).max(100),
		consequenceIds: z.array(z.string()).max(100),
		plotThreadIds: z.array(z.string()).max(100),
		foreshadowingIds: z.array(z.string()).max(100),
		directResults: z.array(z.string().trim().min(1).max(2_000)).max(40),
		impacts: z.array(z.string().trim().min(1).max(2_000)).max(40),
		confidence: z.number().min(0).max(1),
		rationale: z.string().trim().min(1).max(2_000),
		evidence: gateDEvidenceSchema.nullable()
	}).strict()).max(32),
	causalEdges: z.array(z.object({
		clientEdgeId: z.string().regex(/^edge:[a-z0-9][a-z0-9-]*$/u),
		from: z.object({
			kind: z.enum(['existing', 'candidate']),
			id: z.string().trim().min(1).max(160)
		}).strict(),
		to: z.object({
			kind: z.enum(['existing', 'candidate']),
			id: z.string().trim().min(1).max(160)
		}).strict(),
		relation: z.enum(['precondition', 'causes', 'enables', 'blocks']),
		confidence: z.number().min(0).max(1),
		rationale: z.string().trim().min(1).max(2_000)
	}).strict()).max(64)
}).strict();

const gateFPlotBase = {
	sourceResourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	title: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)).max(40),
	summary: z.string().trim().min(1).max(10_000),
	confidence: z.number().min(0).max(1),
	rationale: z.string().trim().min(1).max(2_000),
	evidence: gateDEvidenceSchema.nullable()
};

const gateFPlotOutputSchema = z.object({
	candidates: z.array(z.discriminatedUnion('kind', [
		z.object({
			kind: z.literal('plotThread'),
			...gateFPlotBase,
			status: z.enum(['planned', 'active', 'at-risk', 'resolved', 'abandoned']),
			premise: z.string().trim().min(1).max(10_000),
			stakes: z.string().trim().min(1).max(5_000),
			dramaticQuestion: z.string().trim().min(1).max(5_000),
			startPosition: gateFPositionSchema.nullable(),
			targetResolution: gateFPositionSchema.nullable(),
			actualResolution: gateFPositionSchema.nullable(),
			participantIds: z.array(z.string()).max(100),
			sceneIds: z.array(z.string()).max(100)
		}).strict(),
		z.object({
			kind: z.literal('foreshadowing'),
			...gateFPlotBase,
			status: z.enum(['planted', 'reminded', 'resolved', 'overdue', 'abandoned']),
			plantedAt: gateFPositionSchema.nullable(),
			surfaceMeaning: z.string().trim().min(1).max(5_000),
			trueMeaning: z.string().trim().min(1).max(5_000).nullable(),
			reminderPositions: z.array(gateFPositionSchema).max(40),
			plannedPayoffAt: gateFPositionSchema.nullable(),
			actualPayoffAt: gateFPositionSchema.nullable(),
			readerVisibility: z.number().min(0).max(1),
			plotThreadIds: z.array(z.string()).max(100)
		}).strict()
	])).max(24)
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

function gateEAvailability(
	surface: 'worldbuilding-center' | 'story-assets',
	scope: AiActionScope
) {
	if (!scope.hasProject) return { available: false as const, reason: '请先打开作品' };
	if (scope.currentResourceType !== surface) {
		return {
			available: false as const,
			reason: surface === 'worldbuilding-center'
				? '请在世界观中心使用此动作'
				: '请在物品与资产页使用此动作'
		};
	}
	return { available: true as const };
}

function gateFAvailability(
	surface: 'story-progress' | 'plot-board',
	scope: AiActionScope
) {
	if (!scope.hasProject) return { available: false as const, reason: '请先打开作品' };
	if (scope.currentResourceType !== surface) {
		return {
			available: false as const,
			reason: surface === 'story-progress'
				? '请在故事进程页使用此动作'
				: '请在剧情线与伏笔页使用此动作'
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

export function createWorldAiActions(): readonly AiActionDefinition[] {
	const definitions: readonly {
		readonly id:
			| 'world.generateLocation'
			| 'world.generateFaction'
			| 'world.generateRule'
			| 'world.generateCulture'
			| 'world.extractFromText';
		readonly title: string;
		readonly description: string;
	}[] = [{
		id: 'world.generateLocation',
		title: '生成地点',
		description: '生成带层级、类型和局部规则的地点候选。'
	}, {
		id: 'world.generateFaction',
		title: '生成势力',
		description: '生成势力纲领、目标和已知领地候选。'
	}, {
		id: 'world.generateRule',
		title: '生成世界规则',
		description: '生成带适用范围、例外、后果和冲突提示的规则。'
	}, {
		id: 'world.generateCulture',
		title: '生成文化设定',
		description: '以结构化文化规则生成可审核候选。'
	}, {
		id: 'world.extractFromText',
		title: '从正文提取世界观',
		description: '从明确选择的章节拆分地点、势力和规则条目。'
	}];
	return definitions.map(definition => ({
		...definition,
		category: 'world' as const,
		availability: (scope: AiActionScope) => gateEAvailability('worldbuilding-center', scope),
		inputSchema: gateEWorldInputSchema,
		outputSchema: gateEWorldOutputSchema,
		outputSchemaName: 'WorldAnalysisResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource' as const],
			optionalKinds: ['world-rule' as const, 'entity' as const],
			maximumTokens: 12_000
		},
		applyPolicy: { type: 'field_patch' as const, selectableFields: true as const },
		promptTemplateId: 'world.analysis',
		defaultModelClass: 'reasoning' as const
	}));
}

export function createItemAiActions(): readonly AiActionDefinition[] {
	const definitions: readonly {
		readonly id: 'item.generate' | 'item.extractFromText' | 'item.generateHistory';
		readonly title: string;
		readonly description: string;
	}[] = [{
		id: 'item.generate',
		title: '生成物品卡',
		description: '生成外观、用途、限制和叙事作用。'
	}, {
		id: 'item.extractFromText',
		title: '从正文提取物品',
		description: '提取物品、持有人、地点和流转事件候选。'
	}, {
		id: 'item.generateHistory',
		title: '生成物品历史',
		description: '为当前物品生成可分别确认的历史与转移事件。'
	}];
	return definitions.map(definition => ({
		...definition,
		category: 'item' as const,
		availability: (scope: AiActionScope) => gateEAvailability('story-assets', scope),
		inputSchema: gateEItemInputSchema,
		outputSchema: gateEItemOutputSchema,
		outputSchemaName: 'ItemAnalysisResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource' as const],
			optionalKinds: ['entity' as const],
			maximumTokens: 12_000
		},
		applyPolicy: { type: 'field_patch' as const, selectableFields: true as const },
		promptTemplateId: 'item.analysis',
		defaultModelClass: 'reasoning' as const
	}));
}

export function createTimelineAiActions(): readonly AiActionDefinition[] {
	const definitions: readonly {
		readonly id:
			| 'timeline.generateEvent'
			| 'timeline.extractEvents'
			| 'timeline.inferOrdering'
			| 'timeline.detectConflicts';
		readonly title: string;
		readonly description: string;
	}[] = [{
		id: 'timeline.generateEvent',
		title: '按章节目标生成事件',
		description: '生成事件骨架、结果与后续影响候选。'
	}, {
		id: 'timeline.extractEvents',
		title: '从正文提取事件',
		description: '从明确选择的章节提取带精确证据的事件。'
	}, {
		id: 'timeline.inferOrdering',
		title: '生成三种后续',
		description: '生成三个实质不同的下一步事件方向。'
	}, {
		id: 'timeline.detectConflicts',
		title: '补全因果',
		description: '提出可分别接受的前置、因果与阻断边。'
	}];
	return definitions.map(definition => ({
		...definition,
		category: 'timeline' as const,
		availability: (scope: AiActionScope) => gateFAvailability('story-progress', scope),
		inputSchema: gateFInputSchema,
		outputSchema: gateFTimelineOutputSchema,
		outputSchemaName: 'TimelineAnalysisResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource' as const],
			optionalKinds: ['entity' as const, 'event' as const, 'plot-thread' as const, 'foreshadowing' as const],
			maximumTokens: 16_000
		},
		applyPolicy: { type: 'create_resources' as const, selectableItems: true as const },
		promptTemplateId: 'timeline.analysis',
		defaultModelClass: 'reasoning' as const
	}));
}

export function createPlotAiActions(): readonly AiActionDefinition[] {
	const definitions: readonly {
		readonly id:
			| 'plot.generateThread'
			| 'plot.generateConsequences'
			| 'plot.extractProgress'
			| 'foreshadowing.generateSeed'
			| 'foreshadowing.generatePayoff'
			| 'foreshadowing.extract';
		readonly title: string;
		readonly description: string;
		readonly category: 'plot' | 'foreshadowing';
	}[] = [{
		id: 'plot.generateThread',
		title: '生成剧情线',
		description: '生成前提、赌注、戏剧问题与计划解决位置。',
		category: 'plot'
	}, {
		id: 'plot.generateConsequences',
		title: '生成阻碍与转折',
		description: '为当前剧情线生成推进、阻碍与解决候选。',
		category: 'plot'
	}, {
		id: 'plot.extractProgress',
		title: '提取剧情推进',
		description: '从正文提取带精确证据的剧情线推进。',
		category: 'plot'
	}, {
		id: 'foreshadowing.generateSeed',
		title: '生成伏笔',
		description: '生成埋设、提醒和计划回收候选。',
		category: 'foreshadowing'
	}, {
		id: 'foreshadowing.generatePayoff',
		title: '生成回收方式',
		description: '为当前伏笔生成可审核的回收候选。',
		category: 'foreshadowing'
	}, {
		id: 'foreshadowing.extract',
		title: '从正文提取伏笔',
		description: '提取潜在伏笔、提醒或回收并保留证据。',
		category: 'foreshadowing'
	}];
	return definitions.map(definition => ({
		...definition,
		availability: (scope: AiActionScope) => gateFAvailability('plot-board', scope),
		inputSchema: gateFInputSchema,
		outputSchema: gateFPlotOutputSchema,
		outputSchemaName: 'PlotAnalysisResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource' as const],
			optionalKinds: ['entity' as const, 'plot-thread' as const, 'foreshadowing' as const],
			maximumTokens: 16_000,
			includeAuthorSecretsByDefault: false as const
		},
		applyPolicy: { type: 'create_resources' as const, selectableItems: true as const },
		promptTemplateId: 'plot.analysis',
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

export function createGateGAiActions(): readonly AiActionDefinition[] {
	return [{
		id: 'manuscript.organize',
		title: 'AI 从正文整理',
		description: '按章节分批提取所选 Story Kernel 类型，统一进入冲突候选。',
		category: 'manuscript',
		availability: scope => scope.hasProject
			? { available: true }
			: { available: false, reason: '请先打开作品' },
		inputSchema: manuscriptOrganizationInputSchema,
		outputSchema: manuscriptOrganizationOutputSchema,
		outputSchemaName: 'ManuscriptExtractionRun',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource'],
			optionalKinds: ['entity', 'event', 'plot-thread', 'foreshadowing', 'world-rule'],
			maximumTokens: 16_000,
			includeAuthorSecretsByDefault: false
		},
		applyPolicy: { type: 'create_resources', selectableItems: true },
		promptTemplateId: 'story-kernel.generation',
		defaultModelClass: 'reasoning'
	}, {
		id: 'review.crossChapterConsistency',
		title: 'AI 对照审查',
		description: '以证据 A/B 和 Story Fact 生成不直接修改内容的 ReviewIssue。',
		category: 'review',
		availability: scope => {
			if (!scope.hasProject) return { available: false, reason: '请先打开作品' };
			if ((scope.selectedChapterCount ?? 0) < 2) {
				return { available: false, reason: '请至少选择两个章节' };
			}
			return { available: true };
		},
		inputSchema: crossChapterConsistencyInputSchema,
		outputSchema: crossChapterConsistencyOutputSchema,
		outputSchemaName: 'StoryConsistencyReviewIssues',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource'],
			optionalKinds: ['entity', 'event', 'plot-thread', 'foreshadowing', 'world-rule'],
			maximumTokens: 16_000,
			includeAuthorSecretsByDefault: false
		},
		applyPolicy: { type: 'review_issues', maximumSeverity: 'warning' },
		promptTemplateId: 'story.consistency.analysis',
		defaultModelClass: 'reasoning'
	}];
}

export function createDefaultAiActionRegistry(): AiActionRegistry {
	const registry = new AiActionRegistry();
	registry.register(createConsistencyReviewAction());
	for (const action of createCharacterAiActions()) registry.register(action);
	for (const action of createRelationshipAiActions()) registry.register(action);
	for (const action of createWorldAiActions()) registry.register(action);
	for (const action of createItemAiActions()) registry.register(action);
	for (const action of createTimelineAiActions()) registry.register(action);
	for (const action of createPlotAiActions()) registry.register(action);
	for (const action of createGateGAiActions()) registry.register(action);
	return registry;
}
