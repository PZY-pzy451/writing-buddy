import { describe, expect, it } from 'vitest';
import { parseStoryInformation } from '../model/StoryInformation';
import { runInformationRules } from './informationRules';

describe('information rules', () => {
	it('reports a reveal placed before the truth becomes effective', () => {
		const fact = parseStoryInformation({
			id: 'information:clock',
			type: 'information',
			title: '停摆的钟',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: '2026-07-27T00:00:00.000Z',
			updatedAt: '2026-07-27T00:00:00.000Z',
			revision: 0,
			truthStatement: '钟在午夜被人为停下。',
			truthStatus: 'confirmed',
			authorSecret: true,
			truthEffectiveFrom: { chapterId: 'chapter:three', narrativeOrder: 8 },
			readerRevealAt: { chapterId: 'chapter:one', narrativeOrder: 2 }
		});
		expect(runInformationRules([fact])[0]?.ruleId).toBe('information.premature-reveal');
		expect(fact.excludeFromAiByDefault).toBe(true);
	});
});
