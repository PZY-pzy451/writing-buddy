import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { countWords } from '@writing-buddy/domain';
import { App } from './App';
import { useAppStore } from './store';
import { aiGenerationStore } from '../features/ai/drawer/aiGenerationStore';
import { desktopBridge } from '../platform/bridge';
import { localDateKey } from '../features/progress/DailyWritingProgressModel';

function resetWorkspaceExperience(): void {
	localStorage.clear();
	aiGenerationStore.getState().close();
	useAppStore.setState({
		recentProjectRoot: undefined,
		recentProjectRoots: [],
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		writerSessions: {},
		documentViews: {},
		expandedTreeNodes: [],
		projectOpenError: undefined,
		pendingProjectRoot: undefined,
		projectOpenBusyAction: undefined,
		loading: false,
		error: undefined,
		projectWizardOpen: false,
		projectWizardStartRoute: undefined,
		chapterCreatorOpen: false,
		chapterCreateBusy: false,
		chapterStatusBusy: false,
		chapterExportBusy: false,
		chapterExportReceipts: [],
		writingProgress: {},
		recentlyClosedResources: [],
		activeMode: 'works',
		focusMode: false,
		sidebarOpen: true,
		sidebarWidth: 320,
		assistantOpen: true,
		writerTool: 'outline',
		writerToolPinned: false,
		sceneBarExpanded: true,
		manuscriptDensity: 'comfortable',
		assistantWidth: 360,
		dockOpen: true,
		dockHeight: 240
	});
}

async function openFixtureAndContinue(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	const recent = await screen.findByRole('navigation', { name: '最近作品' });
	await user.click(within(recent.parentElement as HTMLElement).getByRole(
		'button',
		{ name: '打开项目' }
	));
	await screen.findByRole('main', { name: '写作首页' });
	await user.click(screen.getByRole('button', { name: '继续上次位置' }));
	await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
}

describe('quiet writer workspaces', () => {
	beforeEach(resetWorkspaceExperience);

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('presents the five author tasks while keeping search and settings global', async () => {
		render(<App />);
		const navigation = await screen.findByRole('navigation', { name: '全局导航' });

		for (const label of ['写作', '规划', '故事库', '检查', '历史']) {
			expect(within(navigation).getByRole('button', { name: label })).toBeInTheDocument();
		}
		expect(within(navigation).queryByRole('button', { name: '作品' })).not.toBeInTheDocument();
		expect(within(navigation).queryByRole('button', { name: '审校' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '打开作者导航器' })).toBeInTheDocument();
		expect(within(navigation).queryByRole('button', { name: /AI/u })).not.toBeInTheDocument();
		expect(within(navigation).queryByRole('button', { name: '设置' })).not.toBeInTheDocument();
		await userEvent.setup().click(screen.getByRole('button', { name: '更多全局操作' }));
		expect(screen.getByRole('menuitem', { name: '设置' })).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: 'AI 连接测试' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '收起作品侧栏' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '展开写作助手' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '恢复当前工作区默认布局' })).not.toBeInTheDocument();
	});

	it('restores independent writing and planning layouts without changing the resource', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		const chapterId = useAppStore.getState().activeResource?.id;

		act(() => {
			useAppStore.getState().setSidebarWidth(408);
			if (useAppStore.getState().assistantOpen) {
				useAppStore.getState().toggleAssistant();
			}
		});
		await user.click(screen.getByRole('button', { name: '规划' }));
		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'planning',
			activeResourceId: chapterId,
			assistantOpen: false
		});
		expect(useAppStore.getState().sidebarWidth).not.toBe(408);

		act(() => {
			useAppStore.getState().setSidebarWidth(372);
			useAppStore.getState().toggleAssistant();
		});
		await user.click(screen.getByRole('button', { name: '写作' }));
		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'works',
			activeResourceId: chapterId,
			sidebarWidth: 408,
			assistantOpen: false
		});

		await user.click(screen.getByRole('button', { name: '规划' }));
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 372,
			assistantOpen: true
		});
		act(() => useAppStore.getState().resetWorkspaceLayout());
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 320,
			assistantOpen: false
		});
	});

	it('rehydrates manual writing layout changes before reopening the project', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		await user.click(screen.getByRole('button', { name: '规划' }));
		await user.click(screen.getByRole('button', { name: '写作' }));
		await user.click(screen.getByRole('button', { name: '更多写作操作' }));
		await user.click(screen.getByRole('menuitem', { name: '收起章节树' }));

		expect(useAppStore.getState().writerSessions['project-a11ce001']
			?.workspaceLayouts.writing.sidebarVisible).toBe(false);
		const persisted = localStorage.getItem('writing-buddy-next-workspace');
		expect(persisted).toContain('"sidebarVisible":false');

		act(() => {
			useAppStore.setState({
				writerSessions: {},
				sidebarOpen: true
			});
		});
		if (persisted) {
			localStorage.setItem('writing-buddy-next-workspace', persisted);
		}
		await act(async () => {
			await useAppStore.persist.rehydrate();
		});
		await act(async () => {
			await useAppStore.getState().openProject('browser-fixture');
		});

		expect(useAppStore.getState()).toMatchObject({
			sidebarOpen: false
		});
		expect(useAppStore.getState().writerSessions['project-a11ce001']
			?.workspaceLayouts.writing.sidebarVisible).toBe(false);
	});

	it('tracks net manuscript growth, reverses undo and persists the project goal', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		const initial = useAppStore.getState().session?.content ?? '';
		const expanded = `${initial}\n\n雨声越过空站台，林墨继续向前。`;
		const addedWords = countWords(expanded) - countWords(initial);
		const projectId = useAppStore.getState().snapshot?.project.projectId ?? '';

		act(() => useAppStore.getState().setContent(expanded));
		expect(useAppStore.getState().writingProgress[projectId]?.days).toContainEqual({
			date: localDateKey(),
			words: addedWords
		});
		expect(screen.getByRole('contentinfo', { name: '工作区状态' })).toHaveTextContent(
			`今日 ${addedWords} / 1,000 字`
		);

		act(() => useAppStore.getState().setContent(initial, 'undo'));
		expect(useAppStore.getState().writingProgress[projectId]?.days).toContainEqual({
			date: localDateKey(),
			words: 0
		});
		act(() => {
			useAppStore.getState().setContent(expanded, 'redo');
			expect(useAppStore.getState().setDailyWritingGoal(1_200)).toBe(true);
		});
		expect(useAppStore.getState().writingProgress[projectId]?.goal).toBe(1_200);
		expect(localStorage.getItem('writing-buddy-next-workspace')).toContain(
			'"writingProgress"'
		);
	});

	it('keeps the writing chrome quiet until the author asks for more tools', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		expect(useAppStore.getState()).toMatchObject({
			assistantOpen: false,
			dockOpen: false
		});
		const topBar = document.querySelector('.top-bar') as HTMLElement;
		expect(within(topBar).queryByRole('button', { name: '新建' })).not.toBeInTheDocument();
		expect(within(topBar).queryByRole('button', { name: 'AI 快速生成' })).not.toBeInTheDocument();
		expect(within(topBar).getByRole('button', { name: '专注模式' })).toBeInTheDocument();
		expect(within(topBar).getByRole('button', { name: '更多写作操作' })).toBeInTheDocument();

		await user.click(within(topBar).getByRole('button', { name: '更多写作操作' }));
		expect(screen.getByRole('menuitem', { name: 'AI 快速动作' })).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: '恢复写作布局' })).toBeInTheDocument();

		const status = screen.getByRole('contentinfo', { name: '工作区状态' });
		expect(within(status).getByText(/本章 \d+ 字/)).toBeInTheDocument();
		expect(within(status).getByText('已保存')).toBeInTheDocument();
		expect(within(status).queryByText('我的小说')).not.toBeInTheDocument();
	});

	it('keeps a stable four-item tool rail and switches one remembered panel on demand', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		const rail = screen.getByRole('navigation', { name: '写作工具' });
		for (const label of ['细纲', '资料', 'AI', '检查工具']) {
			expect(within(rail).getByRole('button', { name: label })).toBeInTheDocument();
		}
		expect(within(rail).queryByRole('button', { name: '人物' })).not.toBeInTheDocument();
		expect(screen.queryByRole('complementary', { name: '细纲工具' }))
			.not.toBeInTheDocument();

		await user.click(within(rail).getByRole('button', { name: '细纲' }));
		const outlinePanel = screen.getByRole('complementary', { name: '细纲工具' });
		expect(outlinePanel).toBeInTheDocument();
		expect(within(outlinePanel).queryByRole('tablist')).not.toBeInTheDocument();
		expect(useAppStore.getState()).toMatchObject({
			assistantOpen: true,
			writerTool: 'outline'
		});

		await user.click(within(rail).getByRole('button', { name: '检查工具' }));
		expect(screen.queryByRole('complementary', { name: '细纲工具' }))
			.not.toBeInTheDocument();
		expect(screen.getByRole('complementary', { name: '检查工具' }))
			.toBeInTheDocument();
		expect(useAppStore.getState().writerTool).toBe('review');

		await user.click(screen.getByRole('button', { name: '固定检查工具面板' }));
		expect(useAppStore.getState().writerToolPinned).toBe(true);
		await user.click(screen.getByRole('button', { name: '关闭检查工具面板' }));
		expect(screen.queryByRole('complementary', { name: '检查工具' }))
			.not.toBeInTheDocument();
		expect(screen.getByRole('navigation', { name: '写作工具' })).toBeInTheDocument();
		expect(localStorage.getItem('writing-buddy-next-workspace')).toContain(
			'"assistantTool":"review"'
		);
	});

	it('offers a low-weight contextual Continue at a paragraph end', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => {
			const session = useAppStore.getState().session;
			if (!session) throw new Error('writer session missing');
			useAppStore.setState({
				cursorOffset: session.content.length,
				selection: undefined
			});
		});

		const trigger = await screen.findByRole('button', {
			name: '从当前光标继续写作'
		});
		await user.click(trigger);

		expect(useAppStore.getState()).toMatchObject({
			assistantOpen: true,
			writerTool: 'ai',
			assistantIntent: {
				kind: 'continuation',
				mode: 'continue-paragraph'
			}
		});
		expect(screen.getByRole('complementary', { name: 'AI工具' }))
			.toBeInTheDocument();
	});

	it('opens the existing extraction center for the current chapter without starting AI', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		await user.click(screen.getByRole('button', { name: '更多章节操作' }));
		await user.click(screen.getByRole('menuitem', { name: '整理本章' }));

		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'references',
			storyView: 'extraction'
		});
		expect(await screen.findByRole('main', { name: 'AI 从正文整理中心' }))
			.toBeInTheDocument();
		expect(screen.getByRole('radio', { name: '当前章' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		expect(screen.getByText(/创建计划不会调用 AI/u)).toBeInTheDocument();
	});

	it('saves dirty prose before changing chapter status and updates publish readiness immediately', async () => {
		const user = userEvent.setup();
		const writeTextAtomic = vi.spyOn(desktopBridge, 'writeTextAtomic');
		let statusRevision = 0;
		const updateChapterStatus = vi.spyOn(desktopBridge, 'updateChapterStatus')
			.mockImplementation(request => {
				const snapshot = useAppStore.getState().snapshot;
				if (!snapshot) throw new Error('fixture snapshot missing');
				let updatedChapter = snapshot.project.volumes[0]?.chapters[0];
				const volumes = snapshot.project.volumes.map(volume => ({
					...volume,
					chapters: volume.chapters.map(chapter => {
						if (chapter.id !== request.chapterId) return chapter;
						updatedChapter = { ...chapter, status: request.status };
						return updatedChapter;
					})
				}));
				if (!updatedChapter) throw new Error('fixture chapter missing');
				return Promise.resolve({
					project: { ...snapshot.project, volumes },
					projectRevision: `status-revision-${++statusRevision}`,
					chapter: updatedChapter,
					description: '已将章节标记为已完成。'
				});
			});
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => useAppStore.getState().setContent('夜雨落下，林墨确认本章结尾。'));

		await user.click(screen.getByRole('button', { name: '章节状态：初稿' }));
		const statusMenu = screen.getByRole('menu', { name: '选择章节状态' });
		expect(within(statusMenu).getByText(/不会自动判断正文质量/u)).toBeInTheDocument();
		await user.click(within(statusMenu).getByRole('menuitemradio', { name: /已完成/u }));

		await waitFor(() => expect(updateChapterStatus).toHaveBeenCalledTimes(1));
		expect(writeTextAtomic).toHaveBeenCalledTimes(1);
		expect(writeTextAtomic.mock.invocationCallOrder[0]).toBeLessThan(
			updateChapterStatus.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
		);
		expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters[0]?.status)
			.toBe('completed');
		expect(screen.getByRole('button', { name: '章节状态：已完成' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '章节状态：已完成' }));
		await user.click(screen.getByRole('menuitemradio', { name: /修订中/u }));
		await waitFor(() => expect(updateChapterStatus).toHaveBeenCalledTimes(2));
		expect(screen.getByRole('button', { name: '章节状态：修订中' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '章节状态：修订中' }));
		await user.click(screen.getByRole('menuitemradio', { name: /已完成/u }));
		await waitFor(() => expect(updateChapterStatus).toHaveBeenCalledTimes(3));

		await user.click(screen.getByRole('button', { name: '检查' }));
		await user.click(await screen.findByRole('button', { name: /查看发布清单/u }));
		expect(screen.getByText(/2\/3 章尚未标记完成/u)).toBeInTheDocument();
	});

	it('does not change chapter status when dirty manuscript saving fails', async () => {
		const user = userEvent.setup();
		vi.spyOn(desktopBridge, 'writeTextAtomic').mockRejectedValue(new Error('offline'));
		const updateChapterStatus = vi.spyOn(desktopBridge, 'updateChapterStatus');
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => useAppStore.getState().setContent('尚未安全保存的章节结尾'));

		await user.click(screen.getByRole('button', { name: '章节状态：初稿' }));
		await user.click(screen.getByRole('menuitemradio', { name: /已完成/u }));

		expect(await screen.findByText('当前正文尚未安全保存，未修改章节状态。'))
			.toBeInTheDocument();
		expect(updateChapterStatus).not.toHaveBeenCalled();
		expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters[0]?.status)
			.toBe('draft');
	});

	it('shows chapter status without an edit control for read-only projects', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => {
			const snapshot = useAppStore.getState().snapshot;
			if (snapshot) useAppStore.setState({ snapshot: { ...snapshot, readOnly: true } });
		});

		expect(screen.queryByRole('button', { name: '章节状态：初稿' })).not.toBeInTheDocument();
		expect(screen.getByTitle('只读作品不能修改章节状态')).toHaveTextContent('初稿');
	});

	it('exports the active chapter from the writer menu and records a durable receipt', async () => {
		const user = userEvent.setup();
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs').mockResolvedValue(
			'D:\\Exports\\第一章 停摆的时钟.md'
		);
		render(<App />);
		await openFixtureAndContinue(user);

		await user.click(screen.getByRole('button', { name: '更多章节操作' }));
		await user.click(screen.getByRole('menuitem', { name: '导出章节' }));

		await waitFor(() => expect(saveTextAs).toHaveBeenCalledTimes(1));
		expect(saveTextAs.mock.calls[0]?.slice(3)).toEqual([
			'第一章 停摆的时钟.md',
			'markdown'
		]);
		expect(useAppStore.getState().chapterExportReceipts[0]).toMatchObject({
			chapterTitle: '第一章 停摆的时钟',
			format: 'markdown',
			destination: 'D:\\Exports\\第一章 停摆的时钟.md'
		});
		expect(await screen.findByText(/已导出《第一章 停摆的时钟》/u)).toBeInTheDocument();
		expect(localStorage.getItem('writing-buddy-next-workspace')).toContain(
			'第一章 停摆的时钟.md'
		);
	});

	it('does not export or create a receipt when dirty manuscript saving fails', async () => {
		const user = userEvent.setup();
		const writeTextAtomic = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValue(new Error('offline'));
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs');
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => useAppStore.getState().setContent('尚未安全写入的正文'));

		await user.click(screen.getByRole('button', { name: '更多章节操作' }));
		await user.click(screen.getByRole('menuitem', { name: '导出章节' }));

		await waitFor(() => expect(writeTextAtomic).toHaveBeenCalledTimes(1));
		expect(saveTextAs).not.toHaveBeenCalled();
		expect(useAppStore.getState().chapterExportReceipts).toHaveLength(0);
		expect(await screen.findByText('正文尚未安全保存，未执行导出。'))
			.toBeInTheDocument();
	});

	it('blocks whole-work export when the active manuscript cannot be saved safely', async () => {
		const user = userEvent.setup();
		const writeTextAtomic = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValue(new Error('offline'));
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs');
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => useAppStore.getState().setContent('尚未安全写入的整书正文'));

		let exported = true;
		await act(async () => {
			exported = await useAppStore.getState().exportWholeWork('markdown');
		});

		expect(exported).toBe(false);
		expect(writeTextAtomic).toHaveBeenCalledTimes(1);
		expect(saveTextAs).not.toHaveBeenCalled();
		expect(useAppStore.getState().chapterExportReceipts).toHaveLength(0);
		expect(await screen.findByText('正文尚未安全保存，未执行导出。'))
			.toBeInTheDocument();
	});

	it('offers Word and text exports in History without recording cancellation', async () => {
		const user = userEvent.setup();
		const saveDocxAs = vi.spyOn(desktopBridge, 'saveDocxAs')
			.mockResolvedValueOnce(undefined);
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs')
			.mockResolvedValueOnce('D:\\Exports\\第一章 停摆的时钟.txt');
		render(<App />);
		await openFixtureAndContinue(user);
		await user.click(screen.getByRole('button', { name: '历史' }));

		expect(await screen.findByRole('heading', { name: '历史与导出' })).toBeInTheDocument();
		expect(screen.getByText(/导出前自动保存当前原稿/u)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '导出 Word 文档' }));
		await waitFor(() => expect(saveDocxAs).toHaveBeenCalledTimes(1));
		expect(useAppStore.getState().chapterExportReceipts).toHaveLength(0);

		await user.click(screen.getByRole('button', { name: '当前章纯文本' }));
		await waitFor(() => expect(saveTextAs).toHaveBeenCalledTimes(1));
		expect(saveTextAs.mock.calls[0]?.slice(3)).toEqual([
			'第一章 停摆的时钟.txt',
			'plain-text'
		]);
		expect(await screen.findByRole('heading', { name: '最近导出' })).toBeInTheDocument();
		expect(screen.getByText('D:\\Exports\\第一章 停摆的时钟.txt')).toBeInTheDocument();
		expect(screen.getByText('纯文本')).toBeInTheDocument();
	});

	it('exports a structured Word work and records a Word delivery receipt', async () => {
		const user = userEvent.setup();
		const saveDocxAs = vi.spyOn(desktopBridge, 'saveDocxAs').mockResolvedValue(
			'D:\\Exports\\我的小说.docx'
		);
		render(<App />);
		await openFixtureAndContinue(user);
		await user.click(screen.getByRole('button', { name: '历史' }));

		await user.click(screen.getByRole('button', { name: '导出 Word 文档' }));

		await waitFor(() => expect(saveDocxAs).toHaveBeenCalledTimes(1));
		const [document, suggestedName] = saveDocxAs.mock.calls[0] ?? [];
		expect(suggestedName).toBe('我的小说.docx');
		expect(document).toMatchObject({
			title: '我的小说',
			volumes: [{
				title: '第一卷 灰城之下',
				chapters: [
					{ title: '第一章 停摆的时钟' },
					{ title: '第二章 迷路的旅人' }
				]
			}, {
				title: '第二卷 雾中来客',
				chapters: [
					{ title: '第三章 深夜的访客' }
				]
			}]
		});
		expect(useAppStore.getState().chapterExportReceipts[0]).toMatchObject({
			scope: 'work',
			chapterCount: 3,
			format: 'docx',
			destination: 'D:\\Exports\\我的小说.docx'
		});
		expect(screen.getByText('D:\\Exports\\我的小说.docx')).toBeInTheDocument();
	});

	it('exports the whole work in project order and records its delivery scope', async () => {
		const user = userEvent.setup();
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs').mockResolvedValue(
			'D:\\Exports\\我的小说.md'
		);
		render(<App />);
		await openFixtureAndContinue(user);
		await user.click(screen.getByRole('button', { name: '历史' }));

		expect(await screen.findByText(/3 章/u)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '作品 Markdown' }));

		await waitFor(() => expect(saveTextAs).toHaveBeenCalledTimes(1));
		const [content, eol, hasBom, suggestedName, format] = saveTextAs.mock.calls[0] ?? [];
		expect({ eol, hasBom, suggestedName, format }).toEqual({
			eol: 'lf',
			hasBom: false,
			suggestedName: '我的小说.md',
			format: 'markdown'
		});
		expect(content).toMatch(/^# 我的小说/u);
		expect(content).toContain('## 第一卷 灰城之下');
		expect(content).toContain('### 第一章 停摆的时钟');
		expect(content).toContain('### 第三章 深夜的访客');
		expect(content.indexOf('第一章 停摆的时钟')).toBeLessThan(
			content.indexOf('第三章 深夜的访客')
		);
		expect(useAppStore.getState().chapterExportReceipts[0]).toMatchObject({
			scope: 'work',
			title: '我的小说',
			chapterCount: 3,
			format: 'markdown',
			destination: 'D:\\Exports\\我的小说.md'
		});
		expect(await screen.findByText('整部作品')).toBeInTheDocument();
		expect(screen.getByText('D:\\Exports\\我的小说.md')).toBeInTheDocument();
	});

	it('creates and validates a portable project backup from History', async () => {
		const user = userEvent.setup();
		const createBackup = vi.spyOn(desktopBridge, 'createBackup');
		const inspectBackup = vi.spyOn(desktopBridge, 'inspectBackup');
		render(<App />);
		await openFixtureAndContinue(user);
		await user.click(screen.getByRole('button', { name: '历史' }));

		expect(await screen.findByRole('heading', { name: '项目便携备份' }))
			.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '创建备份' }));

		await waitFor(() => expect(createBackup).toHaveBeenCalledWith('browser-fixture'));
		await waitFor(() => expect(inspectBackup).toHaveBeenCalledWith(
			'browser-fixture.wbbackup'
		));
		expect(await screen.findByText(/备份已创建并校验/u)).toBeInTheDocument();
		expect(screen.getByText(/校验通过/u)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '恢复所选备份' })).toBeEnabled();
	});

	it('opens the Writer Navigator with Ctrl+K, previews without leaving and restores focus on Escape', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		const trigger = screen.getByRole('button', { name: '打开作者导航器' });
		trigger.focus();

		fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
		const input = await screen.findByRole('combobox', { name: '作者导航器' });
		expect(input).toHaveFocus();
		await user.type(input, '第二章');
		const option = await screen.findByRole('option', { name: /第二章/u });
		expect(option).toHaveAttribute('aria-selected', 'true');
		const chapterBeforePreview = useAppStore.getState().activeResourceId;

		fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
		expect(await screen.findByRole('complementary', { name: '结果预览' }))
			.toBeInTheDocument();
		expect(useAppStore.getState().activeResourceId).toBe(chapterBeforePreview);

		fireEvent.keyDown(input, { key: 'Escape' });
		await waitFor(() => expect(screen.queryByRole(
			'dialog',
			{ name: '作者导航器' }
		)).not.toBeInTheDocument());
		expect(trigger).toHaveFocus();
	});

	it('completes quick create, chapter create, AI and tab shortcuts with correct focus', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		const chapterButton = screen.getByRole('button', { name: '新建章节' });
		chapterButton.focus();

		fireEvent.keyDown(window, {
			key: 'n',
			code: 'KeyN',
			ctrlKey: true,
			shiftKey: true
		});
		const quickMenu = await screen.findByRole('menu', { name: '新建内容' });
		expect(within(quickMenu).getByRole('menuitem', { name: /新建项目/ })).toHaveFocus();
		fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
		await waitFor(() => expect(screen.queryByRole(
			'menu',
			{ name: '新建内容' }
		)).not.toBeInTheDocument());
		expect(chapterButton).toHaveFocus();

		fireEvent.keyDown(window, { key: 'a', code: 'KeyA', altKey: true });
		const aiDialog = await screen.findByRole('dialog', { name: 'AI 快速生成' });
		expect(within(aiDialog).getByText('一致性审查')).toBeInTheDocument();
		expect(within(aiDialog).getByText('等待开始')).toBeInTheDocument();
		await user.click(within(aiDialog).getByRole('button', { name: '关闭 AI 快速生成' }));
		expect(chapterButton).toHaveFocus();

		fireEvent.keyDown(window, { key: 'n', code: 'KeyN', ctrlKey: true });
		const dialog = await screen.findByRole('dialog', { name: '新建章节' });
		const title = within(dialog).getByRole('textbox', { name: '章节标题' });
		expect(title).toHaveFocus();
		await user.clear(title);
		await user.type(title, '快捷创建的章节');
		fireEvent.keyDown(title, { key: 'Enter', code: 'Enter', ctrlKey: true });
		await screen.findByRole('heading', { level: 1, name: '快捷创建的章节' });
		const createdId = useAppStore.getState().activeResource?.id;
		expect(createdId).toBeTruthy();
		expect(useAppStore.getState().tabs.length).toBeGreaterThanOrEqual(2);

		fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', ctrlKey: true });
		await waitFor(() => {
			expect(useAppStore.getState().activeResource?.id).not.toBe(createdId);
		});
		const switchedId = useAppStore.getState().activeResource?.id;
		const openCount = useAppStore.getState().tabs.length;
		fireEvent.keyDown(window, { key: 'w', code: 'KeyW', ctrlKey: true });
		await waitFor(() => {
			expect(useAppStore.getState().tabs).toHaveLength(openCount - 1);
		});
		expect(useAppStore.getState().recentlyClosedResources[0]?.id).toBe(switchedId);

		fireEvent.keyDown(window, {
			key: 't',
			code: 'KeyT',
			ctrlKey: true,
			shiftKey: true
		});
		await waitFor(() => {
			expect(useAppStore.getState().activeResource?.id).toBe(switchedId);
		});

		const tablist = screen.getByRole('tablist', { name: '已打开资源' });
		const activeTab = within(tablist).getAllByRole('tab')
			.find(tab => tab.getAttribute('aria-selected') === 'true');
		expect(activeTab).toBeDefined();
		activeTab?.focus();
		fireEvent.keyDown(activeTab as HTMLButtonElement, { key: 'ArrowLeft' });
		await waitFor(() => {
			expect(useAppStore.getState().activeResource?.id).not.toBe(switchedId);
		});
		expect(document.activeElement).toHaveAttribute('role', 'tab');
	});

	it('uses F11 and Escape for a temporary focus overlay without changing the normal layout', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => {
			useAppStore.getState().setSidebarWidth(396);
			if (!useAppStore.getState().assistantOpen) {
				useAppStore.getState().toggleAssistant();
			}
		});

		fireEvent.keyDown(window, { key: 'F11', code: 'F11' });
		await waitFor(() => expect(document.querySelector('.app-shell')).toHaveClass('is-focus-mode'));
		expect(screen.queryByRole('navigation', { name: '全局导航' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '退出专注' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 1, name: '第一章 停摆的时钟' })).toBeInTheDocument();
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 396,
			assistantOpen: true
		});

		fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
		await screen.findByRole('navigation', { name: '全局导航' });
		expect(document.querySelector('.app-shell')).not.toHaveClass('is-focus-mode');
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 396,
			assistantOpen: true
		});
		const persisted = localStorage.getItem('writing-buddy-next-workspace') ?? '';
		expect(persisted).not.toContain('"focusMode":true');
	});
});
