import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export const worldRuleCategories = [
	'culture',
	'religion',
	'technology',
	'magic',
	'law',
	'other'
] as const;

export type WorldRuleCategory = typeof worldRuleCategories[number];

export interface WorldRule extends StoryResourceBase {
	readonly type: 'worldRule';
	readonly category: WorldRuleCategory;
	readonly statement: string;
	readonly scope?: string;
	readonly exceptions: readonly string[];
	readonly consequences: readonly string[];
	readonly effectiveFrom?: StoryPosition;
	readonly evidenceIds: readonly StoryId[];
}

type WorldRuleInput = Omit<
	WorldRule,
	'id' | 'category' | 'statement' | 'scope' | 'exceptions' | 'consequences' | 'effectiveFrom' | 'evidenceIds'
> & {
	readonly id: string;
	readonly category?: string;
	readonly statement?: string;
	readonly scope?: string;
	readonly exceptions?: readonly string[];
	readonly consequences?: readonly string[];
	readonly effectiveFrom?: Parameters<typeof parseStoryPosition>[0];
	readonly evidenceIds?: readonly string[];
};

function isWorldRuleCategory(value: string): value is WorldRuleCategory {
	return worldRuleCategories.some(category => category === value);
}

export function parseWorldRule(value: WorldRuleInput): WorldRule {
	const base = parseStoryResourceBase(value);
	const category = value.category ?? 'other';
	if (!isWorldRuleCategory(category)) {
		throw new Error('invalidWorldRuleCategory');
	}
	const statement = value.statement?.trim() || value.summary?.trim() || value.title;
	return {
		...base,
		type: 'worldRule',
		category,
		statement,
		...(value.scope?.trim() ? { scope: value.scope.trim() } : {}),
		exceptions: [...(value.exceptions ?? [])],
		consequences: [...(value.consequences ?? [])],
		...(value.effectiveFrom ? { effectiveFrom: parseStoryPosition(value.effectiveFrom) } : {}),
		evidenceIds: (value.evidenceIds ?? []).map(parseStoryId)
	};
}
