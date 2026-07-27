import { describe, expect, it } from 'vitest';
import validResources from './fixtures/valid-resources.json';
import invalidResources from './fixtures/invalid-resources.json';
import { StoryPaths } from '../repository/StoryPaths';
import { StorySchemaRegistry } from './schemaRegistry';

const fixtureTypes = ['character', 'scene', 'relationship', 'timelineEvent', 'item'] as const;

describe('StorySchemaRegistry', () => {
	it.each(fixtureTypes)('parses the valid %s fixture', type => {
		const parsed = StorySchemaRegistry.parse(type, validResources[type]);
		expect(parsed.type).toBe(type);
		expect(parsed.schemaVersion).toBe(1);
	});

	it.each(fixtureTypes)('rejects the invalid %s fixture', type => {
		expect(() => StorySchemaRegistry.parse(type, invalidResources[type])).toThrow();
	});

	it('rejects mismatched types and unknown fields instead of silently drifting', () => {
		expect(() => StorySchemaRegistry.parse('item', validResources.character)).toThrow();
		expect(() => StorySchemaRegistry.parse('character', {
			...validResources.character,
			futureField: 'must be explicitly versioned'
		})).toThrow();
	});
});

describe('StoryPaths', () => {
	it('maps resource identity to a portable project path', () => {
		expect(StoryPaths.forResource('', 'character', 'character:lin-yue'))
			.toBe('story/characters/character%3Alin-yue.json');
		expect(StoryPaths.forResource('D:\\Novel', 'timelineEvent', 'timeline-event:station-meeting'))
			.toBe('D:/Novel/story/events/timeline-event%3Astation-meeting.json');
	});

	it('rejects traversal, separators, absolute IDs and Windows reserved names', () => {
		expect(() => StoryPaths.forResource('D:/Novel/../Other', 'item', 'item:key')).toThrow('unsafeStoryRoot');
		expect(() => StoryPaths.forResource('', 'item', 'item:../key')).toThrow('invalidStoryId');
		expect(() => StoryPaths.forResource('', 'item', '/item:key')).toThrow('invalidStoryId');
		expect(() => StoryPaths.forResource('', 'character', 'character:CON')).toThrow('reservedStoryId');
	});
});
