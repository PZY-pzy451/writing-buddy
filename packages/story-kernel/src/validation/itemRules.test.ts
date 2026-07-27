import { describe, expect, it } from 'vitest';
import { parseItemState } from '../model/ItemState';
import { parseStoryItem } from '../model/StoryItem';
import { runItemRules } from './itemRules';

const timestamp = '2026-07-27T00:00:00.000Z';
const item = parseStoryItem({
	id: 'item:black-notebook', type: 'item', title: '黑色笔记本', aliases: [], tags: [],
	schemaVersion: 1, createdAt: timestamp, updatedAt: timestamp, revision: 0,
	unique: true, restrictions: [], evidenceIds: []
});
const state = (id: string, holder: string, quantity: number, order = 1, action = 'transferred') => parseItemState({
	id, itemId: item.id, action, quantity, holderCharacterId: holder,
	effectiveFrom: { chapterId: 'chapter:chapter-001', narrativeOrder: order },
	evidenceIds: [`evidence:${id.split(':')[1]}`], confirmation: 'confirmed', revision: 0
});

describe('item rules', () => {
	it('detects negative quantity and overlapping unique holders', () => {
		const issues = runItemRules([item], [
			state('item-state:lin', 'character:lin', 1),
			state('item-state:shen', 'character:shen', 1),
			state('item-state:negative', 'character:lin', -1, 2, 'adjusted')
		]);
		expect(issues.map(issue => issue.ruleId)).toEqual(expect.arrayContaining([
			'item.negative-quantity',
			'item.unique-multiple-holders',
			'item.transfer-overlap'
		]));
		expect(issues.find(issue => issue.ruleId === 'item.unique-multiple-holders')?.evidence).toHaveLength(2);
	});
});
