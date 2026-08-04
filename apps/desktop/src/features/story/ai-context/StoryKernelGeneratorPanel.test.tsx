import {
	DEFAULT_AI_PREFERENCES,
	type AiStreamEvent
} from '@writing-buddy/ai';
import type { TextFile } from '@writing-buddy/domain';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import {
	STORY_KERNEL_SCHEMA_MUTATION_MATRIX_RESPONSE,
	STORY_KERNEL_UNSELECTED_MALFORMED_RELATIONSHIP_RESPONSE
} from '@writing-buddy/test-support';
import {
	DesktopStoryRepository,
	type StorySaveEntry,
	type StoryStorageGateway
} from '@writing-buddy/story-kernel';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import { toAiRequestError } from '../../ai/errors/AiErrorPresentation';
import { StoryKernelGeneratorPanel } from './StoryKernelGeneratorPanel';
import {
	StoryKernelGenerationStore,
	type StoryKernelGenerationStoragePort
} from './StoryKernelGenerationService';

class MemoryStorage implements StoryKernelGenerationStoragePort {
	private content: string | undefined;
	private hash = '';
	writeCalls = 0;

	constructor(content?: string) {
		this.content = content;
	}

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
		this.writeCalls += 1;
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

function generatedItemWithoutDefaultsResponse(): string {
	return JSON.stringify({
		candidates: [{
			operation: 'create',
			resource: {
				id: 'item:blue-envelope-ui',
				type: 'item',
				title: '蓝色信封',
				aliases: [],
				tags: [],
				evidenceIds: [],
				description: '一只等待开启的蓝色信封。'
			},
			confidence: 0.95,
			rationale: '正文明确描述了蓝色信封。',
			evidence: { start: 0, end: 4, quote: '蓝色信封' }
		}]
	});
}

function persistedOldItemBatch(): string {
	const timestamp = '2026-07-27T08:00:00.000Z';
	return JSON.stringify({
		schemaVersion: 1,
		updatedAt: timestamp,
		batches: [{
			id: 'generation-batch:old-item-ui',
			schemaVersion: 1,
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '3',
			baseOffset: 0,
			instruction: '从当前正文创建物品候选。',
			targetTypes: ['item'],
			candidates: [{
				id: 'generation-candidate:old-blue-envelope-ui',
				operation: 'create',
				resourceType: 'item',
				resourceId: 'item:blue-envelope-old-ui',
				title: '旧批次蓝色信封',
				rawResource: {
					id: 'item:blue-envelope-old-ui',
					type: 'item',
					title: '旧批次蓝色信封',
					aliases: [],
					tags: [],
					evidenceIds: [],
					description: '旧版本生成但尚未确认的蓝色信封。'
				},
				confidence: 0.95,
				rationale: '正文明确描述了蓝色信封。',
				conflicts: [{
					code: 'invalid-schema',
					message: '字段结构不符合 Story Kernel，修正前无法确认写入。',
					blocking: true
				}],
				status: 'pending',
				createdAt: timestamp,
				updatedAt: timestamp
			}],
			createdAt: timestamp,
			updatedAt: timestamp
		}]
	});
}

describe('StoryKernelGeneratorPanel', () => {
	afterEach(() => {
		vi.restoreAllMocks();
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

	it('exposes stable selectors without replacing author-facing control names', async () => {
		const runGeneration = vi.fn(() => Promise.resolve(generatedCharacterResponse()));
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

		expect(screen.getByRole('textbox', { name: '生成要求' }))
			.toHaveAttribute('data-testid', 'story-kernel-generation-instruction');
		for (const checkbox of screen.getAllByRole('checkbox')) {
			expect(checkbox).toHaveAttribute('name', 'story-kernel-resource-type');
		}
		const generate = screen.getByRole('button', { name: '生成 Story Kernel 候选' });
		expect(generate).toHaveAttribute('data-testid', 'story-kernel-generate');

		await act(() => {
			fireEvent.click(generate);
			return Promise.resolve();
		});
		const candidate = await screen.findByRole('checkbox', { name: '选择 林越' });
		expect(candidate).toHaveAttribute('name', 'story-kernel-candidate');
		expect(screen.getByRole('button', { name: '查看结构' }))
			.toHaveAttribute('data-testid', 'story-kernel-candidate-structure-toggle');
	});

	it('blocks one hundred repeated generation clicks before the first stream event', async () => {
		let resolveGeneration: (value: string) => void = () => undefined;
		const runGeneration = vi.fn(() => new Promise<string>(resolve => {
			resolveGeneration = resolve;
		}));
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

		const button = screen.getByRole('button', { name: '生成 Story Kernel 候选' });
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		await waitFor(() => expect(runGeneration).toHaveBeenCalledOnce());
		expect(button).toBeDisabled();
		resolveGeneration(generatedCharacterResponse());
		expect(await screen.findByRole('checkbox', { name: '选择 林越' })).toBeInTheDocument();
	});

	it('TC-QA-SK-CANCEL-001 blocks one hundred repeated cancellation clicks before native cancellation resolves', async () => {
		let emitEvent: (event: AiStreamEvent) => void = () => undefined;
		let activeJobId = '';
		let resolveCancellation: (value: boolean) => void = () => undefined;
		vi.spyOn(desktopBridge, 'getAiPreferences')
			.mockResolvedValue(DEFAULT_AI_PREFERENCES);
		vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => {
				activeJobId = request.jobId;
				emitEvent = listener;
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
				return Promise.resolve();
			});
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => new Promise<boolean>(resolve => {
				resolveCancellation = resolve;
			}));
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
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		const cancelButton = await screen.findByRole('button', { name: '取消' });
		expect(cancelButton).toHaveAttribute('data-testid', 'story-kernel-cancel');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(cancelAiJob).toHaveBeenCalledOnce();
		expect(cancelAiJob).toHaveBeenCalledWith(activeJobId);
		expect(screen.getByRole('button', { name: '正在取消' })).toBeDisabled();
		resolveCancellation(true);
		await act(async () => {
			emitEvent({ type: 'cancelled', jobId: activeJobId });
			await Promise.resolve();
		});
		expect(await screen.findByText('生成已停止')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
	});

	it('TC-QA-SK-CANCEL-002 releases the cancellation guard after a native command failure', async () => {
		let emitEvent: (event: AiStreamEvent) => void = () => undefined;
		let activeJobId = '';
		vi.spyOn(desktopBridge, 'getAiPreferences')
			.mockResolvedValue(DEFAULT_AI_PREFERENCES);
		vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => {
				activeJobId = request.jobId;
				emitEvent = listener;
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
				return Promise.resolve();
			});
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockRejectedValueOnce({
				code: 'connection_timeout',
				message: '取消命令连接超时。',
				retryable: true
			})
			.mockResolvedValue(true);
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
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		fireEvent.click(await screen.findByRole('button', { name: '取消' }));
		expect(await screen.findByText('生成未完成')).toBeInTheDocument();
		const retryCancelButton = screen.getByRole('button', { name: '取消' });
		expect(retryCancelButton).toBeEnabled();

		fireEvent.click(retryCancelButton);
		await waitFor(() => expect(cancelAiJob).toHaveBeenCalledTimes(2));
		expect(screen.getByRole('button', { name: '正在取消' })).toBeDisabled();
		await act(async () => {
			emitEvent({ type: 'cancelled', jobId: activeJobId });
			await Promise.resolve();
		});

		expect(await screen.findByText('生成已停止')).toBeInTheDocument();
		expect(screen.queryByText('取消命令连接超时。')).not.toBeInTheDocument();
	});

	it('TC-QA-SK-CANCEL-003 releases the cancellation guard when the native job is not found', async () => {
		let emitEvent: (event: AiStreamEvent) => void = () => undefined;
		let activeJobId = '';
		vi.spyOn(desktopBridge, 'getAiPreferences')
			.mockResolvedValue(DEFAULT_AI_PREFERENCES);
		vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => {
				activeJobId = request.jobId;
				emitEvent = listener;
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
				return Promise.resolve();
			});
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockResolvedValueOnce(false)
			.mockResolvedValue(true);
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
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		fireEvent.click(await screen.findByRole('button', { name: '取消' }));
		await waitFor(() => expect(cancelAiJob).toHaveBeenCalledOnce());
		const retryCancelButton = screen.getByRole('button', { name: '取消' });
		expect(retryCancelButton).toBeEnabled();

		fireEvent.click(retryCancelButton);
		await waitFor(() => expect(cancelAiJob).toHaveBeenCalledTimes(2));
		await act(async () => {
			emitEvent({ type: 'cancelled', jobId: activeJobId });
			await Promise.resolve();
		});

		expect(await screen.findByText('生成已停止')).toBeInTheDocument();
	});

	it('TC-QA-SK-ACTION-001 blocks one hundred repeated confirmation clicks before the snapshot resolves', async () => {
		const events: string[] = [];
		let resolveSnapshot: (value: string) => void = () => undefined;
		const createSafetySnapshot = vi.fn(() => new Promise<string>(resolve => {
			resolveSnapshot = resolve;
		}));
		const gateway = new MemoryStoryGateway(events);
		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="林越走进车站。"
				repository={new DesktopStoryRepository('D:/Novel', gateway)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={() => Promise.resolve(generatedCharacterResponse())}
				createSafetySnapshot={createSafetySnapshot}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		expect(await screen.findByRole('checkbox', { name: '选择 林越' })).toBeChecked();
		const confirmButton = screen.getByRole('button', { name: '创建快照并确认 1' });

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(createSafetySnapshot).toHaveBeenCalledOnce();
		expect(events).toEqual([]);
		resolveSnapshot('snapshot:test');
		await waitFor(() => expect(events).toEqual(['commit']));
		expect(gateway.resources.size).toBe(1);
	});

	it('TC-QA-SK-ACTION-002 blocks one hundred repeated rejection clicks before storage updates', async () => {
		const storage = new MemoryStorage();
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
				store={new StoryKernelGenerationStore('D:/Novel', storage)}
				runGeneration={() => Promise.resolve(generatedCharacterResponse())}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		await screen.findByRole('checkbox', { name: '选择 林越' });
		expect(storage.writeCalls).toBe(1);
		const rejectButton = screen.getByRole('button', { name: '拒绝' });

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				rejectButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(await screen.findByText('已拒绝')).toBeInTheDocument();
		expect(storage.writeCalls).toBe(2);
		expect(screen.queryByRole('button', { name: '拒绝' })).not.toBeInTheDocument();
	});

	it('keeps valid candidates and explains an isolated malformed candidate', async () => {
		const valid = JSON.parse(generatedCharacterResponse()) as {
			candidates: Array<Record<string, unknown>>;
		};
		valid.candidates.push({
			operation: 'create',
			resource: {
				id: 'location:broken-ui',
				type: 'location',
				title: null
			},
			confidence: 0.8,
			rationale: '结构不完整。',
			evidence: null
		});
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
				runGeneration={() => Promise.resolve(JSON.stringify(valid))}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));

		expect(await screen.findByRole('checkbox', { name: '选择 林越' })).toBeInTheDocument();
		expect(screen.getByText(/第 2 项候选结构不完整，已安全隔离/)).toBeInTheDocument();
		expect(screen.queryByText('生成未完成')).not.toBeInTheDocument();
	});

	it('TC-QA-SK-REL-002 keeps three valid candidates usable when AI adds a malformed unselected relationship', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="QA 人物甲、QA 人物乙和 QA 人物丙共同出现。"
				repository={new DesktopStoryRepository('D:/Novel', gateway)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={() => Promise.resolve(
					STORY_KERNEL_UNSELECTED_MALFORMED_RELATIONSHIP_RESPONSE
				)}
				createSafetySnapshot={() => {
					events.push('snapshot');
					return Promise.resolve('snapshot:test');
				}}
				preset={{
					id: 'qa-unselected-malformed-relationship',
					instruction: '仅创建正文中的人物候选。',
					targetTypes: ['character']
				}}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));

		const relationshipCheckbox = await screen.findByRole('checkbox', {
			name: '选择 QA 人物甲与乙的关系'
		});
		expect(relationshipCheckbox).toBeDisabled();
		expect(screen.getByText('4 个候选')).toBeInTheDocument();
		expect(screen.getByText('3 个可确认')).toBeInTheDocument();
		expect(screen.getByText('AI 返回了未勾选的 relationship 类型。')).toBeInTheDocument();
		expect(screen.getByText('字段结构不符合 Story Kernel，修正前无法确认写入。'))
			.toBeInTheDocument();
		expect(screen.getByText('effectiveFrom')).toBeInTheDocument();
		expect(screen.getByText('history')).toBeInTheDocument();
		expect(screen.getByText(/当前："childhood"/)).toBeInTheDocument();
		expect(screen.queryByText('生成未完成')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: '创建快照并确认 3' }));
		await waitFor(() => expect(screen.getAllByText('已写入')).toHaveLength(3));

		expect(events).toEqual(['snapshot', 'commit']);
		expect([...gateway.resources.keys()].filter(key => key.startsWith('character:')))
			.toHaveLength(3);
		expect([...gateway.resources.keys()].some(key => key.startsWith('relationship:')))
			.toBe(false);
	});

	it('TC-QA-SK-REL-005 reopens the quarantined relationship without another AI request', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const storage = new MemoryStorage();
		const first = render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="QA 人物甲、QA 人物乙和 QA 人物丙共同出现。"
				repository={repository}
				store={new StoryKernelGenerationStore('D:/Novel', storage)}
				runGeneration={() => Promise.resolve(
					STORY_KERNEL_UNSELECTED_MALFORMED_RELATIONSHIP_RESPONSE
				)}
				preset={{
					id: 'qa-persist-malformed-relationship',
					instruction: '仅创建正文中的人物候选。',
					targetTypes: ['character']
				}}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		await screen.findByRole('checkbox', { name: '选择 QA 人物甲与乙的关系' });
		first.unmount();

		const runGeneration = vi.fn(() => Promise.resolve(''));
		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="QA 人物甲、QA 人物乙和 QA 人物丙共同出现。"
				repository={repository}
				store={new StoryKernelGenerationStore('D:/Novel', storage)}
				runGeneration={runGeneration}
				createSafetySnapshot={() => {
					events.push('snapshot');
					return Promise.resolve('snapshot:test');
				}}
			/>
		);

		const reopenedRelationship = await screen.findByRole('checkbox', {
			name: '选择 QA 人物甲与乙的关系'
		});
		expect(runGeneration).not.toHaveBeenCalled();
		expect(reopenedRelationship).toBeDisabled();
		expect(screen.getByText('4 个候选')).toBeInTheDocument();
		expect(screen.getByText('3 个可确认')).toBeInTheDocument();
		expect(screen.getByText(/当前："childhood"/)).toBeInTheDocument();
		expect(screen.getByText(/当前："童年时期共同经历过一次脱敏 QA 事件。"/))
			.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: '创建快照并确认 3' }));
		await waitFor(() => expect(screen.getAllByText('已写入')).toHaveLength(3));
		expect(events).toEqual(['snapshot', 'commit']);
		expect([...gateway.resources.keys()].some(key => key.startsWith('relationship:')))
			.toBe(false);
	});

	it('TC-QA-SK-MATRIX-002 renders all schema mutations without blocking the valid control', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="脱敏 QA Schema 突变正文。"
				repository={new DesktopStoryRepository('D:/Novel', gateway)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={() => Promise.resolve(
					STORY_KERNEL_SCHEMA_MUTATION_MATRIX_RESPONSE
				)}
				createSafetySnapshot={() => {
					events.push('snapshot');
					return Promise.resolve('snapshot:test');
				}}
				preset={{
					id: 'qa-story-kernel-schema-matrix',
					instruction: '执行所有 Story Kernel 类型的脱敏结构突变验证。',
					targetTypes: [
						'character',
						'scene',
						'location',
						'faction',
						'item',
						'worldRule',
						'timelineEvent',
						'relationship',
						'plotThread',
						'foreshadowing',
						'information'
					]
				}}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));

		const control = await screen.findByRole('checkbox', { name: '选择 QA 合法控制人物' });
		expect(control).toBeEnabled();
		expect(control).toBeChecked();
		expect(screen.getByText('12 个候选')).toBeInTheDocument();
		expect(screen.getByText('1 个可确认')).toBeInTheDocument();
		expect(screen.getAllByText('字段结构不符合 Story Kernel，修正前无法确认写入。'))
			.toHaveLength(11);
		for (const title of [
			'QA 突变人物',
			'QA 突变场景',
			'QA 突变地点',
			'QA 突变势力',
			'QA 突变物品',
			'QA 突变规则',
			'QA 突变事件',
			'QA 突变关系',
			'QA 突变剧情线',
			'QA 突变伏笔',
			'QA 突变信息'
		]) {
			expect(screen.getByRole('checkbox', { name: `选择 ${title}` })).toBeDisabled();
		}
		for (const path of [
			'role',
			'participantIds',
			'mapPoint',
			'goals',
			'unique',
			'exceptions',
			'narrativePosition',
			'effectiveFrom',
			'status',
			'readerVisibility',
			'authorSecret'
		]) {
			expect(screen.getByText(path)).toBeInTheDocument();
		}
		expect(screen.queryByText(/invalidStoryKernel/)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: '创建快照并确认 1' }));
		await waitFor(() => expect(screen.getByText('已写入')).toBeInTheDocument());
		expect(events).toEqual(['snapshot', 'commit']);
		expect([...gateway.resources.keys()]).toEqual([
			'character:character:qa-matrix-control'
		]);
	});

	it('classifies a fully malformed batch as a response issue, not an AI setting issue', async () => {
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
				runGeneration={() => Promise.resolve(JSON.stringify({
					candidates: [{
						operation: 'create',
						resource: {
							id: 'location:broken-ui',
							type: 'location',
							title: null
						},
						confidence: 0.8,
						rationale: '结构不完整。',
						evidence: null
					}]
				}))}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));

		expect(await screen.findByText('候选结构不完整')).toBeInTheDocument();
		expect(screen.getByText(/这不是 AI 设置或连接问题/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '检查 AI 设置' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '使用相同条件重试' })).toBeEnabled();
	});

	it('keeps generated resources pending until snapshot-backed author confirmation', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const store = new StoryKernelGenerationStore('D:/Novel', new MemoryStorage());
		const onCommitted = vi.fn();
		const response = generatedCharacterResponse();
		const createSnapshot = vi
			.spyOn(desktopBridge, 'createSnapshot')
			.mockImplementation(() => {
				events.push('snapshot');
				return Promise.resolve('snapshot:test');
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
		expect(createSnapshot).toHaveBeenCalledWith(
			'D:/Novel',
			'beforeDestructiveOperation',
			'AI Story Kernel 生成前'
		);
		expect(events).toEqual(['snapshot', 'commit']);
		expect(gateway.resources.has('character:character:lin-yue-ui')).toBe(true);
		expect(onCommitted).toHaveBeenCalledOnce();
	});

	it('keeps a valid character pending and localizes a rejected snapshot', async () => {
		const gateway = new MemoryStoryGateway([]);
		const response = generatedCharacterResponse();
		const createSnapshot = vi.spyOn(desktopBridge, 'createSnapshot')
			.mockRejectedValueOnce(new Error('invalidSnapshotReason'))
			.mockResolvedValue('snapshot:test');

		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="林越走进车站。"
				repository={new DesktopStoryRepository('D:/Novel', gateway)}
				store={new StoryKernelGenerationStore('D:/Novel', new MemoryStorage())}
				runGeneration={(_messages, onProgress) => {
					onProgress('streaming', response);
					return Promise.resolve(response);
				}}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		await screen.findByRole('checkbox', { name: '选择 林越' });
		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/ }));

		expect(await screen.findByText(
			'安全快照参数不兼容，候选尚未写入。请更新应用后重试。'
		)).toBeInTheDocument();
		expect(screen.queryByText('invalidSnapshotReason')).not.toBeInTheDocument();
		expect(screen.getByText('待确认')).toBeInTheDocument();
		expect(gateway.resources.size).toBe(0);

		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/ }));
		await waitFor(() => expect(gateway.resources.size).toBe(1));
		expect(createSnapshot).toHaveBeenCalledTimes(2);
		expect(screen.queryByText(
			'安全快照参数不兼容，候选尚未写入。请更新应用后重试。'
		)).not.toBeInTheDocument();
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

	it('confirms an item candidate after repairing omitted item defaults', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const response = generatedItemWithoutDefaultsResponse();

		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="蓝色信封躺在桌上。"
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
					id: 'item-missing-defaults',
					instruction: '从当前正文创建物品候选。',
					targetTypes: ['item']
				}}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '生成 Story Kernel 候选' }));
		const checkbox = await screen.findByRole('checkbox', { name: '选择 蓝色信封' });
		expect(checkbox).toBeEnabled();
		expect(screen.queryByText(/unique不符合 Story Kernel/)).not.toBeInTheDocument();
		expect(screen.queryByText(/restrictions需要使用列表/)).not.toBeInTheDocument();
		expect(screen.queryByText('字段结构不符合 Story Kernel，修正前无法确认写入。'))
			.not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/ }));
		await waitFor(() => expect(screen.getByText('已写入')).toBeInTheDocument());
		expect(events).toEqual(['snapshot', 'commit']);
		expect(gateway.resources.get('item:item:blue-envelope-ui')).toMatchObject({
			id: 'item:blue-envelope-ui',
			title: '蓝色信封',
			unique: false,
			restrictions: []
		});
	});

	it('reopens and confirms an old item candidate without another AI request', async () => {
		const events: string[] = [];
		const gateway = new MemoryStoryGateway(events);
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const runGeneration = vi.fn(() => Promise.resolve(''));

		render(
			<StoryKernelGeneratorPanel
				projectRoot="D:/Novel"
				resourceId="chapter-001"
				sourceRevision={3}
				content="蓝色信封躺在桌上。"
				repository={repository}
				store={new StoryKernelGenerationStore(
					'D:/Novel',
					new MemoryStorage(persistedOldItemBatch())
				)}
				runGeneration={runGeneration}
				createSafetySnapshot={() => {
					events.push('snapshot');
					return Promise.resolve('snapshot:test');
				}}
			/>
		);

		const checkbox = await screen.findByRole('checkbox', { name: '选择 旧批次蓝色信封' });
		expect(checkbox).toBeEnabled();
		expect(checkbox).toBeChecked();
		expect(runGeneration).not.toHaveBeenCalled();
		expect(screen.queryByText('字段结构不符合 Story Kernel，修正前无法确认写入。'))
			.not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/ }));
		await waitFor(() => expect(screen.getByText('已写入')).toBeInTheDocument());
		expect(events).toEqual(['snapshot', 'commit']);
		expect(gateway.resources.get('item:item:blue-envelope-old-ui')).toMatchObject({
			unique: false,
			restrictions: []
		});
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
