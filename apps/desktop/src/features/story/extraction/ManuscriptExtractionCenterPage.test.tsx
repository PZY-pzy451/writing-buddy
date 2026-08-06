import type { TextFile } from '@writing-buddy/domain';
import type { AtomicWriteResult } from '@writing-buddy/platform-ports';
import {
	DEFAULT_AI_PREFERENCES,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import {
	createCreationJourneyState,
	parseCreationJourneyState,
	serializeCreationJourneyState,
	setGeneratedGenreOutline,
	updateGenreToOutlineInput
} from '../../creation-journey/CreationJourneyModel';
import {
	CreationJourneyStore,
	type CreationJourneyStorageGateway
} from '../../creation-journey/CreationJourneyStore';
import { StoryKernelGenerationService } from '../ai-context/StoryKernelGenerationService';
import { ManuscriptExtractionCenterPage } from './ManuscriptExtractionCenterPage';
import {
	createManuscriptExtractionRun,
	ManuscriptExtractionRunner,
	ManuscriptExtractionRunStore,
	type ManuscriptExtractionRun
} from './ManuscriptExtractionCenterService';

const originalOpenQuickCapture = useAppStore.getState().openQuickCapture;

const chapters = [{
	resourceId: 'chapter:chapter-a11ce001',
	chapterId: 'chapter-a11ce001',
	title: '第一章 停摆的时钟',
	path: 'chapters/chapter-001.md',
	narrativeOrder: 0,
	volumeId: 'volume-a11ce001',
	volumeTitle: '第一卷'
}, {
	resourceId: 'chapter:chapter-a11ce002',
	chapterId: 'chapter-a11ce002',
	title: '第二章 迷路的旅人',
	path: 'chapters/chapter-002.md',
	narrativeOrder: 1,
	volumeId: 'volume-a11ce001',
	volumeTitle: '第一卷'
}];

class MemoryJourneyGateway implements CreationJourneyStorageGateway {
	file?: TextFile;
	writes = 0;

	constructor(content: string) {
		this.file = {
			content,
			hash: 'journey-hash-0',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		};
	}

	readCreationJourneyState(): Promise<TextFile | undefined> {
		return Promise.resolve(this.file);
	}

	writeCreationJourneyState(
		_projectRoot: string,
		content: string,
		expectedHash: string
	): Promise<AtomicWriteResult> {
		if (expectedHash !== this.file?.hash) throw new Error('externalChange');
		this.writes += 1;
		this.file = {
			content,
			hash: `journey-hash-${this.writes}`,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		};
		return Promise.resolve({
			hash: this.file.hash,
			byteLength: content.length,
			modifiedAt: '2026-07-30T10:00:00.000Z'
		});
	}
}

function materializedJourney(projectId: string): string {
	const now = () => '2026-07-30T10:00:00.000Z';
	let state = updateGenreToOutlineInput(
		createCreationJourneyState(projectId, { startRoute: 'genre', now }),
		{ genre: '都市悬疑' },
		now
	);
	let id = 0;
	state = setGeneratedGenreOutline(state, {
		outline: {
			title: '雨夜旧站',
			genre: '都市悬疑',
			premise: '记者追查只在雨夜出现的旧车站。'
		},
		storyBeats: Array.from({ length: 5 }, (_, index) => ({
			title: `故事节点 ${index + 1}`,
			summary: `推进调查 ${index + 1}`
		})),
		suggestedCharacters: [],
		suggestedWorldRules: [],
		warnings: []
	}, {
		id: prefix => `${prefix}:reconciliation-${++id}`,
		now
	});
	return serializeCreationJourneyState(parseCreationJourneyState(JSON.stringify({
		...state,
		outline: [
			...state.outline,
			{
				id: 'journey-outline:volume-one',
				type: 'volume',
				order: 0,
				title: '第一卷',
				summary: '记者进入旧车站。',
				purpose: '建立谜团',
				status: 'drafting',
				source: 'ai_generated',
				revision: 2,
				resourceId: 'volume:volume-a11ce001'
			},
			{
				id: 'journey-outline:chapter-one',
				type: 'chapter',
				parentId: 'journey-outline:volume-one',
				order: 0,
				title: '第一章 停摆的时钟',
				summary: '林越在雨夜进入旧车站。',
				purpose: '触发调查',
				goal: '找到失踪者留下的线索',
				conflict: '值班员拒绝提供站内记录',
				outcome: '林越取得停摆时钟的维修单',
				hook: '维修单上的日期来自未来',
				status: 'drafting',
				source: 'ai_generated',
				revision: 4,
				resourceId: 'chapter:chapter-a11ce001'
			}
		]
	})));
}

async function selectOneConfirmableCandidate(onOpenEvidence?: (evidence: {
	readonly resourceId: string;
	readonly range?: { readonly start: number; readonly end: number };
}) => void): Promise<HTMLElement> {
	render(
		<ManuscriptExtractionCenterPage
			projectRoot="browser-fixture"
			chapters={chapters}
			activeChapterId={chapters[0]?.resourceId}
			onOpenEvidence={onOpenEvidence}
		/>
	);

	fireEvent.click(screen.getByTestId('extraction-plan'));
	await screen.findByText(/已规划 1 个章节/u);
	fireEvent.click(screen.getByTestId('extraction-start-or-resume'));
	await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });
	const candidate = screen.getAllByTestId('extraction-candidate-option').find(element => (
		!(element as HTMLInputElement).disabled
	));
	expect(candidate).toBeDefined();
	if (!candidate) throw new Error('confirmableCandidateMissing');
	fireEvent.click(candidate);
	return screen.getByTestId('extraction-confirm-selected');
}

describe('ManuscriptExtractionCenterPage', () => {
	beforeEach(async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture-key');
	});
	afterEach(() => {
		vi.restoreAllMocks();
		useAppStore.setState({
			quickCaptureOpen: false,
			quickCaptureSeed: undefined,
			openQuickCapture: originalOpenQuickCapture
		});
	});

	it('renders visible accessible setup and filter identities with keyboard focus', () => {
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		const scopeOptions = screen.getAllByTestId('extraction-scope-option');
		expect(scopeOptions.map(option => option.getAttribute('data-extraction-scope')))
			.toEqual(['current-chapter', 'current-volume', 'selected', 'all', 'unfinished']);
		expect(screen.getByTestId('extraction-base-chapter')).toBeVisible();
		expect(screen.getAllByTestId('extraction-target-type').every(option => (
			Boolean(option.getAttribute('data-resource-type'))
		))).toBe(true);

		const instruction = screen.getByTestId('extraction-author-instruction');
		instruction.focus();
		expect(instruction).toHaveFocus();
		expect(screen.getByTestId('extraction-candidate-type-filter')).toBeVisible();
		expect(screen.getByTestId('extraction-conflict-only')).toBeEnabled();
	});

	it('keeps extraction setup and filter controls in their visual layout', () => {
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		const selectedScope = screen.getAllByTestId('extraction-scope-option').find(option => (
			option.getAttribute('data-extraction-scope') === 'selected'
		));
		expect(selectedScope).toBeDefined();
		if (!selectedScope) throw new Error('selectedExtractionScopeMissing');
		fireEvent.click(selectedScope);

		const chapterOption = screen.getAllByTestId('extraction-chapter-option')[1];
		expect(chapterOption).toBeDefined();
		if (!chapterOption) throw new Error('extractionChapterOptionMissing');
		expect(chapterOption).not.toBeChecked();
		fireEvent.click(chapterOption);
		expect(screen.getAllByTestId('extraction-chapter-option')[1]).toBeChecked();

		const instruction = screen.getByTestId('extraction-author-instruction');
		const plan = screen.getByTestId('extraction-plan');
		fireEvent.change(instruction, { target: { value: '' } });
		expect(plan).toBeDisabled();
		fireEvent.change(instruction, { target: { value: 'Only explicit facts.' } });
		expect(plan).toBeEnabled();

		const filter = screen.getByTestId('extraction-candidate-type-filter');
		fireEvent.change(filter, { target: { value: 'character' } });
		expect(filter).toHaveValue('character');
		const conflictOnly = screen.getByTestId('extraction-conflict-only');
		fireEvent.click(conflictOnly);
		expect(conflictOnly).toBeChecked();
		expect(selectedScope.closest('.extraction-scope-grid')).toBeInTheDocument();
		expect(filter.closest('.extraction-candidate-filters')).toBeInTheDocument();
	});

	it('guards repeated plan actions against duplicate batches', async () => {
		const append = vi.spyOn(ManuscriptExtractionRunStore.prototype, 'append')
			.mockImplementation(() => new Promise<never>(() => undefined));
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);
		const plan = screen.getByTestId('extraction-plan');

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				plan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		await waitFor(() => expect(append).toHaveBeenCalled());

		expect(append).toHaveBeenCalledTimes(1);
		expect(plan).toBeDisabled();
	});

	it('shows loading while a failed plan retry remains pending', async () => {
		const append = vi.spyOn(ManuscriptExtractionRunStore.prototype, 'append')
			.mockRejectedValueOnce(new Error('temporary-storage-secret-123'))
			.mockImplementation(() => new Promise<never>(() => undefined));
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);
		const plan = screen.getByTestId('extraction-plan');
		fireEvent.click(plan);
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent(
			'正文整理暂时不可用，请重试。'
		);
		expect(alert).not.toHaveTextContent('temporary-storage-secret-123');

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				plan.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await new Promise(resolve => setTimeout(resolve, 0));
		});

		expect(append).toHaveBeenCalledTimes(2);
		expect(plan).toBeDisabled();
		expect(plan.querySelector('.spin')).toBeInTheDocument();
	});

	it('undoes one confirmation after repeated rollback actions', async () => {
		const confirmButton = await selectOneConfirmableCandidate();
		const snapshot = vi.spyOn(desktopBridge, 'createSnapshot');
		const confirm = vi.spyOn(
			StoryKernelGenerationService.prototype,
			'confirmWithReceipt'
		);
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});
		const undoButton = await screen.findByTestId('extraction-undo-confirmation');
		expect(snapshot).toHaveBeenCalledTimes(1);
		expect(confirm).toHaveBeenCalledTimes(1);
		const undo = vi.spyOn(StoryKernelGenerationService.prototype, 'undoConfirmation')
			.mockImplementation(() => new Promise<never>(() => undefined));

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				undoButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(undo).toHaveBeenCalledTimes(1);
		expect(undoButton).toBeDisabled();
	});

	it('disables candidate rejection after one request is dispatched', async () => {
		await selectOneConfirmableCandidate();
		const rejectButton = screen.getAllByTestId('extraction-candidate-reject')[0];
		expect(rejectButton).toBeDefined();
		if (!rejectButton) throw new Error('rejectCandidateMissing');
		const reject = vi.spyOn(StoryKernelGenerationService.prototype, 'reject')
			.mockImplementation(() => new Promise<never>(() => undefined));

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				rejectButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(reject).toHaveBeenCalledTimes(1);
		expect(rejectButton).toBeDisabled();
	});

	it('reports one successful paid run after repeated start actions', async () => {
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await screen.findByText(/已规划 1 个章节/u);
		const run = vi.spyOn(ManuscriptExtractionRunner.prototype, 'run')
			.mockImplementation(() => new Promise<never>(() => undefined));
		const start = screen.getByTestId('extraction-start-or-resume');

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(run).toHaveBeenCalledTimes(1);
		expect(start).toBeDisabled();
		expect(screen.getByRole('status')).toHaveTextContent('created · 已接收 0 字符');
	});

	it('TC-QA-AI-CANCEL-006 cancels the runner and native job once for repeated actions', async () => {
		let emitEvent: (event: AiStreamEvent) => void = () => undefined;
		let resolveCancellation: (accepted: boolean) => void = () => undefined;
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
		const stopRunner = vi.spyOn(ManuscriptExtractionRunner.prototype, 'stop');
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await screen.findByText(/已规划 1 个章节/u);
		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));
		const stopButton = await screen.findByTestId('extraction-stop');
		await waitFor(() => expect(startAiGeneration).toHaveBeenCalledOnce());
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				stopButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(stopRunner).toHaveBeenCalledOnce();
		expect(cancelAiJob).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: '正在停止' })).toBeDisabled();
		resolveCancellation(true);
		const [request] = startAiGeneration.mock.calls[0];
		await act(async () => {
			emitEvent({ type: 'cancelled', jobId: request.jobId });
			await Promise.resolve();
		});
		await screen.findByText(/运行已结束/u);
	});

	it('enables retry after a localized malformed-response failure', async () => {
		const stage = vi.spyOn(StoryKernelGenerationService.prototype, 'stageFromResponse')
			.mockRejectedValueOnce(new Error('invalidStoryKernelGenerationResponse:json'));
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await screen.findByText(/已规划 1 个章节/u);
		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));

		expect(await screen.findByText('invalid-response', {}, { timeout: 8_000 }))
			.toBeInTheDocument();
		expect(screen.queryByText(/invalidStoryKernelGenerationResponse/u))
			.not.toBeInTheDocument();
		const retry = screen.getByTestId('extraction-start-or-resume');
		expect(retry).toBeEnabled();
		expect(retry).toHaveTextContent('继续未完成批次');

		fireEvent.click(retry);
		await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });
		expect(stage).toHaveBeenCalledTimes(2);
	});

	it('preserves retry after an offline provider interruption', async () => {
		vi.spyOn(desktopBridge, 'getAiPreferences').mockResolvedValue({
			...DEFAULT_AI_PREFERENCES,
			defaultModelId: 'deepseek-chat'
		});
		vi.spyOn(desktopBridge, 'startAiGeneration').mockRejectedValue({
			code: 'network_unavailable',
			message: 'raw-provider-network-detail',
			retryable: true
		});
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await screen.findByText(/已规划 1 个章节/u);
		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));

		expect(await screen.findByText('network_unavailable', {}, { timeout: 8_000 }))
			.toBeInTheDocument();
		expect(screen.queryByText(/raw-provider-network-detail/u)).not.toBeInTheDocument();
		const retry = screen.getByTestId('extraction-start-or-resume');
		expect(retry).toBeEnabled();
		expect(retry).toHaveTextContent('继续未完成批次');
	}, 10_000);

	it('restores run history after restart before refreshing one stale chapter', async () => {
		const projectRoot = 'browser-fixture-history';
		const runStore = new ManuscriptExtractionRunStore(projectRoot, desktopBridge);
		const sourceFile = await desktopBridge.readText(projectRoot, chapters[0].path);
		const extractionSource = {
			resourceId: chapters[0].resourceId,
			title: chapters[0].title,
			sourceRevision: sourceFile.hash,
			content: sourceFile.content
		};
		await runStore.append(createManuscriptExtractionRun({
			instruction: 'Only explicit facts.',
			targetTypes: ['character'],
			sources: [extractionSource]
		}));
		const current = createManuscriptExtractionRun({
			instruction: 'Only explicit facts.',
			targetTypes: ['character'],
			sources: [extractionSource]
		});
		const staleRun: ManuscriptExtractionRun = {
			...current,
			status: 'stopped',
			chapters: current.chapters.map(chapter => ({
				...chapter,
				status: 'stale'
			}))
		};
		await runStore.append(staleRun);

		render(
			<ManuscriptExtractionCenterPage
				projectRoot={projectRoot}
				chapters={[chapters[0]]}
				activeChapterId={chapters[0]?.resourceId}
				runStore={runStore}
			/>
		);

		const history = await screen.findByTestId('extraction-run-history');
		expect(history.querySelectorAll('option').length).toBeGreaterThanOrEqual(2);
		expect(history).toHaveValue(staleRun.id);
		const refresh = await screen.findByTestId('extraction-refresh-stale-chapter');
		expect(refresh).toHaveAttribute('data-chapter-id', chapters[0]?.resourceId);
		fireEvent.click(refresh);
		expect(await screen.findByRole('status')).toHaveTextContent(
			'已使用最新正文重新计算该章节 Token，尚未发起 AI 请求。'
		);
		expect(screen.queryByTestId('extraction-refresh-stale-chapter'))
			.not.toBeInTheDocument();
	});

	it('blocks native generation during credential preflight cancellation', async () => {
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await waitFor(() => {
			expect(screen.getByTestId('extraction-start-or-resume')).toBeEnabled();
		});
		let resolvePreferences: (
			preferences: typeof DEFAULT_AI_PREFERENCES
		) => void = () => undefined;
		const heldPreferences = new Promise<typeof DEFAULT_AI_PREFERENCES>(resolve => {
			resolvePreferences = resolve;
		});
		const getAiPreferences = vi.spyOn(desktopBridge, 'getAiPreferences')
			.mockReturnValue(heldPreferences);
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => {
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'cancelled', jobId: request.jobId });
				return Promise.resolve();
			});
		const stopRunner = vi.spyOn(ManuscriptExtractionRunner.prototype, 'stop');

		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));
		await waitFor(() => expect(getAiPreferences).toHaveBeenCalledOnce());
		const stopButton = screen.getByTestId('extraction-stop');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				stopButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(stopRunner).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: '正在停止' })).toBeDisabled();
		resolvePreferences(DEFAULT_AI_PREFERENCES);
		await screen.findByText(/运行已结束/u);
		expect(startAiGeneration).not.toHaveBeenCalled();
	});

	it('keeps paid AI work hidden until explicit author confirmation', async () => {
		const onOpenEvidence = vi.fn();
		const openQuickCapture = vi.fn();
		useAppStore.setState({ openQuickCapture });
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
				onOpenEvidence={onOpenEvidence}
			/>
		);

		expect(screen.getByRole('radio', { name: '当前章' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		fireEvent.click(screen.getByTestId('extraction-plan'));
		await screen.findByText(/已规划 1 个章节/u);

		expect(screen.getByText(/创建计划不会调用 AI/u)).toBeInTheDocument();
		expect(screen.getByText(/只有点击“开始”或“继续”才会调用 DeepSeek/u)).toBeInTheDocument();
		expect(screen.getByTestId('extraction-start-or-resume')).toBeEnabled();

		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));
		await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });
		await waitFor(() => {
			expect(screen.getAllByText('AI 识别人物').length).toBeGreaterThan(0);
		});
		expect(screen.getAllByText('待作者确认').length).toBeGreaterThan(0);
		expect(screen.getByRole('heading', { name: '人物' })).toBeInTheDocument();
		expect(screen.getAllByTestId('extraction-candidate-evidence').length)
			.toBeGreaterThan(0);
		expect(screen.getAllByTestId('extraction-candidate-defer').length)
			.toBeGreaterThan(0);
		expect(screen.getAllByTestId('extraction-candidate-reject').length)
			.toBeGreaterThan(0);
		fireEvent.click(screen.getAllByTestId('extraction-candidate-evidence')[0]);
		expect(onOpenEvidence).toHaveBeenCalledWith(expect.objectContaining({
			resourceId: chapters[0]?.resourceId
		}));
		fireEvent.click(screen.getAllByTestId('extraction-candidate-defer')[0]);
		expect(openQuickCapture).toHaveBeenCalledWith(expect.objectContaining({
			chapterId: chapters[0]?.resourceId
		}));
		expect(screen.getByRole('status')).toHaveTextContent(
			'已填入“稍后整理”；保存速记后可继续处理当前候选。'
		);
		const candidateCheckboxes = screen.getAllByTestId('extraction-candidate-option');
		expect(candidateCheckboxes.every(element => (
			!(element as HTMLInputElement).checked
		))).toBe(true);
		const confirmable = candidateCheckboxes.find(element => (
			!(element as HTMLInputElement).disabled
		));
		expect(confirmable).toBeDefined();
		if (!confirmable) throw new Error('confirmableCandidateMissing');
		fireEvent.click(confirmable);
		fireEvent.click(screen.getByTestId('extraction-confirm-selected'));
		const undo = await screen.findByTestId('extraction-undo-confirmation');
		fireEvent.click(undo);
		await screen.findByText(/已撤销刚才的资料确认/u);
	});

	it('persists only explicitly selected reconciliation fields', async () => {
		const projectId = 'project-reconciliation';
		const gateway = new MemoryJourneyGateway(materializedJourney(projectId));
		const journeyStore = new CreationJourneyStore(
			'browser-fixture-reconciliation',
			projectId,
			gateway
		);
		const snapshot = vi.spyOn(desktopBridge, 'createSnapshot');
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture-reconciliation"
				projectId={projectId}
				chapters={[chapters[0]]}
				activeChapterId={chapters[0]?.resourceId}
				journeyStore={journeyStore}
			/>
		);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await screen.findByText(/已规划 1 个章节/u);
		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));

		await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });
		expect(await screen.findByRole('heading', { name: '计划与实际' }))
			.toBeInTheDocument();
		expect(screen.getByText('needs_review')).toBeInTheDocument();
		expect(screen.getByText('林越取得停摆时钟的维修单')).toBeInTheDocument();
		expect(screen.getByText('正文中的实际结果与原计划不同，等待作者确认。'))
			.toBeInTheDocument();
		expect(screen.getByTestId('extraction-reconciliation-evidence'))
			.toBeInTheDocument();
		expect(screen.getByTestId('extraction-reconciliation-select-outline-fields')).toBeEnabled();

		const outlineCheckbox = screen.getByTestId('extraction-reconciliation-field');
		expect(outlineCheckbox).toHaveAttribute('data-reconciliation-field', 'outcome');
		expect(outlineCheckbox).not.toBeChecked();
		const resourceCheckbox = screen.getAllByRole('checkbox').find(element => (
			element.getAttribute('aria-label')?.startsWith('选择 ')
			&& !(element as HTMLInputElement).disabled
		));
		expect(resourceCheckbox).toBeDefined();
		if (!resourceCheckbox) throw new Error('confirmableCandidateMissing');

		fireEvent.click(outlineCheckbox);
		fireEvent.click(resourceCheckbox);
		fireEvent.click(screen.getByTestId('extraction-confirm-selected'));
		await screen.findByText(/已批量确认 2 项/u);

		const reopened = await journeyStore.load();
		expect(reopened.state.outline.find(node => node.id === 'journey-outline:chapter-one'))
			.toMatchObject({
				outcome: '正文中的实际结果与原计划不同，等待作者确认。',
				source: 'extracted_from_draft',
				status: 'drafted',
				revision: 5
			});
		expect(snapshot).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await waitFor(() => {
			expect(screen.getByTestId('extraction-start-or-resume')).toBeEnabled();
		});
		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));
		expect(await screen.findByText(
			'正文与计划未发现明确差异',
			{},
			{ timeout: 8_000 }
		)).toBeInTheDocument();
	});

	it('opens evidence and keeps a reconciliation difference by pointer', async () => {
		const projectId = 'project-reconciliation-actions';
		const gateway = new MemoryJourneyGateway(materializedJourney(projectId));
		const journeyStore = new CreationJourneyStore(
			'browser-fixture-reconciliation-actions',
			projectId,
			gateway
		);
		const onOpenEvidence = vi.fn();
		const rendered = render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture-reconciliation-actions"
				projectId={projectId}
				chapters={[chapters[0]]}
				activeChapterId={chapters[0]?.resourceId}
				journeyStore={journeyStore}
				onOpenEvidence={onOpenEvidence}
			/>
		);

		fireEvent.click(screen.getByTestId('extraction-plan'));
		await screen.findByText(/已规划 1 个章节/u);
		fireEvent.click(screen.getByTestId('extraction-start-or-resume'));
		await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });

		fireEvent.click(screen.getByTestId('extraction-reconciliation-evidence'));
		fireEvent.click(screen.getByTestId('extraction-reconciliation-open-editor'));
		expect(onOpenEvidence).toHaveBeenCalledTimes(2);
		expect(screen.getByRole('status')).toHaveTextContent(
			'已定位正文差异；修改正文后，旧候选会自动变为 Stale。'
		);
		fireEvent.click(screen.getByTestId('extraction-reconciliation-defer'));
		expect(screen.getByRole('status')).toHaveTextContent(
			'差异保持待处理；正文与大纲均未修改。'
		);

		fireEvent.click(screen.getByTestId('extraction-reconciliation-keep-difference'));
		expect(await screen.findByRole('status')).toHaveTextContent(
			'已按作者决定保留正文与计划的差异；没有修改正文或大纲。'
		);
		expect(screen.getByText('已保留差异')).toBeInTheDocument();
		const reopened = await journeyStore.load();
		expect(reopened.state.outline.find(node => (
			node.id === 'journey-outline:chapter-one'
		))).toMatchObject({
			outcome: '林越取得停摆时钟的维修单',
			source: 'ai_generated',
			revision: 4
		});

		const readLatestText = desktopBridge.readText.bind(desktopBridge);
		rendered.unmount();
		vi.spyOn(desktopBridge, 'readText').mockImplementation(async (...args) => {
			const file = await readLatestText(...args);
			return args[1] === chapters[0]?.path
				? { ...file, hash: `${file.hash}-stale` }
				: file;
		});
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture-reconciliation-actions"
				projectId={projectId}
				chapters={[chapters[0]]}
				activeChapterId={chapters[0]?.resourceId}
				journeyStore={journeyStore}
				onOpenEvidence={onOpenEvidence}
			/>
		);

		const staleField = await screen.findByTestId('extraction-reconciliation-field');
		expect(staleField).toBeDisabled();
		expect((await screen.findAllByTestId('extraction-replan-stale-batch')).every(
			candidate => !(candidate as HTMLButtonElement).disabled
		)).toBe(true);
		const replan = (await screen.findAllByTestId(
			'extraction-reconciliation-replan-stale-batch'
		))[0];
		expect(replan).toBeDefined();
		if (!replan) throw new Error('staleReconciliationReplanMissing');
		expect(replan).toBeEnabled();
		fireEvent.click(replan);
		await waitFor(() => {
			const status = screen.queryByRole('status');
			const alert = screen.queryByRole('alert');
			if (!status && alert) throw new Error(`staleReplanFailed:${alert.textContent}`);
			expect(status).toHaveTextContent(
				'已按最新正文重新规划本章；尚未调用 AI，请确认 Token 后点击开始。'
			);
		});
	});
});
