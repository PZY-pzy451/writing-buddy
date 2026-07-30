import type { TextFile } from '@writing-buddy/domain';
import type { AtomicWriteResult } from '@writing-buddy/platform-ports';
import { describe, expect, it } from 'vitest';
import {
	CreationJourneyStore,
	type CreationJourneyStorageGateway
} from './CreationJourneyStore';
import {
	createCreationJourneyState,
	parseCreationJourneyState,
	updateStoryElement
} from './CreationJourneyModel';

class MemoryGateway implements CreationJourneyStorageGateway {
	file?: TextFile;
	writes = 0;

	readCreationJourneyState(): Promise<TextFile | undefined> {
		return Promise.resolve(this.file);
	}

	writeCreationJourneyState(
		_projectRoot: string,
		content: string,
		expectedHash: string
	): Promise<AtomicWriteResult> {
		if ((this.file?.hash ?? '') !== expectedHash) {
			throw new Error('externalChange');
		}
		this.writes += 1;
		this.file = {
			content,
			hash: `hash-${this.writes}`,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		};
		return Promise.resolve({
			hash: this.file.hash,
			byteLength: content.length,
			modifiedAt: '2026-07-30T01:02:03.000Z'
		});
	}
}

describe('CreationJourneyStore', () => {
	it('loads a missing journey as a clean project-owned ideas route', async () => {
		const store = new CreationJourneyStore(
			'D:/Novel',
			'novel-001',
			new MemoryGateway(),
			() => '2026-07-30T01:02:03.000Z'
		);

		const loaded = await store.load();

		expect(loaded.hash).toBe('');
		expect(loaded.state).toMatchObject({
			projectId: 'novel-001',
			startRoute: 'ideas',
			stage: 'elements'
		});
		expect(loaded.state.elements).toHaveLength(3);
	});

	it('writes with the current hash and preserves the next hash', async () => {
		const gateway = new MemoryGateway();
		const store = new CreationJourneyStore('D:/Novel', 'novel-001', gateway);
		const loaded = await store.load();
		const edited = updateStoryElement(
			loaded.state,
			loaded.state.elements[0].id,
			{ text: '旧车站玻璃顶' }
		);
		const saved = await store.save(loaded, edited);

		expect(saved.hash).toBe('hash-1');
		expect(gateway.writes).toBe(1);
		expect(saved.state.elements[0]?.text).toBe('旧车站玻璃顶');
	});

	it('loads version 1 as version 2 and saves through the original expected hash', async () => {
		const gateway = new MemoryGateway();
		const current = createCreationJourneyState('novel-001', {
			now: () => '2026-07-30T01:02:03.000Z'
		});
		const legacy = { ...current } as Record<string, unknown>;
		delete legacy.guidance;
		delete legacy.locks;
		delete legacy.impacts;
		gateway.file = {
			content: JSON.stringify({ ...legacy, schemaVersion: 1 }),
			hash: 'legacy-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		};
		const store = new CreationJourneyStore('D:/Novel', 'novel-001', gateway);

		const loaded = await store.load();
		const saved = await store.save(loaded, loaded.state);

		expect(loaded.hash).toBe('legacy-hash');
		expect(loaded.state.schemaVersion).toBe(2);
		expect(saved.hash).toBe('hash-1');
		expect(parseCreationJourneyState(gateway.file.content).schemaVersion).toBe(2);
	});

	it('rejects a foreign project and does not overwrite concurrent work', async () => {
		const gateway = new MemoryGateway();
		const store = new CreationJourneyStore('D:/Novel', 'novel-001', gateway);
		const loaded = await store.load();

		await expect(store.save(loaded, {
			...loaded.state,
			projectId: 'novel-foreign'
		})).rejects.toThrow('creationJourneyProjectMismatch');

		gateway.file = {
			content: '{}',
			hash: 'other-writer',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		};
		await expect(store.save(loaded, loaded.state)).rejects.toThrow('externalChange');
	});

	it('fails safely for a corrupt or foreign-project persisted document', async () => {
		const corrupt = new MemoryGateway();
		corrupt.file = {
			content: '{"schemaVersion":1}',
			hash: 'bad',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		};
		await expect(new CreationJourneyStore('D:/Novel', 'novel-001', corrupt).load())
			.rejects.toThrow('creationJourneyStateInvalid');

		const foreign = new MemoryGateway();
		const first = new CreationJourneyStore('D:/Novel', 'novel-other', foreign);
		const loaded = await first.load();
		await first.save(loaded, loaded.state);
		await expect(new CreationJourneyStore('D:/Novel', 'novel-001', foreign).load())
			.rejects.toThrow('creationJourneyProjectMismatch');
	});
});
