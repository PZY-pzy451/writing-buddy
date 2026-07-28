import {
	estimateContextTokens,
	type ContextPack as StoryKernelContextPack
} from '@writing-buddy/story-kernel';
import type {
	AiActionDefinition,
	AiContextKind
} from '../action/AiActionDefinition';
import {
	listAiContextRecords,
	type AiContextExclusion,
	type AiContextPack,
	type AiContextRecord,
	type AiContextSelection
} from './AiContextPack';

export interface AiContextSourceRecord {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly authorSecret?: boolean;
}

export interface AiContextSourceSelection extends AiContextSourceRecord {
	readonly start: number;
	readonly end: number;
}

export interface AiContextScopeData {
	readonly project?: AiContextSourceRecord;
	readonly currentResource?: AiContextSourceRecord;
	readonly selection?: AiContextSourceSelection;
	readonly scene?: AiContextSourceRecord;
	readonly entities?: readonly AiContextSourceRecord[];
	readonly events?: readonly AiContextSourceRecord[];
	readonly plotThreads?: readonly AiContextSourceRecord[];
	readonly foreshadowing?: readonly AiContextSourceRecord[];
	readonly worldRules?: readonly AiContextSourceRecord[];
	readonly knowledgeRules?: readonly AiContextSourceRecord[];
	readonly styleProfile?: AiContextSourceRecord;
}

const contextKindLabels: Readonly<Record<AiContextKind, string>> = {
	project: '当前作品',
	'current-resource': '当前资料',
	selection: '当前选区',
	scene: '当前场景',
	entity: '人物与实体',
	event: '相关事件',
	'plot-thread': '剧情线',
	foreshadowing: '伏笔',
	'world-rule': '世界规则',
	'knowledge-rule': '信息权限',
	'style-profile': '文风约束'
};

function sanitizeContextText(value: string, maximum: number): string {
	const normalized = value.trim().replaceAll(/\r\n?/gu, '\n');
	if (!normalized) {
		throw new Error('emptyAiContextValue');
	}
	if (normalized.length > maximum) {
		throw new Error('aiContextValueTooLarge');
	}
	return normalized
		.replaceAll(/\b[A-Za-z]:[\\/][^\s"'<>|]+/gu, '[本地路径已省略]')
		.replaceAll(/\b(?:sk|ds)-[A-Za-z0-9_-]{12,}\b/gu, '[密钥已省略]');
}

function createRecord(
	kind: AiContextKind,
	source: AiContextSourceRecord,
	required: boolean
): AiContextRecord {
	const summary = sanitizeContextText(source.summary, kind === 'current-resource' ? 100_000 : 12_000);
	const authorSecret = source.authorSecret ?? false;
	return {
		key: `${kind}:${source.id}`,
		kind,
		title: sanitizeContextText(source.title, 160),
		summary,
		resourceId: source.id,
		required,
		included: !authorSecret,
		authorSecret,
		tokenEstimate: estimateContextTokens(summary)
	};
}

function isRequested(
	action: AiActionDefinition,
	kind: AiContextKind
): { readonly requested: boolean; readonly required: boolean } {
	const required = action.contextPolicy.requiredKinds.includes(kind);
	return {
		required,
		requested: required || action.contextPolicy.optionalKinds.includes(kind)
	};
}

export function buildAiContextPack(
	action: AiActionDefinition,
	scope: AiContextScopeData
): AiContextPack {
	const exclusions: AiContextExclusion[] = [];
	const single = (
		kind: AiContextKind,
		source: AiContextSourceRecord | undefined
	): AiContextRecord | undefined => {
		const policy = isRequested(action, kind);
		if (!policy.requested) {
			if (source) {
				exclusions.push({
					key: `${kind}:${source.id}`,
					label: source.title,
					reason: 'policy-excluded'
				});
			}
			return undefined;
		}
		if (!source) {
			exclusions.push({
				key: `${kind}:missing`,
				label: contextKindLabels[kind],
				reason: 'missing-source'
			});
			return undefined;
		}
		const record = createRecord(kind, source, policy.required);
		if (record.authorSecret) {
			exclusions.push({
				key: record.key,
				label: record.title,
				reason: 'author-secret'
			});
		}
		return record;
	};
	const many = (
		kind: AiContextKind,
		sources: readonly AiContextSourceRecord[] | undefined
	): readonly AiContextRecord[] => {
		const policy = isRequested(action, kind);
		if (!policy.requested) {
			return [];
		}
		if (!sources || sources.length === 0) {
			exclusions.push({
				key: `${kind}:missing`,
				label: contextKindLabels[kind],
				reason: 'missing-source'
			});
			return [];
		}
		return sources.map(source => {
			const record = createRecord(kind, source, policy.required);
			if (record.authorSecret) {
				exclusions.push({
					key: record.key,
					label: record.title,
					reason: 'author-secret'
				});
			}
			return record;
		});
	};

	const selectionRecord = single('selection', scope.selection);
	const selection: AiContextSelection | undefined = selectionRecord && scope.selection
		? {
			...selectionRecord,
			kind: 'selection',
			start: scope.selection.start,
			end: scope.selection.end
		}
		: undefined;
	let pack: AiContextPack = {
		actionId: action.id,
		project: single('project', scope.project),
		currentResource: single('current-resource', scope.currentResource),
		selection,
		scene: single('scene', scope.scene),
		entities: many('entity', scope.entities),
		events: many('event', scope.events),
		plotThreads: many('plot-thread', scope.plotThreads),
		foreshadowing: many('foreshadowing', scope.foreshadowing),
		worldRules: many('world-rule', scope.worldRules),
		knowledgeRules: many('knowledge-rule', scope.knowledgeRules),
		styleProfile: single('style-profile', scope.styleProfile),
		exclusions,
		tokenEstimate: 0,
		budgetTokens: action.contextPolicy.maximumTokens
	};
	const records = listAiContextRecords(pack);
	const requiredTokens = records
		.filter(record => record.required && record.included)
		.reduce((total, record) => total + record.tokenEstimate, 0);
	if (requiredTokens > pack.budgetTokens) {
		throw new Error('requiredAiContextExceedsBudget');
	}
	let used = requiredTokens;
	const includedKeys = new Set(records
		.filter(record => record.required && record.included)
		.map(record => record.key));
	for (const record of records.filter(item => !item.required && item.included)) {
		if (used + record.tokenEstimate <= pack.budgetTokens) {
			used += record.tokenEstimate;
			includedKeys.add(record.key);
		} else {
			exclusions.push({
				key: record.key,
				label: record.title,
				reason: 'token-budget'
			});
		}
	}
	const update = <T extends AiContextRecord | undefined>(record: T): T => (
		record
			? { ...record, included: includedKeys.has(record.key) }
			: record
	);
	const updateMany = (items: readonly AiContextRecord[]) => items.map(update);
	pack = {
		...pack,
		project: update(pack.project),
		currentResource: update(pack.currentResource),
		selection: update(pack.selection),
		scene: update(pack.scene),
		entities: updateMany(pack.entities),
		events: updateMany(pack.events),
		plotThreads: updateMany(pack.plotThreads),
		foreshadowing: updateMany(pack.foreshadowing),
		worldRules: updateMany(pack.worldRules),
		knowledgeRules: updateMany(pack.knowledgeRules),
		styleProfile: update(pack.styleProfile),
		exclusions,
		tokenEstimate: used
	};
	return pack;
}

export function withAiContextRecordIncluded(
	pack: AiContextPack,
	key: string,
	included: boolean
): AiContextPack {
	const current = listAiContextRecords(pack).find(record => record.key === key);
	if (!current || current.required) return pack;
	const nextEstimate = pack.tokenEstimate
		+ (included ? current.tokenEstimate : -current.tokenEstimate);
	if (nextEstimate > pack.budgetTokens) {
		throw new Error('aiContextTokenBudgetExceeded');
	}
	const update = <T extends AiContextRecord | undefined>(record: T): T => (
		record?.key === key ? { ...record, included } : record
	);
	const updateMany = (items: readonly AiContextRecord[]) => items.map(update);
	const exclusions = pack.exclusions
		.filter(exclusion => exclusion.key !== key);
	if (!included) {
		exclusions.push({
			key,
			label: current.title,
			reason: current.authorSecret ? 'author-secret' : 'user-excluded'
		});
	}
	return {
		...pack,
		project: update(pack.project),
		currentResource: update(pack.currentResource),
		selection: update(pack.selection),
		scene: update(pack.scene),
		entities: updateMany(pack.entities),
		events: updateMany(pack.events),
		plotThreads: updateMany(pack.plotThreads),
		foreshadowing: updateMany(pack.foreshadowing),
		worldRules: updateMany(pack.worldRules),
		knowledgeRules: updateMany(pack.knowledgeRules),
		styleProfile: update(pack.styleProfile),
		exclusions,
		tokenEstimate: nextEstimate
	};
}

export function serializeAiContextPackForAi(pack: AiContextPack): string {
	const context = listAiContextRecords(pack)
		.filter(record => record.included)
		.map(record => ({
			kind: record.kind,
			title: record.title,
			summary: record.summary,
			...(record.resourceId ? { resourceId: record.resourceId } : {})
		}));
	const serialized = JSON.stringify({
		schemaVersion: 1,
		actionId: pack.actionId,
		context
	});
	if (/projectRoot|apiKey|credential|absolutePath/iu.test(serialized)) {
		throw new Error('unsafeAiContextSerialization');
	}
	return serialized;
}

export function adaptStoryKernelContextPack(
	action: AiActionDefinition,
	project: AiContextSourceRecord,
	pack: StoryKernelContextPack
): AiContextPack {
	const sources = pack.items
		.filter(item => !['instruction', 'selection'].includes(item.kind))
		.map(item => ({
			id: item.resourceId ?? item.id,
			title: item.title,
			summary: item.content,
			authorSecret: item.authorSecret
		}));
	const byKind = (kinds: readonly string[]) => sources.filter((_, index) => (
		kinds.includes(pack.items
			.filter(item => !['instruction', 'selection'].includes(item.kind))[index]?.kind ?? '')
	));
	const instruction = pack.items.find(item => item.kind === 'instruction');
	const scene = pack.items.find(item => item.kind === 'scene');
	return buildAiContextPack(action, {
		project,
		currentResource: {
			id: pack.source.resourceId,
			title: '当前资料',
			summary: pack.source.text
		},
		selection: {
			id: `${pack.source.resourceId}:${pack.source.start}-${pack.source.end}`,
			title: '当前选区',
			summary: pack.source.text,
			start: pack.source.start,
			end: pack.source.end
		},
		...(scene ? {
			scene: {
				id: scene.resourceId ?? scene.id,
				title: scene.title,
				summary: scene.content,
				authorSecret: scene.authorSecret
			}
		} : {}),
		entities: byKind(['character', 'location', 'item']),
		plotThreads: byKind(['plot-thread']),
		foreshadowing: byKind(['foreshadowing']),
		worldRules: byKind(['world-rule']),
		knowledgeRules: byKind(['information']),
		...(instruction ? {
			styleProfile: {
				id: instruction.id,
				title: instruction.title,
				summary: instruction.content
			}
		} : {})
	});
}
