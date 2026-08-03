import type { TextFile } from '@writing-buddy/domain';
import type { AtomicWriteResult } from '@writing-buddy/platform-ports';
import {
	DEFAULT_AI_PREFERENCES,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { ManuscriptExtractionCenterPage } from './ManuscriptExtractionCenterPage';
import { ManuscriptExtractionRunner } from './ManuscriptExtractionCenterService';

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

describe('ManuscriptExtractionCenterPage', () => {
	beforeEach(async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture-key');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('TC-QA-AI-CANCEL-006 stops the runner and native job once for one hundred clicks', async () => {
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

		fireEvent.click(screen.getByRole('button', { name: '计算 Token 并创建批次' }));
		await screen.findByText(/已规划 1 个章节/u);
		fireEvent.click(screen.getByRole('button', { name: '开始逐章整理' }));
		const stopButton = await screen.findByRole('button', { name: '停止' });
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

	it('plans without AI, then runs only after explicit confirmation', async () => {
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		expect(screen.getByRole('radio', { name: '当前章' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		fireEvent.click(screen.getByRole('button', { name: '计算 Token 并创建批次' }));
		await screen.findByText(/已规划 1 个章节/u);

		expect(screen.getByText(/创建计划不会调用 AI/u)).toBeInTheDocument();
		expect(screen.getByText(/只有点击“开始”或“继续”才会调用 DeepSeek/u)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '开始逐章整理' })).toBeEnabled();

		fireEvent.click(screen.getByRole('button', { name: '开始逐章整理' }));
		await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });
		await waitFor(() => {
			expect(screen.getAllByText('AI 识别人物').length).toBeGreaterThan(0);
		});
		expect(screen.getAllByText('待作者确认').length).toBeGreaterThan(0);
		expect(screen.getByRole('heading', { name: '人物' })).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: '查看正文依据' }).length)
			.toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: '稍后整理' }).length)
			.toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: '拒绝候选' }).length)
			.toBeGreaterThan(0);
		const candidateCheckboxes = screen.getAllByRole('checkbox').filter(element => (
			element.getAttribute('aria-label')?.startsWith('选择 ')
		));
		expect(candidateCheckboxes.every(element => (
			!(element as HTMLInputElement).checked
		))).toBe(true);
		const confirmable = candidateCheckboxes.find(element => (
			!(element as HTMLInputElement).disabled
		));
		expect(confirmable).toBeDefined();
		if (!confirmable) throw new Error('confirmableCandidateMissing');
		fireEvent.click(confirmable);
		fireEvent.click(screen.getByRole('button', { name: /创建快照并批量确认 1/u }));
		const undo = await screen.findByRole('button', { name: '撤销资料确认' });
		fireEvent.click(undo);
		await screen.findByText(/已撤销刚才的资料确认/u);
	});

	it('compares a materialized chapter plan and batch-confirms only explicit outline fields', async () => {
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

		fireEvent.click(screen.getByRole('button', { name: '计算 Token 并创建批次' }));
		await screen.findByText(/已规划 1 个章节/u);
		fireEvent.click(screen.getByRole('button', { name: '开始逐章整理' }));

		await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });
		expect(await screen.findByRole('heading', { name: '计划与实际' }))
			.toBeInTheDocument();
		expect(screen.getByText('needs_review')).toBeInTheDocument();
		expect(screen.getByText('林越取得停摆时钟的维修单')).toBeInTheDocument();
		expect(screen.getByText('正文中的实际结果与原计划不同，等待作者确认。'))
			.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '查看 章节结果 正文依据' }))
			.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '更新大纲' })).toBeEnabled();

		const outlineCheckbox = screen.getByRole('checkbox', {
			name: '更新大纲字段 章节结果'
		});
		expect(outlineCheckbox).not.toBeChecked();
		const resourceCheckbox = screen.getAllByRole('checkbox').find(element => (
			element.getAttribute('aria-label')?.startsWith('选择 ')
			&& !(element as HTMLInputElement).disabled
		));
		expect(resourceCheckbox).toBeDefined();
		if (!resourceCheckbox) throw new Error('confirmableCandidateMissing');

		fireEvent.click(outlineCheckbox);
		fireEvent.click(resourceCheckbox);
		fireEvent.click(screen.getByRole('button', { name: /创建快照并批量确认 2/u }));
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

		fireEvent.click(screen.getByRole('button', { name: '计算 Token 并创建批次' }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: '开始逐章整理' })).toBeEnabled();
		});
		fireEvent.click(screen.getByRole('button', { name: '开始逐章整理' }));
		expect(await screen.findByText(
			'正文与计划未发现明确差异',
			{},
			{ timeout: 8_000 }
		)).toBeInTheDocument();
	});
});
