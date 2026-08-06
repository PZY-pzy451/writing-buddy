import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import {
	StoryDashboardPage,
	type DashboardKernelLoad
} from './StoryDashboardPage';

const projectSnapshot: ProjectSnapshot = {
	root: 'D:/Writing Buddy Fixture',
	projectRevision: 'revision-dashboard-1',
	project: {
		schemaVersion: 1,
		projectId: 'project-dashboard',
		title: '雾港来信',
		volumes: [{
			id: 'volume-one',
			title: '第一卷',
			chapters: [{
				id: 'chapter-one',
				title: '第一章 雨夜',
				file: 'chapters/chapter-one.md',
				status: 'draft',
				targetWords: 3000,
				scene: {
					location: '旧车站',
					time: '23:17',
					pov: '林越',
					characters: ['林越'],
					goal: '找到遗失的笔记',
					note: ''
				}
			}, {
				id: 'chapter-two',
				title: 'Second chapter',
				file: 'chapters/chapter-two.md',
				status: 'draft',
				targetWords: 3000,
				scene: {
					location: 'North platform',
					time: '00:06',
					pov: 'Lin',
					characters: ['Lin'],
					goal: 'Continue the search',
					note: ''
				}
			}]
		}]
	},
	resources: [],
	wordCounts: { 'chapter-one': 1260, 'chapter-two': 420 },
	integrityIssues: [],
	readOnly: false
};

const emptyKernel: DashboardKernelLoad = {
	plotThreads: [],
	foreshadowing: [],
	pendingFacts: []
};
const originalOpenResource = useAppStore.getState().openResource;
const originalOpenCreationJourney = useAppStore.getState().openCreationJourney;

function setDashboardState(snapshot: ProjectSnapshot = projectSnapshot): void {
	useAppStore.setState({
		snapshot,
		activeResource: undefined,
		tabs: [],
		issues: [],
		writerSessions: {},
		writingProgress: {}
	});
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	useAppStore.setState({
		snapshot: undefined,
		activeResource: undefined,
		tabs: [],
		issues: [],
		writerSessions: {},
		writingProgress: {},
		openResource: originalOpenResource,
		openCreationJourney: originalOpenCreationJourney
	});
});

describe('StoryDashboardPage', () => {
	it('shows a bounded loading state while Story Kernel summaries are read', () => {
		setDashboardState();
		render(<StoryDashboardPage loadKernelData={() => new Promise(() => undefined)} />);

		expect(screen.getByRole('main', { name: '写作首页' })).toHaveAttribute('aria-busy', 'true');
		expect(screen.getAllByLabelText('正在加载').length).toBeGreaterThanOrEqual(3);
	});

	it('keeps the empty-project next step enabled and useful', async () => {
		setDashboardState({
			...projectSnapshot,
			project: { ...projectSnapshot.project, volumes: [] },
			wordCounts: {}
		});
		render(<StoryDashboardPage loadKernelData={() => Promise.resolve(emptyKernel)} />);

		const journeyAction = await screen.findByRole('button', { name: '根据题材规划故事' });
		expect(journeyAction).toBeEnabled();
		expect(screen.getByTestId('story-dashboard-creation-journey')).toBe(journeyAction);
		const nextStep = screen.getByRole('button', { name: '前往规划' });
		expect(screen.getByTestId('story-dashboard-next-step')).toBe(nextStep);
		expect(screen.getByText('建立可写的故事结构')).toBeInTheDocument();
		expect(screen.getByText('当前没有待处理问题')).toBeInTheDocument();
	});

	it('keeps healthy cards visible with localized failure feedback when a dashboard source rejects', async () => {
		const expectUsableFallback = async () => {
			expect(await screen.findByRole('status')).toHaveTextContent('部分故事资料暂时无法读取');
			expect(screen.getByRole('main', { name: '写作首页' })).toHaveAttribute('aria-busy', 'false');
			expect(await screen.findByText('当前章节')).toBeInTheDocument();
			expect(screen.getByText('下一步任务')).toBeInTheDocument();
			expect(screen.getByText('当前没有待处理问题')).toBeInTheDocument();
			expect(screen.queryByText(/private-project/u)).not.toBeInTheDocument();
		};

		setDashboardState();
		render(<StoryDashboardPage loadKernelData={() => {
			throw new Error('D:/private-project/story/dashboard.json');
		}} />);
		await expectUsableFallback();

		cleanup();
		setDashboardState();
		render(<StoryDashboardPage loadKernelData={() => (
			Promise.reject(new Error('D:/private-project/story/dashboard-promise.json'))
		)} />);
		await expectUsableFallback();
	});

	it('renders populated summaries with keyboard navigation and opens review by pointer', async () => {
		const openResource = vi.fn(() => Promise.resolve());
		useAppStore.setState({
			snapshot: projectSnapshot,
			activeResource: undefined,
			tabs: [],
			issues: [{
				id: 'issue-one',
				projectId: 'project-dashboard',
				resourceId: 'chapter-one',
				ruleId: 'continuity',
				severity: 'warning',
				status: 'open',
				title: '时间冲突',
				message: '人物同时出现在两处。',
				anchor: {
					start: 0,
					end: 2,
					before: '',
					target: '雨夜',
					after: '',
					sourceHash: '00000000'
				},
				createdAt: '2026-07-27T00:00:00.000Z',
				updatedAt: '2026-07-27T00:00:00.000Z',
				origin: 'local'
			}],
			openResource
		});
		render(
			<StoryDashboardPage
				loadKernelData={() => Promise.resolve({
					plotThreads: [{ id: 'plot-thread:main', title: '失踪笔记', tags: ['active'] }],
					foreshadowing: [{ id: 'foreshadowing:clock', title: '停摆时钟', tags: ['overdue'] }],
					pendingFacts: [{ id: 'information:station', title: '车站停运原因', tags: ['pending-confirmation'] }]
				})}
			/>
		);

		expect(await screen.findByText('找到遗失的笔记')).toBeInTheDocument();
		expect(screen.getByText('3 项待处理')).toBeInTheDocument();
		expect(screen.getAllByTestId('story-dashboard-recent-chapter')).toHaveLength(2);
		const continueButton = screen.getByRole('button', { name: '继续上次位置' });
		continueButton.focus();
		fireEvent.keyDown(continueButton, { key: 'Enter' });
		fireEvent.click(continueButton);
		await waitFor(() => expect(openResource).toHaveBeenCalled());
		fireEvent.click(screen.getByRole('button', { name: '打开审校中心' }));
		expect(useAppStore.getState().activeMode).toBe('review');
	});

	it('continues the persisted chapter and explains the restored writing position', async () => {
		const openResource = vi.fn(() => Promise.resolve());
		useAppStore.setState({
			snapshot: projectSnapshot,
			activeResource: undefined,
			tabs: [],
			issues: [],
			openResource,
			writerSessions: {
				'project-dashboard': {
					schemaVersion: 1,
					projectId: 'project-dashboard',
					activeWorkspace: 'writing',
					activeChapterId: 'chapter-two',
					activeSceneId: 'scene-two',
					activeResourceId: 'chapter-two',
					openTabs: [{ resourceId: 'chapter-two' }],
					cursor: {
						chapterId: 'chapter-two',
						line: 18,
						column: 4
					},
					scroll: {
						chapterId: 'chapter-two',
						scrollTop: 640
					},
					expandedTreeNodes: ['volume-one', 'references'],
					panelState: {
						projectSidebarWidth: 320,
						assistantWidth: 360,
						assistantVisible: false,
						inspectorVisible: false,
						sidebarVisible: true,
						dockHeight: 240,
						dockVisible: false
					},
					focusMode: false,
					updatedAt: '2026-07-28T14:41:00.000Z'
				}
			}
		} as never);
		render(<StoryDashboardPage loadKernelData={() => Promise.resolve(emptyKernel)} />);

		expect((await screen.findAllByText('Second chapter')).length).toBeGreaterThan(0);
		expect(screen.getByText(/第 18 段/)).toBeInTheDocument();
		expect(screen.getByText(/上次编辑/)).toBeInTheDocument();
		const continueButton = screen.getByRole('button', { name: '继续上次位置' });
		fireEvent.click(continueButton);
		await waitFor(() => expect(openResource).toHaveBeenCalledWith(expect.objectContaining({
			id: 'chapter-two'
		})));
	});

	it('opens the complete planning workspace by pointer after chapters are materialized', async () => {
		vi.spyOn(desktopBridge, 'readCreationJourneyState').mockResolvedValue({
			content: '{}',
			hash: 'journey-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		useAppStore.setState({
			snapshot: projectSnapshot,
			activeResource: undefined,
			tabs: [],
			issues: [],
			activeMode: 'works'
		});

		render(<StoryDashboardPage loadKernelData={() => Promise.resolve(emptyKernel)} />);

		const planningButton = await screen.findByRole('button', { name: '打开作品全貌' });
		fireEvent.click(planningButton);
		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'planning',
			storyView: 'creation-journey'
		});
	});
});
