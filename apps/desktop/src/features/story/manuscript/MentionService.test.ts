import { describe, expect, it } from 'vitest';
import {
	parseMentionLink,
	parseStoryId,
	type MentionLink,
	type MentionSaveEntry,
	type MentionStorageGateway
} from '@writing-buddy/story-kernel';
import { EditTransactionService } from '@writing-buddy/project';
import { MentionService } from './MentionService';

class MentionMemoryGateway implements MentionStorageGateway {
	readonly mentions = new Map<string, MentionLink>();
	saveCalls = 0;

	listMentionLinks(): Promise<readonly unknown[]> {
		return Promise.resolve([...this.mentions.values()]);
	}

	saveMentionLinks(
		_projectRoot: string,
		entries: readonly MentionSaveEntry[]
	): Promise<readonly unknown[]> {
		this.saveCalls += 1;
		const staged = entries.map(entry => {
			const mention = parseMentionLink(entry.mention);
			const current = this.mentions.get(mention.id);
			const actualRevision = current?.revision ?? 0;
			const expectedRevision = entry.expectedRevision ?? mention.revision;
			if (actualRevision !== expectedRevision) {
				throw new Error(`mentionRevisionConflict:${actualRevision}`);
			}
			return {
				...mention,
				revision: actualRevision + 1,
				updatedAt: '2026-07-27T00:01:00.000Z'
			};
		});
		for (const mention of staged) {
			this.mentions.set(mention.id, mention);
		}
		return Promise.resolve(staged);
	}
}

function mentionFixture(overrides: Partial<MentionLink> = {}): MentionLink {
	return parseMentionLink({
		id: 'mention:lin-yue-intro',
		resourceId: 'character:lin-yue',
		chapterId: 'chapter:chapter-001',
		anchor: {
			start: 2,
			end: 4,
			revision: 0,
			quote: '林越',
			before: '夜里',
			after: '走进车站'
		},
		displayText: '林越',
		status: 'active',
		revision: 0,
		createdAt: '2026-07-27T00:00:00.000Z',
		updatedAt: '2026-07-27T00:00:00.000Z',
		...overrides
	});
}

describe('MentionService', () => {
	it('persists a selection outside Markdown without changing manuscript bytes', async () => {
		const gateway = new MentionMemoryGateway();
		const service = new MentionService(
			'D:/Novel',
			gateway,
			() => 'mention:new-link',
			() => '2026-07-27T00:00:00.000Z'
		);
		const manuscript = '夜里林越走进车站。';
		const before = new TextEncoder().encode(manuscript);
		const history = new EditTransactionService();
		history.apply('chapter-001', manuscript, `${manuscript}雨还在下。`);

		const mention = await service.linkSelection({
			resourceId: 'character:lin-yue',
			chapterId: 'chapter:chapter-001',
			manuscript,
			start: 2,
			end: 4,
			textRevision: 0
		});

		expect(mention).toMatchObject({
			id: 'mention:new-link',
			displayText: '林越',
			status: 'active',
			anchor: { start: 2, end: 4, quote: '林越' }
		});
		expect(new TextEncoder().encode(manuscript)).toEqual(before);
		expect(gateway.saveCalls).toBe(1);
		expect(history.undo(`${manuscript}雨还在下。`)?.content).toBe(manuscript);
		expect(gateway.mentions.size).toBe(1);
	});

	it('rebases a mention when its quote has one unambiguous new position', async () => {
		const gateway = new MentionMemoryGateway();
		gateway.mentions.set('mention:lin-yue-intro', mentionFixture());
		const service = new MentionService('D:/Novel', gateway);

		const [rebased] = await service.rebaseMentions(
			'chapter:chapter-001',
			'序章。夜里林越走进车站。',
			1
		);

		expect(rebased).toMatchObject({
			status: 'active',
			anchor: { start: 5, end: 7, revision: 1, quote: '林越' }
		});
	});

	it('marks deleted or ambiguous anchors stale instead of silently relinking', async () => {
		const ambiguousGateway = new MentionMemoryGateway();
		ambiguousGateway.mentions.set('mention:lin-yue-intro', mentionFixture());
		const ambiguousService = new MentionService('D:/Novel', ambiguousGateway);

		const [ambiguous] = await ambiguousService.rebaseMentions(
			'chapter:chapter-001',
			'林越走进车站，另一个林越留在门外。',
			2
		);
		expect(ambiguous?.status).toBe('stale');

		const deletedGateway = new MentionMemoryGateway();
		deletedGateway.mentions.set('mention:lin-yue-intro', mentionFixture());
		const deletedService = new MentionService('D:/Novel', deletedGateway);
		const [deleted] = await deletedService.rebaseMentions(
			'chapter:chapter-001',
			'夜里有人走进车站。',
			3
		);
		expect(deleted?.status).toBe('stale');
	});

	it('lists active and stale backlinks for a Story resource', async () => {
		const gateway = new MentionMemoryGateway();
		gateway.mentions.set('mention:lin-yue-intro', mentionFixture());
		gateway.mentions.set('mention:station', mentionFixture({
			id: parseStoryId('mention:station'),
			resourceId: parseStoryId('location:old-station')
		}));
		const service = new MentionService('D:/Novel', gateway);

		const backlinks = await service.listBacklinks('character:lin-yue');

		expect(backlinks).toHaveLength(1);
		expect(backlinks[0]?.displayText).toBe('林越');
	});
});
