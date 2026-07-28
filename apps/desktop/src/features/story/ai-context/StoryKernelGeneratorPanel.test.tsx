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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { toAiRequestError } from '../../ai/errors/AiErrorPresentation';
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

function generatedCharacterResponse(): string {
	return JSON.stringify({
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
}

function generatedSceneResponse(): string {
	return JSON.stringify({
		candidates: [{
			operation: 'create',
			resource: {
				id: 'scene:rainy-old-station-ui',
				type: 'scene',
				title: '夜雨旧站',
				aliases: [],
				tags: [],
				evidenceIds: [],
				locationIds: [],
				participantIds: [],
				itemIds: [],
				plotThreadIds: [],
				revealInformationIds: [],
				foreshadowingIds: []
			},
			confidence: 0.9,
			rationale: '正文描述了旧车站的夜雨场景。',
			evidence: { start: 99, end: 101, quote: '夜雨' }
		}]
	});
}

function generatedLocationResponse(): string {
	return JSON.stringify({
		candidates: [{
			operation: 'create',
			resource: {
				id: 'location:old-station-roof-ui',
				type: 'location',
				title: '旧车站玻璃顶',
				aliases: [],
				tags: [],
				evidenceIds: [],
				locationType: '车站构造',
				mapPoint: null,
				travelLinks: [],
				factionIds: [],
				rules: []
			},
			confidence: 0.9,
			rationale: '原文提及旧车站的玻璃顶。',
			evidence: { start: 3, end: 15, quote: '旧车站的玻璃顶' }
		}]
	});
}

describe('StoryKernelGeneratorPanel', () => {
	afterEach(() => {
		useAppStore.setState({ activeMode: 'works' });
	});

	it('applies a selection quick-action preset without starting a paid request', async () => {
		const runGeneration = vi.fn(() => Promise.resolve(''));
		const { rerender } = render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="林越走进车站。"
				selection={{ start: 0, end: 2, text: '林越' }}
				repository={new DesktopStoryRepository(
					'D:/Novel',
					new MemoryStoryGateway([])
				)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={runGeneration}
				preset={{
					id: 'intent-character',
					instruction: '从当前选区创建人物候选。',
					targetTypes: ['character']
				}}
			/>
		);

		expect(screen.getByDisplayValue('从当前选区创建人物候选。')).toBeInTheDocument();
		const checkboxes = screen.getAllByRole('checkbox');
		expect(checkboxes[0]).toBeChecked();
		for (const checkbox of checkboxes.slice(1)) {
			expect(checkbox).not.toBeChecked();
		}
		expect(runGeneration).not.toHaveBeenCalled();

		rerender(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="旧车站。"
				selection={{ start: 0, end: 3, text: '旧车站' }}
				repository={new DesktopStoryRepository(
					'D:/Novel',
					new MemoryStoryGateway([])
				)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={runGeneration}
				preset={{
					id: 'intent-location',
					instruction: '从当前选区创建地点候选。',
					targetTypes: ['location']
				}}
			/>
		);

		expect(await screen.findByDisplayValue('从当前选区创建地点候选。')).toBeInTheDocument();
		expect(runGeneration).not.toHaveBeenCalled();
	});

	it('keeps generated resources pending until snapshot-backed author confirmation', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const store = new StoryKernelGenerationStore('D:/Novel', new MemoryStorage());
		const onCommitted = vi.fn();
		const response = generatedCharacterResponse();

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

	it('explains local scene grounding and confirms a repaired scene candidate', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const response = generatedSceneResponse();

		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="夜雨落在旧车站的玻璃顶上。"
				repository={repository}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={(_messages, onProgress) => {
					onProgress('streaming', response);
					return Promise.resolve(response);
				}}
				createSafetySnapshot={() => {
					events.push('snapshot');
					return Promise.resolve('snapshot:test');
				}}
				preset={{
					id: 'scene-grounding',
					instruction: '从当前正文创建场景候选。',
					targetTypes: ['scene']
				}}
			/>
		);

		expect(screen.getByText(/场景候选的位置由本地绑定/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		const checkbox = await screen.findByRole('checkbox', { name: '选择 夜雨旧站' });
		expect(checkbox).toBeEnabled();
		expect(screen.queryByText('AI 返回的正文范围与引文不一致。')).not.toBeInTheDocument();
		expect(screen.queryByText(/chapterId需要使用文本/)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/ }));
		await waitFor(() => expect(screen.getByText('已写入')).toBeInTheDocument());
		expect(events).toEqual(['snapshot', 'commit']);
		expect(gateway.resources.get('scene:scene:rainy-old-station-ui')).toMatchObject({
			chapterId: 'chapter:chapter-001',
			manuscriptRange: {
				start: 0,
				end: '夜雨落在旧车站的玻璃顶上。'.length,
				revision: 3
			},
			narrativeOrder: 0
		});
	});

	it('confirms a location candidate whose optional map point is null', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const response = generatedLocationResponse();

		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="夜雨落在旧车站的玻璃顶上。"
				repository={repository}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={(_messages, onProgress) => {
					onProgress('streaming', response);
					return Promise.resolve(response);
				}}
				createSafetySnapshot={() => {
					events.push('snapshot');
					return Promise.resolve('snapshot:test');
				}}
				preset={{
					id: 'location-null-map-point',
					instruction: '从当前正文创建地点候选。',
					targetTypes: ['location']
				}}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		const checkbox = await screen.findByRole('checkbox', { name: '选择 旧车站玻璃顶' });
		expect(checkbox).toBeEnabled();
		expect(screen.queryByText(/mapPoint需要使用对象/)).not.toBeInTheDocument();
		expect(screen.queryByText('字段结构不符合 Story Kernel，修正前无法确认写入。'))
			.not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/ }));
		await waitFor(() => expect(screen.getByText('已写入')).toBeInTheDocument());
		expect(events).toEqual(['snapshot', 'commit']);
		expect(gateway.resources.get('location:location:old-station-roof-ui')).toMatchObject({
			id: 'location:old-station-roof-ui',
			title: '旧车站玻璃顶',
			locationType: '车站构造'
		});
		expect(gateway.resources.get('location:location:old-station-roof-ui'))
			.not.toHaveProperty('mapPoint');
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

	it('preserves a structured native authentication error and opens AI settings', async () => {
		const runGeneration = vi.fn(() => Promise.reject(toAiRequestError({
			code: 'authentication_failed',
			message: 'API Key 无效或已经失效。',
			retryable: false,
			httpStatus: 401
		})));
		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="林越走进车站。"
				repository={new DesktopStoryRepository(
					'D:/Novel',
					new MemoryStoryGateway([])
				)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={runGeneration}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));

		expect(await screen.findByText('API Key 无效或已经失效。')).toBeInTheDocument();
		expect(screen.queryByText('AI 生成失败。')).not.toBeInTheDocument();
		expect(screen.queryByText(/AI 返回的数据会先进入候选区/)).not.toBeInTheDocument();
		fireEvent.click(screen.getByText('诊断信息'));
		expect(screen.getByText('authentication_failed')).toBeInTheDocument();
		expect(screen.getByText('HTTP 401')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: '检查 AI 设置' }));
		expect(useAppStore.getState().activeMode).toBe('settings');
	});

	it('retries a retryable native failure with the unchanged generation request', async () => {
		const response = generatedCharacterResponse();
		const runGeneration = vi.fn()
			.mockRejectedValueOnce({
				code: 'rate_limited',
				message: '请求过多，请稍后再试。',
				retryable: true,
				httpStatus: 429
			})
			.mockResolvedValueOnce(response);
		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="林越走进车站。"
				repository={new DesktopStoryRepository(
					'D:/Novel',
					new MemoryStoryGateway([])
				)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={runGeneration}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		expect(await screen.findByText('请求过多，请稍后再试。')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: '使用相同条件重试' }));
		expect(await screen.findByRole('checkbox', { name: '选择 林越' })).toBeInTheDocument();
		expect(runGeneration).toHaveBeenCalledTimes(2);
		expect(runGeneration.mock.calls[1]?.[0]).toEqual(runGeneration.mock.calls[0]?.[0]);
	});
});
