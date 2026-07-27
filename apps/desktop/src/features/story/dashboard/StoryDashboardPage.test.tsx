import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import {
	StoryDashboardPage,
	type DashboardKernelLoad
} from './StoryDashboardPage';

const projectSnapshot: ProjectSnapshot = {
	root: 'D:/Writing Buddy Fixture',
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
			}]
		}]
	},
	resources: [],
	wordCounts: { 'chapter-one': 1260 },
	integrityIssues: [],
	readOnly: false
};

const emptyKernel: DashboardKernelLoad = {
	plotThreads: [],
	foreshadowing: [],
	pendingFacts: []
};
const originalOpenResource = useAppStore.getState().openResource;

function setDashboardState(snapshot: ProjectSnapshot = projectSnapshot): void {
	useAppStore.setState({
		snapshot,
		activeResource: undefined,
		tabs: [],
		issues: []
	});
}

afterEach(() => {
	vi.restoreAllMocks();
	useAppStore.setState({
		snapshot: undefined,
		activeResource: undefined,
		tabs: [],
		issues: [],
		openResource: originalOpenResource
	});
});

describe('StoryDashboardPage', () => {
	it('shows a bounded loading state while Story Kernel summaries are read', () => {
		setDashboardState();
		render(<StoryDashboardPage loadKernelData={() => new Promise(() => undefined)} />);

		expect(screen.getByRole('main', { name: '作品仪表盘' })).toHaveAttribute('aria-busy', 'true');
		expect(screen.getAllByLabelText('正在加载').length).toBeGreaterThanOrEqual(3);
	});

	it('gives useful next steps for an empty project', async () => {
		setDashboardState({
			...projectSnapshot,
			project: { ...projectSnapshot.project, volumes: [] },
			wordCounts: {}
		});
		render(<StoryDashboardPage loadKernelData={() => Promise.resolve(emptyKernel)} />);

		expect(await screen.findByRole('button', { name: '创建第一章' })).toBeEnabled();
		expect(screen.getByText('还没有活跃剧情线')).toBeInTheDocument();
		expect(screen.getByText('当前没有待处理问题')).toBeInTheDocument();
	});

	it('keeps healthy cards visible when one dashboard source fails', async () => {
		setDashboardState();
		render(
			<StoryDashboardPage
				loadKernelData={() => Promise.resolve({
					...emptyKernel,
					plotError: 'storyReadFailed'
				})}
			/>
		);

		expect(await screen.findByText('剧情线暂时无法读取')).toBeInTheDocument();
		expect(screen.getByText('今日目标')).toBeInTheDocument();
		expect(screen.getByText('当前没有待处理问题')).toBeInTheDocument();
	});

	it('renders populated summaries and keyboard-usable card navigation', async () => {
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

		expect(await screen.findByText('失踪笔记')).toBeInTheDocument();
		expect(screen.getByText('3 项待处理')).toBeInTheDocument();
		const continueButton = screen.getByRole('button', { name: '继续写作' });
		continueButton.focus();
		fireEvent.keyDown(continueButton, { key: 'Enter' });
		fireEvent.click(continueButton);
		await waitFor(() => expect(openResource).toHaveBeenCalled());
	});
});
