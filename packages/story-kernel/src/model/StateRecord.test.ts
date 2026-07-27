import { describe, expect, it } from 'vitest';
import { parseStoryPosition } from './StoryPosition';
import {
	getStateAt,
	parseStateRecord,
	type StateRecord
} from './StateRecord';

const chapterOne = parseStoryPosition({
	chapterId: 'chapter:chapter-001',
	narrativeOrder: 0
});

function state(
	id: string,
	kind: StateRecord['kind'],
	value: StateRecord['value'],
	from: number,
	until?: number,
	confirmation: StateRecord['confirmation'] = 'confirmed'
): StateRecord {
	return parseStateRecord({
		id,
		characterId: 'character:lin-yue',
		kind,
		value,
		effectiveFrom: { ...chapterOne, narrativeOrder: from },
		...(until === undefined
			? {}
			: { effectiveUntil: { ...chapterOne, narrativeOrder: until } }),
		evidenceIds: [`evidence:${id.split(':')[1]}`],
		confirmation,
		revision: 0
	});
}

describe('character state history', () => {
	it('selects the latest applicable state and treats effectiveUntil as exclusive', () => {
		const records = [
			state('state:station', 'location', '旧车站', 2, 8),
			state('state:hotel', 'location', '临江旅社', 8),
			state('state:calm', 'emotion', '克制', 3)
		];

		expect(getStateAt(records, { ...chapterOne, narrativeOrder: 7 }).location?.current.value)
			.toBe('旧车站');
		expect(getStateAt(records, { ...chapterOne, narrativeOrder: 8 }).location?.current.value)
			.toBe('临江旅社');
		expect(getStateAt(records, { ...chapterOne, narrativeOrder: 8 }).emotion?.current.value)
			.toBe('克制');
	});

	it('keeps equally current conflicting facts visible instead of silently choosing one', () => {
		const records = [
			state('state:injured', 'health', '左臂受伤', 12),
			state('state:healthy', 'health', '未受伤', 12, undefined, 'pending')
		];

		const health = getStateAt(records, { ...chapterOne, narrativeOrder: 14 }).health;

		expect(health?.current.value).toBe('左臂受伤');
		expect(health?.conflicts.map(record => record.value)).toEqual(['未受伤']);
	});

	it('rejects an inverted state interval', () => {
		expect(() => state('state:invalid', 'location', '旧车站', 8, 3))
			.toThrow('invalidStateInterval');
	});
});
