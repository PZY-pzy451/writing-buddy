import { createStoryId, parseEvidenceRef, parseStoryPosition } from '@writing-buddy/story-kernel';
import { describe, expect, it } from 'vitest';
import type { AtomicWriteRequest } from '@writing-buddy/platform-ports';
import type { TextFile } from '@writing-buddy/domain';
import {
	PENDING_FACTS_PATH,
	PendingFactStore,
	StoryExtractionService,
	type PendingFactStoragePort
} from './StoryExtractionService';

class MemoryStorage implements PendingFactStoragePort {
	private content: string | undefined;
	private hash = '';

	readText(): Promise<TextFile> {
		if (this.content === undefined) return Promise.reject(new Error('readFailed'));
		return Promise.resolve({
			content: this.content,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false,
			hash: this.hash
		});
	}

	writeTextAtomic(request: AtomicWriteRequest) {
		if (request.expectedHash !== this.hash) return Promise.reject(new Error('externalChange'));
		this.content = request.content;
		this.hash = `hash-${request.content.length}`;
		return Promise.resolve({
			hash: this.hash,
			byteLength: request.content.length,
			modifiedAt: new Date().toISOString()
		});
	}
}

describe('StoryExtractionService', () => {
	it('validates, anchors and persists extracted facts without auto-confirming them', async () => {
		const storage = new MemoryStorage();
		const store = new PendingFactStore('D:\\novel', storage);
		const service = new StoryExtractionService(store);
		const content = '沈青把铜钥匙交给林越。';
		const facts = await service.stageFromResponse({
			resourceId: 'chapter:one',
			sourceRevision: '7',
			content,
			response: JSON.stringify({
				facts: [{
					factType: 'item-state',
					title: '铜钥匙转移',
					statement: '铜钥匙由沈青交给林越。',
					confidence: 0.98,
					start: 0,
					end: content.length,
					quote: content
				}]
			})
		});

		expect(facts).toHaveLength(1);
		expect(facts[0]?.status).toBe('pending');
		expect(facts[0]).not.toHaveProperty('evidence');
		expect(facts[0]).not.toHaveProperty('storyPosition');
		expect(PENDING_FACTS_PATH).toBe('.writing-buddy/ai/pending-facts/index.json');
		expect((await store.load())[0]?.status).toBe('pending');
	});

	it('drops candidates without unique manuscript evidence', async () => {
		const service = new StoryExtractionService(new PendingFactStore('D:\\novel', new MemoryStorage()));
		expect(await service.stageFromResponse({
			resourceId: 'chapter:one',
			sourceRevision: '7',
			content: '雨声。雨声。',
			response: JSON.stringify({
				facts: [{
					factType: 'story-information',
					title: '雨声',
					statement: '能够听见雨声。',
					confidence: 0.6,
					start: 99,
					end: 101,
					quote: '雨声'
				}]
			})
		})).toEqual([]);
	});

	it('requires author-confirmed Evidence and StoryPosition before acceptance', async () => {
		const store = new PendingFactStore('D:\\novel', new MemoryStorage());
		const service = new StoryExtractionService(store);
		const [fact] = await service.stageFromResponse({
			resourceId: 'chapter:one',
			sourceRevision: '7',
			content: '铜钥匙在林越手中。',
			response: JSON.stringify({
				facts: [{
					factType: 'item-state',
					title: '持有铜钥匙',
					statement: '林越持有铜钥匙。',
					confidence: 0.9,
					start: 0,
					end: 9,
					quote: '铜钥匙在林越手中。'
				}]
			})
		});
		if (!fact) throw new Error('fixtureFactMissing');
		const evidence = parseEvidenceRef({
			id: createStoryId('evidence'),
			origin: 'ai-extracted',
			resourceId: 'chapter:one',
			range: fact.suggestedRange,
			revisionId: '7',
			quotePreview: fact.suggestedQuote,
			confirmedByAuthor: true,
			confirmedAt: '2026-07-27T08:00:00.000Z'
		});
		const storyPosition = parseStoryPosition({
			chapterId: 'chapter:one',
			narrativeOrder: 3
		});
		const accepted = await service.accept({
			fact,
			title: fact.title,
			statement: fact.statement,
			evidence,
			storyPosition
		});
		expect(accepted).toMatchObject({
			status: 'accepted',
			evidence: { confirmedByAuthor: true },
			storyPosition: { narrativeOrder: 3 }
		});
	});
});
