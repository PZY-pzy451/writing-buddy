import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	DEFAULT_AI_PREFERENCES,
	type AiGenerateRequest,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { flattenChapters } from '@writing-buddy/domain';
import { runLocalReview } from '@writing-buddy/review';
import { App } from '../../app/App';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { TaskDock } from '../../review/TaskDock';
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
		chapterExportReceipts: [],
		saveState: { type: 'clean', savedAt: '2026-08-02T08:00:00.000Z' },
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

async function openFixtureForTaskDock(user: ReturnType<typeof userEvent.setup>): Promise<{
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
}> {
	const view = render(<App />);
	await screen.findByRole('main', { name: '写作首页' });
	await user.click(screen.getByRole('button', { name: '继续上次位置' }));
	await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
	const state = useAppStore.getState();
	if (!state.snapshot || !state.activeResource || !state.session) {
		throw new Error('task dock fixture missing');
	}
	const fixture = {
		projectId: state.snapshot.project.projectId,
		resourceId: state.activeResource.id,
		content: state.session.content
	};
	view.unmount();
	return fixture;
}

describe('manual and AI review experience', () => {
	beforeEach(async () => {
		await desktopBridge.deleteDeepSeekKey();
		resetStores();
	});

	it('runs local review successfully offline without removing AI-origin issues from the same chapter', async () => {
		const paidGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
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
		const reviewModes = screen.getAllByTestId('review-mode-tab');
		expect(reviewModes.map(control => control.getAttribute('data-review-mode')).sort())
			.toEqual(['ai', 'manual']);
		await user.click(screen.getByRole('button', { name: /手动运行审校/ }));

		expect(await screen.findByText('重复标点')).toBeInTheDocument();
		expect(screen.getByText('多余空格')).toBeInTheDocument();
		expect(screen.getByText('AI 已有建议')).toBeInTheDocument();
		expect(useAppStore.getState().issues.filter(issue => issue.origin === 'local')).toHaveLength(2);
		expect(useAppStore.getState().issues.filter(issue => issue.origin === 'ai')).toHaveLength(1);
		expect(screen.getByText(/本地审校完成，发现 2 个问题/)).toBeInTheDocument();
		expect(paidGeneration).not.toHaveBeenCalled();
		paidGeneration.mockRestore();
	});

	it('opens the next affected chapter with keyboard focus from the project review inbox', async () => {
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
		nextTask.focus();
		expect(nextTask).toHaveFocus();
		await user.keyboard('{Enter}');

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

	it('shows an accessible publish checklist and routes final delivery to History', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });

		await user.click(screen.getByRole('button', { name: '检查' }));
		expect(await screen.findByRole('heading', { name: '发布前检查' }))
			.toBeInTheDocument();
		expect(screen.getByText('可以继续，但需作者确认')).toBeInTheDocument();
		expect(screen.queryByText('正文覆盖')).not.toBeInTheDocument();

		const checklistToggle = screen.getByTestId('publish-readiness-toggle');
		expect(checklistToggle).toHaveAccessibleName(/查看发布清单/);
		await user.click(checklistToggle);

		expect(screen.getByText('正文覆盖')).toBeInTheDocument();
		expect(screen.getByText('保存安全')).toBeInTheDocument();
		expect(screen.getByText('章节完成度')).toBeInTheDocument();
		expect(screen.getByText('项目完整性')).toBeInTheDocument();
		expect(screen.getByText('审校待办')).toBeInTheDocument();
		expect(screen.getByText('整书交付回执')).toBeInTheDocument();
		expect(screen.getByText(/不会运行 AI、修改正文或创建导出文件/u))
			.toBeInTheDocument();
		expect(screen.getAllByTestId('publish-readiness-action').some(control => (
			control.getAttribute('data-action-type') === 'history'
		))).toBe(true);

		await user.click(screen.getByRole('button', { name: /前往整书导出/ }));
		expect(await screen.findByRole('heading', { name: '历史与导出' }))
			.toBeInTheDocument();
	});

	it('persists an exact release candidate, invalidates it after a source change and undoes confirmation from History', async () => {
		const user = userEvent.setup();
		vi.spyOn(desktopBridge, 'saveDocxAs').mockResolvedValue('D:\\Exports\\我的小说.docx');
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });

		await act(async () => {
			expect(await useAppStore.getState().exportWholeWork('docx')).toBe(true);
		});
		expect(useAppStore.getState().chapterExportReceipts[0]?.sourceFingerprint)
			.toMatch(/^sha256:[0-9a-f]{64}$/u);

		await user.click(screen.getByRole('button', { name: '检查' }));
		expect(screen.queryByText(/已导出整部《我的小说》/u)).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /查看发布清单/ }));
		expect(screen.getAllByTestId('publish-readiness-action').some(control => (
			control.getAttribute('data-action-type') === 'confirm-delivery'
		))).toBe(true);
		expect(await screen.findByText(/请由作者确认它是否就是准备发布或提交的版本/u))
			.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /确认此交付版本/ }));
		await waitFor(() => expect(Number.isFinite(Date.parse(
			useAppStore.getState().chapterExportReceipts[0]?.confirmedAt ?? ''
		))).toBe(true));
		expect(await screen.findByText(/作者已确认这次Word整书导出作为发布版本/u))
			.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /查看交付记录/ })).toHaveFocus();

		const before = useAppStore.getState();
		const chapter = before.snapshot ? flattenChapters(before.snapshot.project)[0] : undefined;
		if (!chapter) throw new Error('delivery fingerprint chapter fixture missing');
		const wordCounts = before.snapshot?.wordCounts;
		const nextStatus = chapter.status === 'completed' ? 'revision' : 'completed';
		await act(async () => {
			expect(await useAppStore.getState().updateChapterStatus(chapter.id, nextStatus)).toBe(true);
		});

		expect(useAppStore.getState().snapshot?.wordCounts).toEqual(wordCounts);
		expect(await screen.findByText(/作者已确认的发布版本与当前项目结构或正文内容不再一致/u))
			.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /重新导出整书/ }));
		expect(await screen.findByRole('heading', { name: '最近导出' })).toBeInTheDocument();
		expect(screen.getByText('已确认发布版本')).toBeInTheDocument();
		expect(screen.getByText(/作者确认于/u)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '取消发布确认' }));
		expect(useAppStore.getState().chapterExportReceipts[0]?.confirmedAt).toBeUndefined();
		expect(screen.getByText('已取消《我的小说》的发布版本确认。')).toBeInTheDocument();
	});

	it('saves dirty prose from the publish blocker and recomputes the checklist', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });
		await user.click(screen.getByRole('button', { name: '继续上次位置' }));
		await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
		act(() => useAppStore.getState().setContent('夜雨落下，林墨继续向前。'));

		await user.click(screen.getByRole('button', { name: '检查' }));
		await user.click(screen.getByRole('button', { name: /查看发布清单/ }));
		expect(screen.getAllByTestId('publish-readiness-action').some(control => (
			control.getAttribute('data-action-type') === 'save'
		))).toBe(true);
		expect(screen.getByText('当前正文包含尚未写入项目的修改。'))
			.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /立即保存/ }));

		await waitFor(() => expect(useAppStore.getState().saveState.type).toBe('clean'));
		expect(screen.getByText('当前正文已经安全写入本地项目。'))
			.toBeInTheDocument();
	});

	it('opens the enabled exact review target from the publish checklist', async () => {
		const user = userEvent.setup();
		const reveal = vi.spyOn(useAppStore.getState(), 'requestEditorReveal');
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });
		const snapshot = useAppStore.getState().snapshot;
		const chapter = snapshot ? flattenChapters(snapshot.project)[0] : undefined;
		if (!snapshot || !chapter) throw new Error('publish review fixture missing');
		const reviewIssue = runLocalReview(
			snapshot.project.projectId,
			chapter.id,
			'夜雨落下。。'
		).issues[0];
		if (!reviewIssue) throw new Error('publish issue fixture missing');
		act(() => {
			useAppStore.setState({
				issues: [reviewIssue],
				dockOpen: true,
				dockTab: 'issues'
			});
		});
		render(<TaskDock />);
		const dockIssue = screen.getByTestId('task-dock-issue');
		expect(dockIssue).toHaveAttribute('data-issue-id', reviewIssue.id);
		expect(dockIssue).toBeEnabled();
		await user.click(dockIssue);

		await user.click(screen.getByRole('button', { name: '检查' }));
		await user.click(screen.getByRole('button', { name: /查看发布清单/ }));
		expect(screen.getAllByTestId('publish-readiness-action').some(control => (
			control.getAttribute('data-action-type') === 'review'
		))).toBe(true);
		await user.click(screen.getByRole('button', { name: /查看待办/ }));

		expect(await screen.findByRole('heading', { level: 1, name: chapter.title }))
			.toBeInTheDocument();
		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'works',
			writerTool: 'review',
			assistantOpen: true
		});
		expect(reveal).toHaveBeenCalledWith(chapter.id, reviewIssue.anchor.start);
	});

	it('TC-TASK-DOCK-001 renders visible enabled accessible visual contextual tabs and filters, hides nonmatching issues by pointer, moves keyboard focus and closes the dock', async () => {
		const user = userEvent.setup();
		const fixture = await openFixtureForTaskDock(user);
		const content = '夜雨落下。。  林墨推开门。';
		const reviewIssues = runLocalReview(
			fixture.projectId,
			fixture.resourceId,
			content
		).issues;
		if (reviewIssues.length < 2) throw new Error('task dock review issues missing');
		const ignoredIssue = {
			...reviewIssues[1],
			id: 'review:ignored-task-dock',
			status: 'ignored' as const
		};
		act(() => {
			useAppStore.getState().setContent(content);
			useAppStore.setState({
				issues: [...reviewIssues, ignoredIssue],
				dockOpen: true,
				dockTab: 'issues'
			});
		});
		const dock = render(<TaskDock />);

		const tabs = screen.getAllByTestId('task-dock-tab');
		expect(tabs.map(tab => tab.getAttribute('data-dock-tab'))).toEqual([
			'issues', 'inbox', 'diff', 'tasks', 'backups'
		]);
		for (const tab of tabs) expect(tab).toHaveAccessibleName();
		const filters = screen.getAllByTestId('task-dock-filter');
		expect(filters.map(filter => filter.getAttribute('data-issue-filter')))
			.toEqual(['all', 'warning', 'ignored']);
		expect(screen.getAllByTestId('task-dock-issue')).toHaveLength(3);

		await user.click(filters[1]);
		expect(screen.getAllByTestId('task-dock-issue')).toHaveLength(1);
		expect(screen.getByTestId('task-dock-issue'))
			.toHaveAttribute('data-issue-id', reviewIssues[0].id);
		await user.click(filters[2]);
		expect(screen.getAllByTestId('task-dock-issue')).toHaveLength(1);
		expect(screen.getByTestId('task-dock-issue'))
			.toHaveAttribute('data-issue-id', ignoredIssue.id);
		await user.click(filters[0]);
		expect(screen.getAllByTestId('task-dock-issue')).toHaveLength(3);

		await user.click(tabs[3]);
		expect(useAppStore.getState().dockTab).toBe('tasks');
		expect(tabs[3]).toHaveAttribute('aria-selected', 'true');
		const close = screen.getByTestId('task-dock-close');
		close.focus();
		expect(close).toHaveFocus();
		await user.keyboard('{Enter}');
		expect(useAppStore.getState().dockOpen).toBe(false);
		dock.unmount();
		expect(close).not.toHaveFocus();
	});

	it('TC-TASK-DOCK-002 deduplicates repeated accept actions, records one successful edit, blocks disabled actions, and restores accepted or ignored issues as undo', async () => {
		const user = userEvent.setup();
		const fixture = await openFixtureForTaskDock(user);
		const content = '夜雨落下。。';
		const issue = runLocalReview(fixture.projectId, fixture.resourceId, content).issues[0];
		if (!issue) throw new Error('task dock lifecycle issue missing');
		act(() => {
			useAppStore.getState().setContent(content);
			useAppStore.setState({ issues: [issue], dockOpen: true, dockTab: 'issues' });
		});
		const requestEditorEdit = vi.spyOn(useAppStore.getState(), 'requestEditorEdit').mockClear();
		render(<TaskDock />);

		const accept = screen.getByTestId('task-dock-accept');
		const ignore = screen.getByTestId('task-dock-ignore');
		const restore = screen.getByTestId('task-dock-restore');
		expect(accept).toBeEnabled();
		expect(ignore).toBeEnabled();
		expect(restore).toBeDisabled();
		act(() => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				accept.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
		});
		expect(requestEditorEdit).toHaveBeenCalledOnce();
		expect(useAppStore.getState().issues[0]?.status).toBe('accepted');
		expect(accept).toBeDisabled();

		act(() => useAppStore.getState().setContent('夜雨落下。'));
		await user.click(restore);
		expect(useAppStore.getState().issues[0]?.status).toBe('open');
		expect(useAppStore.getState().session?.content).toBe(content);
		await user.click(ignore);
		expect(useAppStore.getState().issues[0]?.status).toBe('ignored');
		await user.click(restore);
		expect(useAppStore.getState().issues[0]?.status).toBe('open');
	});

	it('TC-TASK-DOCK-003 renders contextual inbox controls disabled while loading and re-enables eligible controls when loading clears', async () => {
		const user = userEvent.setup();
		const fixture = await openFixtureForTaskDock(user);
		const capture = {
			id: 'capture:task-dock',
			projectId: fixture.projectId,
			type: 'idea',
			text: '让玻璃顶在终章再次出现',
			status: 'inbox',
			createdAt: '2026-08-06T08:00:00.000Z',
			updatedAt: '2026-08-06T08:00:00.000Z'
		} as const;
		void act(() => useAppStore.setState({
			quickCaptures: [capture],
			quickCaptureBusy: true,
			dockOpen: true,
			dockTab: 'inbox'
		}));
		render(<TaskDock />);

		const contextControls = [
			screen.getByTestId('task-dock-conversion-target'),
			screen.getByTestId('task-dock-convert'),
			screen.getByTestId('task-dock-jump-source'),
			screen.getByTestId('task-dock-defer'),
			screen.getByTestId('task-dock-dismiss')
		];
		for (const control of contextControls) {
			expect(control).toHaveAttribute('data-capture-id', capture.id);
			expect(control).toBeDisabled();
			expect(control).toHaveAccessibleName();
		}

		void act(() => useAppStore.setState({ quickCaptureBusy: false }));
		expect(screen.getByTestId('task-dock-conversion-target')).toBeEnabled();
		expect(screen.getByTestId('task-dock-convert')).toBeEnabled();
		expect(screen.getByTestId('task-dock-defer')).toBeEnabled();
		expect(screen.getByTestId('task-dock-dismiss')).toBeEnabled();
		expect(screen.getByTestId('task-dock-jump-source')).toBeDisabled();
		await user.selectOptions(screen.getByTestId('task-dock-conversion-target'), 'item');
		expect(screen.getByTestId('task-dock-conversion-target')).toHaveValue('item');
	});

	it('TC-TASK-DOCK-005 enforces read-only permission across every contextual control without blocking navigation', async () => {
		const user = userEvent.setup();
		const fixture = await openFixtureForTaskDock(user);
		const content = '夜雨落下。。';
		const openIssue = runLocalReview(fixture.projectId, fixture.resourceId, content).issues[0];
		if (!openIssue) throw new Error('task dock permission issue missing');
		const ignoredIssue = {
			...openIssue,
			id: 'review:read-only-ignored',
			status: 'ignored' as const
		};
		const capture = {
			id: 'capture:task-dock-read-only',
			projectId: fixture.projectId,
			type: 'idea',
			text: '只读模式仍允许定位这条记录的原文',
			chapterId: `chapter:${fixture.resourceId}`,
			anchor: openIssue.anchor,
			status: 'inbox',
			createdAt: '2026-08-06T08:00:00.000Z',
			updatedAt: '2026-08-06T08:00:00.000Z'
		} as const;
		const snapshot = useAppStore.getState().snapshot;
		if (!snapshot) throw new Error('task dock permission snapshot missing');
		act(() => {
			useAppStore.getState().setContent(content);
			useAppStore.setState({
				snapshot: { ...snapshot, readOnly: true },
				issues: [openIssue, ignoredIssue],
				quickCaptures: [capture],
				quickCaptureBusy: false,
				dockOpen: true,
				dockTab: 'issues'
			});
		});
		const requestEditorEdit = vi.spyOn(useAppStore.getState(), 'requestEditorEdit').mockClear();
		render(<TaskDock />);

		for (const control of [
			...screen.getAllByTestId('task-dock-tab'),
			...screen.getAllByTestId('task-dock-filter'),
			...screen.getAllByTestId('task-dock-issue'),
			screen.getByTestId('task-dock-close')
		]) expect(control).toBeEnabled();
		expect(screen.getByTestId('task-dock-accept')).toBeDisabled();
		expect(screen.getByTestId('task-dock-ignore')).toBeDisabled();
		await user.click(screen.getAllByTestId('task-dock-issue')[1]);
		expect(screen.getByTestId('task-dock-restore')).toBeDisabled();
		expect(requestEditorEdit).not.toHaveBeenCalled();

		const beforeCaptures = useAppStore.getState().quickCaptures;
		expect(await useAppStore.getState().setQuickCaptureStatus(capture.id, 'dismissed'))
			.toBe(false);
		expect(useAppStore.getState().quickCaptures).toEqual(beforeCaptures);
		await user.click(screen.getAllByTestId('task-dock-tab').find(control => (
			control.getAttribute('data-dock-tab') === 'inbox'
		))!);
		expect(screen.getByTestId('task-dock-conversion-target')).toBeDisabled();
		expect(screen.getByTestId('task-dock-convert')).toBeDisabled();
		expect(screen.getByTestId('task-dock-defer')).toBeDisabled();
		expect(screen.getByTestId('task-dock-dismiss')).toBeDisabled();
		expect(screen.getByTestId('task-dock-jump-source')).toBeEnabled();
	});

	it('streams and successfully applies a real-provider-shaped AI review while keeping suggestions author-confirmed', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob');
		await desktopBridge.saveDeepSeekKey('fixture-key');
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });
		await user.click(screen.getByRole('button', { name: '继续上次位置' }));
		await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
		await user.click(screen.getByRole('button', { name: '检查' }));
		const aiMode = screen.getAllByTestId('review-mode-tab').find(control => (
			control.getAttribute('data-review-mode') === 'ai'
		));
		expect(aiMode).toBeDefined();
		await user.click(aiMode!);
		await waitFor(() => expect(screen.getByRole('button', { name: /开始 AI 自动审校/ })).toBeEnabled());
		const start = screen.getByRole('button', { name: /开始 AI 自动审校/ });
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				start.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(await screen.findByText('AI 表达建议')).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(cancelAiJob).not.toHaveBeenCalled();
		expect(screen.getByText('AI')).toBeInTheDocument();
		expect(screen.getByText(/修改仍由作者确认/)).toBeInTheDocument();
		expect(useAppStore.getState().issues).toEqual(expect.arrayContaining([expect.objectContaining({
			origin: 'ai',
			status: 'open',
			ruleId: 'ai-chapter-review'
		})]));
		startAiGeneration.mockRestore();
		cancelAiJob.mockRestore();
	});

	it('deduplicates 100 review cancellations and isolates a late start failure', async () => {
		const jobs: Array<{
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
			reject: (reason: unknown) => void;
		}> = [];
		const cancellations: Array<(cancelled: boolean) => void> = [];
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => new Promise<void>((resolve, reject) => {
				jobs.push({ request, listener, resolve, reject });
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
			}));
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => new Promise<boolean>(resolve => cancellations.push(resolve)));
		const input = {
			projectId: 'project-review-race',
			resourceId: 'chapter:review-race',
			content: '雨停以后，旧桥下只剩一把伞。',
			preferences: DEFAULT_AI_PREFERENCES
		};

		const firstRun = useReviewAutomationStore.getState().run(input);
		await waitFor(() => expect(useReviewAutomationStore.getState().jobState).toBe('connecting'));
		const cancelAttempts = Array.from({ length: 100 }, () => (
			useReviewAutomationStore.getState().cancel()
		));
		expect(cancelAiJob).toHaveBeenCalledOnce();

		const first = jobs[0];
		if (!first) throw new Error('first review job missing');
		first.listener({ type: 'cancelled', jobId: first.request.jobId });
		await firstRun;
		const secondRun = useReviewAutomationStore.getState().run(input);
		await waitFor(() => expect(jobs).toHaveLength(2));
		const second = jobs[1];
		if (!second) throw new Error('second review job missing');

		first.reject(new Error('late failure from cancelled review'));
		await Promise.resolve();
		expect(useReviewAutomationStore.getState()).toMatchObject({
			jobId: second.request.jobId,
			jobState: 'connecting',
			error: undefined
		});
		cancellations[0]?.(true);
		await Promise.all(cancelAttempts);
		expect(useReviewAutomationStore.getState()).toMatchObject({
			jobId: second.request.jobId,
			jobState: 'connecting'
		});

		second.listener({
			type: 'content_delta',
			jobId: second.request.jobId,
			text: JSON.stringify({ issues: [] })
		});
		second.listener({ type: 'completed', jobId: second.request.jobId });
		second.resolve();
		await secondRun;
		expect(useReviewAutomationStore.getState().jobState).toBe('completed');
		startAiGeneration.mockRestore();
		cancelAiJob.mockRestore();
	});

	it('restarts review cancellation after a localized failure', async () => {
		let activeJob: {
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
		} | undefined;
		let resolveCancellation: ((cancelled: boolean) => void) | undefined;
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => new Promise<void>(resolve => {
				activeJob = { request, listener, resolve };
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
			}));
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockRejectedValueOnce(new Error('raw review cancellation detail'))
			.mockImplementationOnce(() => new Promise<boolean>(resolve => {
				resolveCancellation = resolve;
			}));
		const run = useReviewAutomationStore.getState().run({
			projectId: 'project-review-retry',
			resourceId: 'chapter:review-retry',
			content: '旧桥下只剩一把伞。',
			preferences: DEFAULT_AI_PREFERENCES
		});
		await waitFor(() => expect(useReviewAutomationStore.getState().jobState).toBe('connecting'));

		await useReviewAutomationStore.getState().cancel();
		expect(useReviewAutomationStore.getState()).toMatchObject({
			jobState: 'connecting',
			error: { message: 'AI 请求失败。' }
		});
		const retry = useReviewAutomationStore.getState().cancel();
		expect(cancelAiJob).toHaveBeenCalledTimes(2);
		if (!activeJob) throw new Error('review cancellation job missing');
		activeJob.listener({ type: 'cancelled', jobId: activeJob.request.jobId });
		resolveCancellation?.(true);
		await retry;
		activeJob.resolve();
		await run;
		expect(useReviewAutomationStore.getState()).toMatchObject({
			jobState: 'cancelled',
			error: undefined
		});
		startAiGeneration.mockRestore();
		cancelAiJob.mockRestore();
	});
});
