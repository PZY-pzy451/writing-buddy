import type { TextFile } from '@writing-buddy/domain';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import {
	DesktopStoryRepository,
	type StorySaveEntry,
	type StoryStorageGateway
} from '@writing-buddy/story-kernel';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoryKernelGeneratorPanel } from './StoryKernelGeneratorPanel';
import {
	StoryKernelGenerationStore,
	type StoryKernelGenerationStoragePort
} from './StoryKernelGenerationService';

class MemoryStorage implements StoryKernelGenerationStoragePort {
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

	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		this.content = request.content;
		this.hash = `hash-${request.content.length}`;
		return Promise.resolve({
			hash: this.hash,
			byteLength: request.content.length,
			modifiedAt: '2026-07-27T08:00:00.000Z'
		});
	}
}

class MemoryStoryGateway implements StoryStorageGateway {
	readonly resources = new Map<string, unknown>();

	constructor(private readonly events: string[]) {}

	private key(type: string, id: string): string {
		return `${type}:${id}`;
	}

	getStoryResource(_root: string, type: string, id: string): Promise<unknown> {
		return Promise.resolve(this.resources.get(this.key(type, id)));
	}

	listStoryResources(_root: string, type: string): Promise<readonly unknown[]> {
		return Promise.resolve([...this.resources.entries()]
			.filter(([key]) => key.startsWith(`${type}:`))
			.map(([, value]) => value));
	}

	saveStoryResources(
		_root: string,
		entries: readonly StorySaveEntry[]
	): Promise<readonly unknown[]> {
		this.events.push('commit');
		const saved = entries.map(entry => {
			const resource = entry.resource as {
				readonly type: string;
				readonly id: string;
				readonly revision: number;
			};
			const value = { ...resource, revision: resource.revision + 1 };
			this.resources.set(this.key(resource.type, resource.id), value);
			return value;
		});
		return Promise.resolve(saved);
	}

	moveStoryResourceToTrash(): Promise<void> {
		return Promise.resolve();
	}

	restoreStoryResourceFromTrash(): Promise<unknown> {
		return Promise.reject(new Error('storyTrashNotFound'));
	}
}

describe('StoryKernelGeneratorPanel', () => {
	it('keeps generated resources pending until snapshot-backed author confirmation', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const store = new StoryKernelGenerationStore('D:/Novel', new MemoryStorage());
		const onCommitted = vi.fn();
		const response = JSON.stringify({
			candidates: [{
				operation: 'create',
				resource: {
					id: 'character:lin-yue-ui',
					type: 'character',
					title: '林越',
					aliases: [],
					tags: [],
					evidenceIds: [],
					role: 'protagonist',
					factionIds: [],
					goals: [],
					desires: [],
					fears: [],
					values: [],
					secrets: []
				},
				confidence: 0.97,
				rationale: '正文明确出现人物。',
				evidence: { start: 0, end: 2, quote: '林越' }
			}]
		});

		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="林越走进车站。"
				repository={repository}
				store={store}
				runGeneration={(_messages, onProgress) => {
					onProgress('streaming', response);
					return Promise.resolve(response);
				}}
				createSafetySnapshot={() => {
					events.push('snapshot');
					return Promise.resolve('snapshot:test');
				}}
				onCommitted={onCommitted}
			/>
		);

		const generate = screen.getByRole('button', { name: '生成 Story Kernel 候选' });
		await waitFor(() => expect(generate).toBeEnabled());
		fireEvent.click(generate);
		await waitFor(() => expect(
			screen.getByRole('checkbox', { name: '选择 林越' })
		).toBeInTheDocument());
		expect(gateway.resources.size).toBe(0);
		expect(screen.getByText('待确认')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/ }));
		await waitFor(() => expect(screen.getByText('已写入')).toBeInTheDocument());
		expect(events).toEqual(['snapshot', 'commit']);
		expect(gateway.resources.has('character:character:lin-yue-ui')).toBe(true);
		expect(onCommitted).toHaveBeenCalledOnce();
	});

	it('disables generation for a read-only project', () => {
		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel-read-only"
				resourceId="chapter-001"
				sourceRevision={3}
				content="林越走进车站。"
				readOnly
				repository={new DesktopStoryRepository(
					'D:/Novel-read-only',
					new MemoryStoryGateway([])
				)}
				store={new StoryKernelGenerationStore(
					'D:/Novel-read-only',
					new MemoryStorage()
				)}
			/>
		);

		expect(screen.getByRole('button', { name: '生成 Story Kernel 候选' })).toBeDisabled();
		expect(screen.getByText(/当前项目为只读模式/)).toBeInTheDocument();
	});
});
