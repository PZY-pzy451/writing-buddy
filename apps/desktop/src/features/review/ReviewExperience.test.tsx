import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { flattenChapters } from '@writing-buddy/domain';
import { runLocalReview } from '@writing-buddy/review';
import { App } from '../../app/App';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { useAiStore } from '../ai/stores/aiStore';
import { useReviewAutomationStore } from './stores/reviewAutomationStore';

function resetStores(): void {
	localStorage.clear();
	useAppStore.setState({
		recentProjectRoot: 'browser-fixture',
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		activeMode: 'works',
		issues: [],
		error: undefined,
		projectOpenError: undefined,
		pendingProjectRoot: undefined,
		projectOpenBusyAction: undefined,
		loading: false,
		dockOpen: true,
		contextualCreateIntent: undefined
	});
	useAiStore.setState({
		initialized: false,
		loading: false,
		status: undefined,
		preferences: DEFAULT_AI_PREFERENCES,
		models: [],
		balance: undefined,
		usageSummary: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 },
		prompt: '',
		output: '',
		jobId: undefined,
		jobState: 'created',
		jobUsage: undefined,
		startedAt: undefined,
		durationMs: undefined,
		partial: false,
		error: undefined
	});
	useReviewAutomationStore.setState({
		jobId: undefined,
		jobState: 'created',
		usage: undefined,
		startedAt: undefined,
		durationMs: undefined,
		error: undefined
	});
}

describe('manual and AI review experience', () => {
	beforeEach(async () => {
		await desktopBridge.deleteDeepSeekKey();
		resetStores();
	});

	it('runs local review without removing AI-origin issues from the same chapter', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });
		await user.click(screen.getByRole('button', { name: '继续上次位置' }));
		await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
		act(() => useAppStore.getState().setContent('夜雨落下。。  林墨推开门。'));
		const state = useAppStore.getState();
		const localFixture = state.snapshot && state.activeResource && state.session
			? runLocalReview(state.snapshot.project.projectId, state.activeResource.id, state.session.content).issues[0]
			: undefined;
		if (!localFixture) {
			throw new Error('review fixture missing');
		}
		act(() => {
			useAppStore.setState({
				issues: [{ ...localFixture, id: 'ai-existing', title: 'AI 已有建议', origin: 'ai' }]
			});
		});
		await user.click(screen.getByRole('button', { name: '检查' }));
		await user.click(screen.getByRole('button', { name: /手动运行审校/ }));

		expect(await screen.findByText('重复标点')).toBeInTheDocument();
		expect(screen.getByText('多余空格')).toBeInTheDocument();
		expect(screen.getByText('AI 已有建议')).toBeInTheDocument();
		expect(useAppStore.getState().issues.filter(issue => issue.origin === 'local')).toHaveLength(2);
		expect(useAppStore.getState().issues.filter(issue => issue.origin === 'ai')).toHaveLength(1);
		expect(screen.getByText(/本地审校完成，发现 2 个问题/)).toBeInTheDocument();
	});

	it('opens the next affected chapter directly from the project review inbox', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });
		const snapshot = useAppStore.getState().snapshot;
		const chapter = snapshot ? flattenChapters(snapshot.project)[0] : undefined;
		if (!snapshot || !chapter) throw new Error('review chapter fixture missing');
		const issue = runLocalReview(snapshot.project.projectId, chapter.id, '夜雨落下。。').issues[0];
		if (!issue) throw new Error('review issue fixture missing');
		await act(() => useAppStore.setState({ issues: [issue] }));

		await user.click(screen.getByRole('button', { name: '检查' }));
		expect(await screen.findByRole('heading', { name: '项目待处理事项' })).toBeInTheDocument();
		const nextTask = screen.getByRole('button', { name: /打开下一项.*第一章/ });
		await user.click(nextTask);

		await waitFor(() => expect(useAppStore.getState().activeResource?.id).toBe(chapter.id));
		expect(await screen.findByText('重复标点')).toBeInTheDocument();
		expect(screen.getByText(`当前章节：${chapter.title}`)).toBeInTheDocument();
	});

	it('opens whole-work consistency directly from the primary Check page', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });

		await user.click(screen.getByRole('button', { name: '检查' }));
		expect(await screen.findByRole('heading', { name: '全书一致性' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '打开全书扫描' }));

		expect(await screen.findByRole('main', { name: '长篇一致性审查' })).toBeInTheDocument();
		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'planning',
			storyView: 'continuity'
		});
	});

	it('streams a real-provider-shaped AI review and keeps suggestions author-confirmed', async () => {
		await desktopBridge.saveDeepSeekKey('fixture-key');
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });
		await user.click(screen.getByRole('button', { name: '继续上次位置' }));
		await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
		await user.click(screen.getByRole('button', { name: '检查' }));
		await user.click(screen.getByRole('tab', { name: /AI 自动审校/ }));
		await waitFor(() => expect(screen.getByRole('button', { name: /开始 AI 自动审校/ })).toBeEnabled());
		await user.click(screen.getByRole('button', { name: /开始 AI 自动审校/ }));

		expect(await screen.findByText('AI 表达建议')).toBeInTheDocument();
		expect(screen.getByText('AI')).toBeInTheDocument();
		expect(screen.getByText(/修改仍由作者确认/)).toBeInTheDocument();
		expect(useAppStore.getState().issues).toEqual(expect.arrayContaining([expect.objectContaining({
			origin: 'ai',
			status: 'open',
			ruleId: 'ai-chapter-review'
		})]));
	});
});
