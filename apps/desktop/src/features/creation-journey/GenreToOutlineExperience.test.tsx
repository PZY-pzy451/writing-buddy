import {
	DEFAULT_AI_PREFERENCES,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import {
	createCreationJourneyState,
	parseCreationJourneyState,
	serializeCreationJourneyState,
	setGeneratedGenreOutline,
	updateGenreToOutlineInput
} from './CreationJourneyModel';
import { CreationJourneyPage } from './CreationJourneyPage';

describe('genre-to-outline journey experience', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('TC-QA-AI-CANCEL-007 sends one genre cancellation for one hundred clicks', async () => {
		const user = userEvent.setup();
		let emitEvent: (event: AiStreamEvent) => void = () => undefined;
		let resolveCancellation: (accepted: boolean) => void = () => undefined;
		vi.spyOn(desktopBridge, 'readCreationJourneyState').mockResolvedValue(undefined);
		vi.spyOn(desktopBridge, 'writeCreationJourneyState').mockResolvedValue({
			hash: 'genre-cancel-hash',
			byteLength: 1,
			modifiedAt: '2026-08-03T07:00:00.000Z'
		});
		vi.spyOn(desktopBridge, 'getAiPreferences')
			.mockResolvedValue(DEFAULT_AI_PREFERENCES);
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => {
				emitEvent = listener;
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
				return Promise.resolve();
			});
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => new Promise<boolean>(resolve => {
				resolveCancellation = resolve;
			}));
		useAppStore.setState({
			creationJourneyStartRoute: 'genre',
			snapshot: {
				root: 'D:/GenreCancelNovel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-genre-cancel',
					title: '取消压力测试',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			}
		});
		render(<CreationJourneyPage />);

		await user.type(await screen.findByLabelText('选择题材'), '都市悬疑');
		await user.click(screen.getByRole('button', { name: '查看生成依据' }));
		await user.click(within(screen.getByRole('dialog', { name: '生成依据' }))
			.getByRole('button', { name: '确认并生成' }));
		await waitFor(() => expect(startAiGeneration).toHaveBeenCalledOnce());
		const stopButton = screen.getByRole('button', { name: '停止生成' });
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				stopButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(cancelAiJob).toHaveBeenCalledOnce();
		resolveCancellation(true);
		const [request] = startAiGeneration.mock.calls[0];
		await act(async () => {
			emitEvent({ type: 'cancelled', jobId: request.jobId });
			await Promise.resolve();
		});
		expect(await screen.findByRole('alert')).toHaveTextContent('生成已停止');
	});

	it('saves the brief, discloses context, and writes only a validated outline draft', async () => {
		const user = userEvent.setup();
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		let persisted = '';
		let writeIndex = 0;
		vi.spyOn(desktopBridge, 'readCreationJourneyState').mockResolvedValue(undefined);
		vi.spyOn(desktopBridge, 'writeCreationJourneyState').mockImplementation(
			(_root, content) => {
				persisted = content;
				writeIndex += 1;
				return Promise.resolve({
					hash: `genre-hash-${writeIndex}`,
					byteLength: content.length,
					modifiedAt: '2026-07-30T03:04:05.000Z'
				});
			}
		);
		const aiSpy = vi.spyOn(desktopBridge, 'startAiGeneration');
		useAppStore.setState({
			creationJourneyStartRoute: 'genre',
			snapshot: {
				root: 'D:/GenreNovel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-genre',
					title: '无日期的人',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			}
		});

		render(<CreationJourneyPage />);
		expect(await screen.findByRole('heading', { name: '创建你的故事' }))
			.toBeInTheDocument();
		await user.type(screen.getByLabelText('选择题材'), '都市悬疑');
		await user.type(
			screen.getByLabelText('用一句话描述你的故事（可选）'),
			'记者追查一座会重置记忆的车站。'
		);
		await user.click(screen.getByRole('button', { name: '查看生成依据' }));
		const preview = screen.getByRole('dialog', { name: '生成依据' });
		expect(within(preview).getByText('全部正文')).toBeInTheDocument();
		await user.click(within(preview).getByRole('button', { name: '确认并生成' }));

		expect(await screen.findByRole('region', { name: '结构化大纲工作区' }))
			.toBeInTheDocument();
		expect(aiSpy).toHaveBeenCalledTimes(1);
		const request = aiSpy.mock.calls[0]?.[0];
		const userPayload = request?.messages.find(message => message.role === 'user')?.content ?? '';
		expect(userPayload).toContain('都市悬疑');
		expect(userPayload).not.toMatch(/projectId|D:|apiKey|credential/iu);
		expect(screen.getAllByTestId('outline-card-title')).toHaveLength(5);
		const tree = screen.getByRole('navigation', { name: '故事结构树' });
		await user.click(within(tree).getAllByRole('button')[1]);
		expect(screen.getByLabelText('节点标题')).toBeInTheDocument();

		await waitFor(() => {
			const restored = parseCreationJourneyState(persisted);
			expect(restored.storyOutline?.genre).toBe('都市悬疑');
			expect(restored.outline).toHaveLength(5);
			expect(restored.chapters).toEqual([]);
		});
	});

	it('snapshots, atomically applies selected candidate fields, reports impact, and undoes', async () => {
		const user = userEvent.setup();
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		let id = 0;
		const initial = updateGenreToOutlineInput(
			createCreationJourneyState('novel-author-control', { startRoute: 'genre' }),
			{ genre: '都市悬疑' }
		);
		const generated = setGeneratedGenreOutline(initial, {
			outline: {
				title: '雨夜旧站',
				genre: '都市悬疑',
				premise: '记者追查只在雨夜出现的旧车站。'
			},
			storyBeats: Array.from({ length: 5 }, (_, index) => ({
				title: `故事节点 ${index + 1}`,
				summary: `推进调查 ${index + 1}`,
				goal: `取得线索 ${index + 1}`,
				conflict: `遭遇阻碍 ${index + 1}`,
				outcome: `留下变化 ${index + 1}`,
				hook: `雨痕变化 ${index + 1}`,
				povHint: '记者'
			})),
			suggestedCharacters: [],
			suggestedWorldRules: [],
			warnings: []
		}, {
			id: prefix => `${prefix}:experience-${++id}`
		});
		let persisted = serializeCreationJourneyState(generated);
		let hashIndex = 0;
		vi.spyOn(desktopBridge, 'readCreationJourneyState').mockResolvedValue({
			content: persisted,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false,
			hash: 'author-control-hash-0'
		});
		const write = vi.spyOn(desktopBridge, 'writeCreationJourneyState')
			.mockImplementation((_root, content) => {
				persisted = content;
				hashIndex += 1;
				return Promise.resolve({
					hash: `author-control-hash-${hashIndex}`,
					byteLength: content.length,
					modifiedAt: '2026-07-30T05:00:00.000Z'
				});
			});
		const createSnapshot = vi.spyOn(desktopBridge, 'createSnapshot')
			.mockResolvedValueOnce('snapshot-apply')
			.mockResolvedValueOnce('snapshot-undo');
		write.mockClear();
		createSnapshot.mockClear();
		useAppStore.setState({
			creationJourneyStartRoute: 'genre',
			snapshot: {
				root: 'D:/AuthorControlNovel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-author-control',
					title: '雨夜旧站',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			}
		});

		render(<CreationJourneyPage />);
		const tree = await screen.findByRole('navigation', { name: '故事结构树' });
		await user.click(within(tree).getAllByRole('button')[2]);
		await user.click(screen.getByRole('button', { name: '生成 3 个局部候选' }));
		const review = await screen.findByRole('region', { name: '局部候选审核' });
		await user.click(within(review).getByRole('checkbox', { name: '采用 一句话概要' }));
		await user.click(within(review).getByRole('button', { name: '采用已选 2 个字段' }));

		const impact = await screen.findByRole('region', { name: '影响报告' });
		await waitFor(() => {
			const applied = parseCreationJourneyState(persisted);
			expect(applied.outline[1].summary).toBe('推进调查 2');
			expect(applied.outline[1].conflict)
				.toBe('公开名单会立即抹去记者最后的私人记忆。');
			expect(applied.outline[1].hook).toBe('名单末尾出现明天的日期。');
		});
		expect(createSnapshot).toHaveBeenNthCalledWith(
			1,
			'D:/AuthorControlNovel',
			'beforeDestructiveOperation',
			'AI 大纲局部采用 · 2 个字段'
		);
		expect(createSnapshot.mock.invocationCallOrder[0])
			.toBeLessThan(write.mock.invocationCallOrder[0]);

		await user.click(within(impact).getByRole('button', { name: '撤销本次 AI 采用' }));
		await waitFor(() => {
			const restored = parseCreationJourneyState(persisted);
			expect(restored.outline[1].conflict).toBe('遭遇阻碍 2');
			expect(restored.outline[1].hook).toBe('雨痕变化 2');
		});
		expect(createSnapshot).toHaveBeenNthCalledWith(
			2,
			'D:/AuthorControlNovel',
			'beforeDestructiveOperation',
			'撤销 AI 大纲局部采用'
		);
		expect(write).toHaveBeenCalledTimes(2);

		const beforeFailedApply = persisted;
		write.mockClear();
		createSnapshot.mockRejectedValueOnce(new Error('invalidSnapshotReason'));
		await user.click(screen.getByRole('button', { name: '生成 3 个局部候选' }));
		const failedReview = await screen.findByRole('region', { name: '局部候选审核' });
		await user.click(within(failedReview).getByRole('button', {
			name: '采用已选 3 个字段'
		}));
		expect(await screen.findAllByText('安全快照创建失败；候选尚未写入。'))
			.toHaveLength(2);
		expect(write).not.toHaveBeenCalled();
		expect(persisted).toBe(beforeFailedApply);
	});
});
