import { describe, expect, it } from 'vitest';
import { findLocationHierarchyCycles, parseLocation } from './Location';

const timestamp = '2026-07-27T00:00:00.000Z';

function location(id: string, parentLocationId?: string) {
	return parseLocation({
		id,
		type: 'location',
		title: id,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 0,
		...(parentLocationId ? { parentLocationId } : {}),
		travelLinks: [],
		factionIds: [],
		rules: [],
		evidenceIds: []
	});
}

describe('Location', () => {
	it('finds cycles without reporting ordinary parent chains', () => {
		const root = location('location:city');
		const district = location('location:district', root.id);
		const station = location('location:station', district.id);
		expect(findLocationHierarchyCycles([root, district, station])).toEqual([]);

		const first = location('location:first', 'location:second');
		const second = location('location:second', 'location:first');
		expect(findLocationHierarchyCycles([first, second])).toEqual([
			['location:first', 'location:second']
		]);
	});

	it('rejects self-links and non-positive travel times', () => {
		const input = {
			id: 'location:station',
			type: 'location' as const,
			title: '车站',
			aliases: [],
			tags: [],
			schemaVersion: 1 as const,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			factionIds: [],
			rules: [],
			evidenceIds: []
		};
		expect(() => parseLocation({
			...input,
			travelLinks: [{ targetLocationId: input.id, minimumMinutes: 10 }]
		})).toThrow('invalidLocationTravelLink');
		expect(() => parseLocation({
			...input,
			travelLinks: [{ targetLocationId: 'location:hotel', minimumMinutes: 0 }]
		})).toThrow('invalidLocationTravelLink');
	});
});
