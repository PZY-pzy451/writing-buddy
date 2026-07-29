import { describe, expect, it } from 'vitest';
import type { TextFile } from '@writing-buddy/domain';
import type { AtomicWriteResult } from '@writing-buddy/platform-ports';
import {
	QuickCaptureStore,
	type QuickCaptureStorageGateway
} from './QuickCaptureStore';

class MemoryGateway implements QuickCaptureStorageGateway {
	file?: TextFile;
	writes = 0;

	readQuickCaptureState(): Promise<TextFile | undefined> {
		return Promise.resolve(this.file);
	}

	writeQuickCaptureState(
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
			modifiedAt: '2026-07-29T01:02:03.000Z'
		});
	}
}

describe('QuickCaptureStore', () => {
	it('loads a missing project inbox as an empty versioned collection', async () => {
		const store = new QuickCaptureStore('D:/Novel', new MemoryGateway());

		await expect(store.load()).resolves.toEqual({
			state: { schemaVersion: 1, captures: [] },
			hash: ''
		});
	});

	it('atomically appends and updates records with the current expected hash', async () => {
		const gateway = new MemoryGateway();
		const store = new QuickCaptureStore(
			'D:/Novel',
			gateway,
			() => 'capture:idea-001',
			() => '2026-07-29T01:02:03.000Z'
		);
		const empty = await store.load();
		const added = await store.add(empty, {
			projectId: 'novel-001',
			type: 'idea',
			text: '让玻璃顶在终章再次出现'
		});
		const updated = await store.setStatus(added, 'capture:idea-001', 'later');

		expect(updated.state.captures[0]?.status).toBe('later');
		expect(gateway.writes).toBe(2);
		expect(updated.hash).toBe('hash-2');
	});

	it('does not overwrite a concurrently changed inbox', async () => {
		const gateway = new MemoryGateway();
		const store = new QuickCaptureStore('D:/Novel', gateway);
		const loaded = await store.load();
		gateway.file = {
			content: '{"schemaVersion":1,"captures":[]}',
			hash: 'other-writer',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		};

		await expect(store.add(loaded, {
			projectId: 'novel-001',
			type: 'revision',
			text: '收紧开场'
		})).rejects.toThrow('externalChange');
	});
});
