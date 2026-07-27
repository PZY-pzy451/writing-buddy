import type { EditTransaction, EditTransactionService } from '@writing-buddy/project';
import {
	buildContextPack,
	getStateAt,
	parseForeshadowing,
	parseLocation,
	parsePlotThread,
	parseStoryInformation,
	parseStoryItem,
	parseStoryPosition,
	parseStoryScene,
	parseWorldRule,
	type Character,
	type ContextPack,
	type ContextPackCandidate,
	type ContextPackRequest,
	type StateRecord,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import type { AiUsage, SelectionRewriteResponse } from '@writing-buddy/ai';

export interface RewriteCandidate {
	readonly id: string;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly range: { readonly start: number; readonly end: number };
	readonly original: string;
	readonly suggestion: string;
	readonly rationale: string;
	readonly potentialImpact: string;
	readonly usage?: AiUsage;
	readonly createdAt: string;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface AppliedRewrite {
	readonly content: string;
	readonly replacement: string;
	readonly transaction: EditTransaction;
}

export function createRewriteCandidate(input: {
	readonly pack: ContextPack;
	readonly response: SelectionRewriteResponse;
	readonly usage?: AiUsage;
}): RewriteCandidate {
	if (!input.response.suggestion.trim()) {
		throw new Error('emptyRewriteCandidate');
	}
	return {
		id: `rewrite:${crypto.randomUUID()}`,
		resourceId: input.pack.source.resourceId,
		sourceRevision: input.pack.source.revision,
		range: { start: input.pack.source.start, end: input.pack.source.end },
		original: input.pack.source.text,
		suggestion: input.response.suggestion,
		rationale: input.response.rationale,
		potentialImpact: input.response.potentialImpact,
		...(input.usage ? { usage: input.usage } : {}),
		createdAt: new Date().toISOString(),
		status: 'candidate'
	};
}

export function isRewriteCandidateStale(
	candidate: RewriteCandidate,
	currentRevision: number,
	currentContent: string
): boolean {
	return currentRevision !== candidate.sourceRevision
		|| currentContent.slice(candidate.range.start, candidate.range.end) !== candidate.original;
}

export class SelectionRewriteService {
	constructor(private readonly edits: EditTransactionService) {}

	accept(
		candidate: RewriteCandidate,
		currentRevision: number,
		currentContent: string,
		replacement = candidate.suggestion
	): AppliedRewrite {
		if (candidate.status !== 'candidate' || isRewriteCandidateStale(candidate, currentRevision, currentContent)) {
			throw new Error('staleRewriteCandidate');
		}
		if (!replacement.trim()) {
			throw new Error('emptyRewriteReplacement');
		}
		const content = `${currentContent.slice(0, candidate.range.start)}${replacement}${currentContent.slice(candidate.range.end)}`;
		return {
			content,
			replacement,
			transaction: this.edits.apply(candidate.resourceId, currentContent, content)
		};
	}

	undo(currentContent: string): { readonly content: string; readonly transaction: EditTransaction } {
		const result = this.edits.undo(currentContent);
		if (!result) {
			throw new Error('rewriteUndoUnavailable');
		}
		return result;
	}
}

function joinParts(parts: readonly (string | undefined)[]): string {
	return parts.filter((part): part is string => Boolean(part?.trim())).join('\n');
}

const characterStateLabels: Readonly<Record<StateRecord['kind'], string>> = {
	location: '当前位置',
	lifeStatus: '生存状态',
	health: '伤势与健康',
	emotion: '当前情绪',
	currentGoal: '当前目标',
	inventory: '持有物品',
	knowledge: '已知信息',
	misconception: '误解信息',
	ability: '能力变化'
};

function stateValueLabel(value: StateRecord['value']): string {
	if (Array.isArray(value)) return value.length ? value.join('、') : '无';
	if (value === null) return '未知';
	if (typeof value === 'boolean') return value ? '是' : '否';
	return String(value);
}

function currentCharacterState(
	records: readonly StateRecord[],
	characterId: string,
	scene: ReturnType<typeof parseStoryScene>
): string | undefined {
	const snapshot = getStateAt(
		records.filter(record => record.characterId === characterId),
		parseStoryPosition({
			chapterId: scene.chapterId,
			sceneId: scene.id,
			narrativeOrder: scene.narrativeOrder
		})
	);
	const lines = Object.entries(snapshot).map(([kind, resolution]) => {
		const current = resolution.current;
		const confirmation = current.confirmation === 'confirmed' ? '作者已确认' : '待作者确认';
		const conflicts = resolution.conflicts.length
			? `；另有 ${resolution.conflicts.length} 条冲突状态`
			: '';
		return `${characterStateLabels[kind as StateRecord['kind']]}：${stateValueLabel(current.value)}（${confirmation}${conflicts}）`;
	});
	return lines.length
		? `当前场景状态（叙事序位 ${scene.narrativeOrder}）：\n${lines.join('\n')}`
		: undefined;
}

export async function loadGroundedContextCandidates(input: {
	readonly repository: StoryRepository;
	readonly chapterId: string;
	readonly selectionStart: number;
	readonly stateRecords?: readonly StateRecord[];
}): Promise<readonly ContextPackCandidate[]> {
	const [rawScenes, rawCharacters, rawLocations, rawItems, rawRules, rawPlots, rawForeshadowing, rawInformation] = await Promise.all([
		input.repository.list('scene'),
		input.repository.list('character'),
		input.repository.list('location'),
		input.repository.list('item'),
		input.repository.list('worldRule'),
		input.repository.list('plotThread'),
		input.repository.list('foreshadowing'),
		input.repository.list('information')
	]);
	const scenes = rawScenes.map(parseStoryScene);
	const scene = scenes.find(candidate => (
		candidate.chapterId === input.chapterId
		&& candidate.manuscriptRange.start <= input.selectionStart
		&& input.selectionStart < candidate.manuscriptRange.end
	));
	const characters = rawCharacters as unknown as readonly Character[];
	const locations = rawLocations.map(value => parseLocation(value as never));
	const items = rawItems.map(value => parseStoryItem(value as never));
	const rules = rawRules.map(value => parseWorldRule(value as never));
	const plots = rawPlots.map(value => parsePlotThread(value as never));
	const foreshadowing = rawForeshadowing.map(value => parseForeshadowing(value as never));
	const information = rawInformation.map(value => parseStoryInformation(value as never));
	const candidates: ContextPackCandidate[] = [];

	if (scene) {
		candidates.push({
			id: `context:${scene.id}`,
			priority: 'P2',
			kind: 'scene',
			title: scene.title,
			content: joinParts([
				scene.summary,
				scene.goal ? `目标：${scene.goal}` : undefined,
				scene.conflict ? `冲突：${scene.conflict}` : undefined,
				scene.turn ? `转折：${scene.turn}` : undefined,
				scene.outcome ? `结果：${scene.outcome}` : undefined
			]) || '当前选区位于此场景。',
			resourceId: scene.id
		});
	}
	for (const character of characters.filter(value => scene?.participantIds.includes(value.id) || scene?.povCharacterId === value.id)) {
		const dynamicState = scene
			? currentCharacterState(input.stateRecords ?? [], character.id, scene)
			: undefined;
		candidates.push({
			id: `context:${character.id}`,
			priority: 'P3',
			kind: 'character',
			title: character.title,
			content: joinParts([
				dynamicState,
				character.summary,
				character.goals.length ? `目标：${character.goals.join('；')}` : undefined,
				character.speechStyle ? `语言风格：${character.speechStyle}` : undefined
			]) || '场景相关人物。',
			resourceId: character.id
		});
	}
	for (const location of locations.filter(value => scene?.locationIds.includes(value.id))) {
		candidates.push({
			id: `context:${location.id}`,
			priority: 'P4',
			kind: 'location',
			title: location.title,
			content: joinParts([location.summary, location.rules.length ? `地点规则：${location.rules.join('；')}` : undefined]) || '当前场景地点。',
			resourceId: location.id
		});
	}
	for (const item of items.filter(value => value.plotFunction).slice(0, 5)) {
		candidates.push({
			id: `context:${item.id}`,
			priority: 'P4',
			kind: 'item',
			title: item.title,
			content: joinParts([item.description, item.plotFunction ? `剧情作用：${item.plotFunction}` : undefined]),
			resourceId: item.id
		});
	}
	for (const rule of rules.slice(0, 10)) {
		candidates.push({
			id: `context:${rule.id}`,
			priority: 'P4',
			kind: 'world-rule',
			title: rule.title,
			content: rule.statement,
			resourceId: rule.id
		});
	}
	for (const plot of plots.filter(value => scene?.plotThreadIds.includes(value.id) || ['active', 'at-risk'].includes(value.status))) {
		candidates.push({
			id: `context:${plot.id}`,
			priority: 'P5',
			kind: 'plot-thread',
			title: plot.title,
			content: joinParts([plot.premise, plot.stakes ? `风险：${plot.stakes}` : undefined]) || `状态：${plot.status}`,
			resourceId: plot.id
		});
	}
	for (const clue of foreshadowing.filter(value => scene?.foreshadowingIds.includes(value.id))) {
		candidates.push({
			id: `context:${clue.id}`,
			priority: 'P5',
			kind: 'foreshadowing',
			title: clue.title,
			content: clue.surfaceMeaning || `伏笔状态：${clue.status}`,
			resourceId: clue.id
		});
	}
	for (const fact of information.filter(value => scene?.revealInformationIds.includes(value.id))) {
		candidates.push({
			id: `context:${fact.id}`,
			priority: 'P5',
			kind: 'information',
			title: fact.title,
			content: fact.truthStatement,
			resourceId: fact.id,
			authorSecret: fact.excludeFromAiByDefault
		});
	}
	return candidates;
}

export function buildRewriteContextPack(input: Omit<ContextPackRequest, 'candidates'> & {
	readonly candidates: readonly ContextPackCandidate[];
}): ContextPack {
	return buildContextPack(input);
}
