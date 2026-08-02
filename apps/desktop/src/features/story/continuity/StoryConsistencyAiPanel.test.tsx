import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

	it('runs one atomic whole-work pass and ignores a rapid duplicate click', async () => {
		const onCreated = vi.fn();
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
		const start = screen.getByRole('button', { name: '开始全书扫描' });
		fireEvent.click(start);
		fireEvent.click(start);

		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1), { timeout: 5_000 });
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
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps the existing explicit 2–12 chapter selection mode available', () => {
		render(
			<StoryConsistencyAiPanel
				projectId="project-a11ce001"
				projectRoot="browser-fixture"
				chapters={chapters}
				onClose={vi.fn()}
				onCreated={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('tab', { name: /自选章节/u }));
		expect(screen.getAllByRole('checkbox')).toHaveLength(2);
		expect(screen.getByRole('button', { name: '开始对照审查' })).toBeEnabled();
	});

	it('keeps the previous result set untouched when a later whole-work batch fails', async () => {
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

		fireEvent.click(screen.getByRole('button', { name: '开始全书扫描' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('未保存任何结果');
		expect(requestCount).toBe(2);
		expect(onCreated).not.toHaveBeenCalled();
	});
});
