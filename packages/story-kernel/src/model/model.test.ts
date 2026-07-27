import { describe, expect, it } from 'vitest';
import { createStoryId, parseStoryId } from '../ids/StoryId';
import { parseEvidenceRef } from './EvidenceRef';
import { parseStoryPosition } from './StoryPosition';
import { parseStoryResourceBase } from './StoryResourceBase';

describe('StoryId', () => {
	it('accepts one explicit prefix and rejects unsafe or duplicated prefixes', () => {
		expect(parseStoryId('character:lin-yue')).toBe('character:lin-yue');
		expect(() => parseStoryId('character:lin yue')).toThrow('invalidStoryId');
		expect(() => parseStoryId('character/lin-yue')).toThrow('invalidStoryId');
		expect(() => parseStoryId('character:character:lin-yue')).toThrow('invalidStoryId');
	});

	it('creates unique IDs with one validated prefix', () => {
		const first = createStoryId('scene');
		const second = createStoryId('scene');
		expect(first).toMatch(/^scene:[0-9a-f-]{36}$/);
		expect(second).not.toBe(first);
		expect(() => createStoryId('scene:duplicate')).toThrow('invalidStoryIdPrefix');
	});
});

describe('StoryPosition', () => {
	it('requires a non-negative integer narrative order', () => {
		expect(parseStoryPosition({
			chapterId: 'chapter:chapter-001',
			narrativeOrder: 0
		})).toEqual({
			chapterId: 'chapter:chapter-001',
			narrativeOrder: 0
		});
		expect(() => parseStoryPosition({
			chapterId: 'chapter:chapter-001',
			narrativeOrder: -1
		})).toThrow('invalidNarrativeOrder');
		expect(() => parseStoryPosition({
			chapterId: 'chapter:chapter-001',
			narrativeOrder: 1.5
		})).toThrow('invalidNarrativeOrder');
	});
});

describe('EvidenceRef', () => {
	it('requires a valid range and an author confirmation timestamp when confirmed', () => {
		expect(() => parseEvidenceRef({
			id: 'evidence:rain-line',
			origin: 'manuscript',
			resourceId: 'chapter:chapter-001',
			range: { start: 8, end: 4 },
			confirmedByAuthor: false
		})).toThrow('invalidEvidenceRange');
		expect(() => parseEvidenceRef({
			id: 'evidence:rain-line',
			origin: 'author-entry',
			resourceId: 'chapter:chapter-001',
			confirmedByAuthor: true
		})).toThrow('missingConfirmationTime');
	});
});

describe('StoryResourceBase', () => {
	it('accepts canonical UTC timestamps and rejects invalid revisions', () => {
		const resource = parseStoryResourceBase({
			id: 'character:lin-yue',
			type: 'character',
			title: '林越',
			aliases: [],
			tags: ['主角'],
			schemaVersion: 1,
			createdAt: '2026-07-27T00:00:00.000Z',
			updatedAt: '2026-07-27T00:00:00.000Z',
			revision: 0
		});
		expect(resource.title).toBe('林越');
		expect(() => parseStoryResourceBase({ ...resource, revision: -1 })).toThrow('invalidRevision');
		expect(() => parseStoryResourceBase({
			...resource,
			updatedAt: '2026-07-27T08:00:00+08:00'
		})).toThrow('invalidUtcTimestamp');
	});
});
