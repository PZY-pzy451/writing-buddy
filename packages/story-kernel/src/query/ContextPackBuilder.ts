import {
	estimateContextTokens,
	TokenBudgetPolicy,
	type ContextPriority
} from './TokenBudgetPolicy';

export type ContextItemKind =
	| 'instruction'
	| 'selection'
	| 'scene'
	| 'character'
	| 'location'
	| 'item'
	| 'world-rule'
	| 'plot-thread'
	| 'foreshadowing'
	| 'information'
	| 'adjacent-summary';

export interface ContextPackCandidate {
	readonly id: string;
	readonly priority: Exclude<ContextPriority, 'P0' | 'P1'>;
	readonly kind: Exclude<ContextItemKind, 'instruction' | 'selection'>;
	readonly title: string;
	readonly content: string;
	readonly resourceId?: string;
	readonly authorSecret?: boolean;
}

export interface ContextPackRequest {
	readonly actionType: 'polish' | 'concise' | 'grammar' | 'dialogue' | 'pacing';
	readonly instruction: string;
	readonly selection: {
		readonly text: string;
		readonly resourceId: string;
		readonly revision: number;
		readonly start: number;
		readonly end: number;
	};
	readonly candidates: readonly ContextPackCandidate[];
	readonly budgetTokens: number;
}

export interface ContextPackItem {
	readonly id: string;
	readonly priority: ContextPriority;
	readonly kind: ContextItemKind;
	readonly title: string;
	readonly content: string;
	readonly resourceId?: string;
	readonly required: boolean;
	readonly included: boolean;
	readonly estimatedTokens: number;
	readonly authorSecret: boolean;
	readonly excludedReason?: 'author-secret' | 'token-budget';
}

export interface ContextPack {
	readonly id: string;
	readonly actionType: ContextPackRequest['actionType'];
	readonly source: ContextPackRequest['selection'];
	readonly budgetTokens: number;
	readonly estimatedTokens: number;
	readonly items: readonly ContextPackItem[];
}

export interface ContextPackBuilder {
	build(request: ContextPackRequest): Promise<ContextPack>;
}

function normalizeContent(value: string, maximum: number): string {
	const normalized = value.trim().replaceAll(/\r\n?/gu, '\n');
	if (!normalized || normalized.length > maximum) {
		throw new Error(normalized ? 'contextItemTooLarge' : 'emptyContextItem');
	}
	return normalized;
}

function itemKey(candidate: ContextPackCandidate): string {
	return candidate.resourceId
		? `${candidate.kind}:${candidate.resourceId}`
		: `${candidate.kind}:${candidate.content.trim().toLocaleLowerCase()}`;
}

export function buildContextPack(request: ContextPackRequest): ContextPack {
	const instruction = normalizeContent(request.instruction, 1_000);
	const selection = normalizeContent(request.selection.text, 12_000);
	if (
		!request.selection.resourceId
		|| request.selection.start < 0
		|| request.selection.end <= request.selection.start
		|| request.selection.revision < 0
	) {
		throw new Error('invalidContextSelection');
	}
	const items: ContextPackItem[] = [{
		id: 'context:instruction',
		priority: 'P0',
		kind: 'instruction',
		title: '作者指令',
		content: instruction,
		required: true,
		included: true,
		estimatedTokens: estimateContextTokens(instruction),
		authorSecret: false
	}, {
		id: 'context:selection',
		priority: 'P1',
		kind: 'selection',
		title: '当前选区',
		content: selection,
		resourceId: request.selection.resourceId,
		required: true,
		included: true,
		estimatedTokens: estimateContextTokens(selection),
		authorSecret: false
	}];
	const seen = new Set<string>();
	for (const candidate of request.candidates) {
		const key = itemKey(candidate);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		const content = normalizeContent(candidate.content, candidate.kind === 'adjacent-summary' ? 1_200 : 4_000);
		const authorSecret = candidate.authorSecret ?? false;
		items.push({
			id: candidate.id,
			priority: candidate.priority,
			kind: candidate.kind,
			title: normalizeContent(candidate.title, 160),
			content,
			...(candidate.resourceId ? { resourceId: candidate.resourceId } : {}),
			required: false,
			included: !authorSecret,
			estimatedTokens: estimateContextTokens(content),
			authorSecret,
			...(authorSecret ? { excludedReason: 'author-secret' as const } : {})
		});
	}
	const ordered = items
		.map((item, index) => ({ item, index }))
		.sort((left, right) => (
			left.item.priority.localeCompare(right.item.priority)
			|| left.index - right.index
		))
		.map(entry => entry.item);
	const trimmed = new TokenBudgetPolicy(request.budgetTokens).trim(ordered);
	return {
		id: `context-pack:${request.selection.resourceId}:${request.selection.revision}:${request.selection.start}-${request.selection.end}`,
		actionType: request.actionType,
		source: { ...request.selection, text: selection },
		budgetTokens: request.budgetTokens,
		estimatedTokens: trimmed
			.filter(item => item.included)
			.reduce((sum, item) => sum + item.estimatedTokens, 0),
		items: trimmed
	};
}

export class DeterministicContextPackBuilder implements ContextPackBuilder {
	build(request: ContextPackRequest): Promise<ContextPack> {
		return Promise.resolve(buildContextPack(request));
	}
}

export function withContextItemIncluded(
	pack: ContextPack,
	itemId: string,
	included: boolean
): ContextPack {
	const items = pack.items.map(item => item.id === itemId && !item.required
		? { ...item, included, excludedReason: included ? undefined : item.excludedReason }
		: item);
	return {
		...pack,
		items,
		estimatedTokens: items
			.filter(item => item.included)
			.reduce((sum, item) => sum + item.estimatedTokens, 0)
	};
}

export function serializeContextPackForAi(pack: ContextPack): string {
	const payload = {
		schemaVersion: 1,
		actionType: pack.actionType,
		context: pack.items
			.filter(item => item.included)
			.map(item => ({
				priority: item.priority,
				kind: item.kind,
				title: item.title,
				content: item.content
			}))
	};
	return JSON.stringify(payload);
}
