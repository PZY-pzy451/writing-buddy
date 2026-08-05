import {
	DEFAULT_AI_PREFERENCES,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryRepository } from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { StoryConsistencyAiPanel } from './StoryConsistencyAiPanel';

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

describe('StoryConsistencyAiPanel', () => {
	beforeEach(async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture-key');
	});

	it('TC-STORY-CONSISTENCY-001 deduplicates one hundred repeated runs and publishes one successful atomic result', async () => {
		const onCreated = vi.fn();
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		render(
			<StoryConsistencyAiPanel
				projectId="project-a11ce001"
				projectRoot="browser-fixture"
				chapters={chapters}
				onClose={vi.fn()}
				onCreated={onCreated}
			/>
		);

		expect(onCreated).not.toHaveBeenCalled();
		expect(screen.getByRole('tab', { name: /全书扫描/u })).toHaveAttribute('aria-selected', 'true');
		const start = screen.getByTestId('story-consistency-run');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1), { timeout: 5_000 });
		expect(startAiGeneration).toHaveBeenCalledOnce();
		const [issues] = onCreated.mock.calls[0] as [readonly {
			readonly severity: string;
			readonly replacement?: string;
			readonly relatedEvidence?: readonly unknown[];
			readonly storyFact?: unknown;
		}[]];
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			severity: 'warning',
			relatedEvidence: [{ label: '证据 A' }, { label: '证据 B' }]
		});
		expect(issues[0]).not.toHaveProperty('replacement');
		expect(await screen.findByText(/2 个正文章节、1 批/u)).toBeInTheDocument();
	});

	it('TC-QA-AI-CANCEL-005 deduplicates one hundred stop clicks, disables pending cancellation and reports cancelled', async () => {
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
		render(
			<StoryConsistencyAiPanel
				projectId="project-a11ce001"
				projectRoot="browser-fixture"
				chapters={chapters}
				onClose={vi.fn()}
				onCreated={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByTestId('story-consistency-run'));
		const stopButton = await screen.findByTestId('story-consistency-stop');
		await waitFor(() => expect(startAiGeneration).toHaveBeenCalledOnce());
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				stopButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(cancelAiJob).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: '正在停止' })).toBeDisabled();
		resolveCancellation(true);
		const [request] = startAiGeneration.mock.calls[0];
		await act(async () => {
			emitEvent({ type: 'cancelled', jobId: request.jobId });
			await Promise.resolve();
		});
		expect(await screen.findByRole('alert')).toHaveTextContent('全书扫描已停止');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('TC-STORY-CONSISTENCY-003 keeps enabled keyboard focus, caps selected chapters at twelve and releases disabled choices', () => {
		const selectionChapters = Array.from({ length: 13 }, (_, index) => ({
			resourceId: `chapter:selection-${index + 1}`,
			chapterId: `selection-${index + 1}`,
			title: `选择章节 ${index + 1}`,
			path: `chapters/selection-${index + 1}.md`,
			narrativeOrder: index,
			volumeId: 'volume-selection',
			volumeTitle: '选择卷'
		}));
		render(
			<StoryConsistencyAiPanel
				projectId="project-a11ce001"
				projectRoot="browser-fixture"
				chapters={selectionChapters}
				onClose={vi.fn()}
				onCreated={vi.fn()}
			/>
		);

		const wholeScope = screen.getByTestId('story-consistency-scope-whole');
		const selectedScope = screen.getByTestId('story-consistency-scope-selected');
		fireEvent.click(selectedScope);
		const chapterControls = screen.getAllByTestId('story-consistency-chapter');
		expect(chapterControls).toHaveLength(13);
		for (let index = 2; index < 12; index += 1) fireEvent.click(chapterControls[index]);
		expect(chapterControls[12]).toBeDisabled();
		fireEvent.click(chapterControls[0]);
		expect(chapterControls[12]).toBeEnabled();

		const controls = [
			screen.getByRole('button', { name: '关闭 AI 对照审查' }),
			wholeScope,
			selectedScope,
			chapterControls[12],
			screen.getByTestId('story-consistency-instruction'),
			screen.getByTestId('story-consistency-run')
		];
		for (const control of controls) {
			expect(control).toBeVisible();
			expect(control).toBeEnabled();
			control.focus();
			expect(control).toHaveFocus();
		}
	});

	it('TC-STORY-CONSISTENCY-004 rejects a failed later batch without persistence and succeeds on full restart', async () => {
		const extendedChapters = Array.from({ length: 13 }, (_, index) => ({
			resourceId: `chapter:chapter-${index + 1}`,
			chapterId: `chapter-${index + 1}`,
			title: `第 ${index + 1} 章`,
			path: `chapters/chapter-${index + 1}.md`,
			narrativeOrder: index,
			volumeId: 'volume-one',
			volumeTitle: '第一卷'
		}));
		vi.spyOn(desktopBridge, 'readText').mockImplementation((_root, path) => Promise.resolve({
			content: `${path} 的正文。人物继续推进调查。`,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false,
			hash: `hash-${path}`
		}));
		const originalStart = desktopBridge.startAiGeneration.bind(desktopBridge);
		let requestCount = 0;
		vi.spyOn(desktopBridge, 'startAiGeneration').mockImplementation(async (request, listener) => {
			requestCount += 1;
			if (requestCount === 2) throw new Error('network_unavailable');
			await originalStart(request, listener);
		});
		const onCreated = vi.fn();
		const repository = {
			list: () => Promise.resolve([])
		} as unknown as StoryRepository;
		render(
			<StoryConsistencyAiPanel
				projectId="project-a11ce001"
				projectRoot="browser-fixture"
				chapters={extendedChapters}
				repository={repository}
				onClose={vi.fn()}
				onCreated={onCreated}
			/>
		);

		const start = screen.getByTestId('story-consistency-run');
		fireEvent.click(start);

		expect(await screen.findByRole('alert')).toHaveTextContent('未保存任何结果');
		expect(requestCount).toBe(2);
		expect(onCreated).not.toHaveBeenCalled();
		expect(start).toBeEnabled();
		fireEvent.click(start);

		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1), { timeout: 5_000 });
		expect(requestCount).toBe(4);
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
