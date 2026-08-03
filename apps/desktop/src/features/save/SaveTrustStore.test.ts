import type { AtomicWriteResult, ProjectSnapshot } from '@writing-buddy/platform-ports';
import { desktopBridge } from '../../platform/bridge';
import { useAppStore } from '../../app/store';

function resetStore(): void {
	localStorage.clear();
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
		loading: false,
		error: undefined,
		externalConflict: undefined,
		saveState: { type: 'clean', savedAt: '2026-07-29T11:00:00.000Z' },
		closeProtectionOpen: false
	});
}

function firstChapter(snapshot: ProjectSnapshot) {
	return chapterAt(snapshot, 0);
}

function chapterAt(snapshot: ProjectSnapshot, index: number) {
	const chapter = snapshot.project.volumes.flatMap(volume => volume.chapters)[index];
	if (!chapter) throw new Error('missing browser chapter fixture');
	return {
		id: chapter.id,
		type: 'chapter' as const,
		title: chapter.title,
		path: chapter.file,
		projectId: snapshot.project.projectId
	};
}

async function openChapter(): Promise<ProjectSnapshot> {
	await useAppStore.getState().openProject('browser-fixture');
	const snapshot = useAppStore.getState().snapshot;
	if (!snapshot) throw new Error('browser fixture failed to open');
	await useAppStore.getState().openResource(firstChapter(snapshot));
	return snapshot;
}

describe('save trust store integration', () => {
	beforeEach(resetStore);

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('shows saving and keeps newer edits dirty when the sent payload completes', async () => {
		await openChapter();
		useAppStore.getState().setContent('发送到磁盘的版本');
		let finishWrite: ((result: AtomicWriteResult) => void) | undefined;
		vi.spyOn(desktopBridge, 'writeTextAtomic').mockImplementationOnce(() => (
			new Promise(resolve => { finishWrite = resolve; })
		));

		const saving = useAppStore.getState().save();
		expect(useAppStore.getState().saveState.type).toBe('saving');
		useAppStore.getState().setContent('写入期间继续输入的版本');
		finishWrite?.({
			hash: 'saved-hash',
			modifiedAt: '2026-07-29T11:02:00.000Z',
			byteLength: 30
		});
		await saving;

		expect(useAppStore.getState().saveState).toEqual({ type: 'dirty' });
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
		expect(useAppStore.getState().session?.originalContent).toBe('发送到磁盘的版本');
	});

	it('queues an explicit save pressed while an earlier write is still running', async () => {
		await openChapter();
		useAppStore.getState().setContent('第一次保存');
		let finishFirstWrite: ((result: AtomicWriteResult) => void) | undefined;
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockImplementationOnce(() => new Promise(resolve => { finishFirstWrite = resolve; }))
			.mockResolvedValueOnce({
				hash: 'second-hash',
				modifiedAt: '2026-07-29T11:03:00.000Z',
				byteLength: 24
			});

		const firstSave = useAppStore.getState().save();
		useAppStore.getState().setContent('保存期间输入并再次保存');
		const queuedSave = useAppStore.getState().save();
		finishFirstWrite?.({
			hash: 'first-hash',
			modifiedAt: '2026-07-29T11:02:30.000Z',
			byteLength: 18
		});
		await Promise.all([firstSave, queuedSave]);

		expect(write).toHaveBeenCalledTimes(2);
		expect(write.mock.calls[1]?.[0]).toMatchObject({
			content: '保存期间输入并再次保存',
			expectedHash: 'first-hash'
		});
		expect(useAppStore.getState().saveState).toEqual({
			type: 'clean',
			savedAt: '2026-07-29T11:03:00.000Z'
		});
	});

	it('keeps a persistent safe failure and clears it after a successful retry', async () => {
		await openChapter();
		useAppStore.getState().setContent('需要恢复的正文');
		vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValueOnce(new Error('writeFailed:C:\\private\\novel.md'))
			.mockResolvedValueOnce({
				hash: 'retry-hash',
				modifiedAt: '2026-07-29T11:04:00.000Z',
				byteLength: 24
			});

		await useAppStore.getState().save();
		expect(useAppStore.getState()).toMatchObject({
			saveState: {
				type: 'failed',
				errorCode: 'writeFailed',
				retryable: true
			},
			error: undefined
		});

		await useAppStore.getState().save();
		expect(useAppStore.getState().saveState).toEqual({
			type: 'clean',
			savedAt: '2026-07-29T11:04:00.000Z'
		});
	});

	it('allows a clean close and opens protection for unsaved content', async () => {
		await openChapter();
		expect(useAppStore.getState().requestCloseProtection()).toBe(true);

		useAppStore.getState().setContent('尚未保存的退出测试');
		expect(useAppStore.getState().requestCloseProtection()).toBe(false);
		expect(useAppStore.getState().closeProtectionOpen).toBe(true);
	});

	it('keeps a dirty active chapter intact under 100 same-tick reopen actions', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		useAppStore.getState().setContent('当前章节尚未保存的正文');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');
		const read = vi.spyOn(desktopBridge, 'readText');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openResource(active)
		)));

		expect(write).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().session?.content).toBe('当前章节尚未保存的正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('saves once and reads once when 100 same-tick actions switch a dirty chapter', async () => {
		const snapshot = await openChapter();
		const target = chapterAt(snapshot, 1);
		useAppStore.getState().setContent('切换前需要安全保存的正文');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');
		const read = vi.spyOn(desktopBridge, 'readText');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openResource(target)
		)));

		expect(write).toHaveBeenCalledTimes(1);
		expect(read).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().activeResource?.id).toBe(target.id);
		expect(useAppStore.getState().session?.state.resourceId).toBe(target.id);
		expect(useAppStore.getState().session?.state.dirty).toBe(false);
	});

	it('keeps the current dirty chapter when saving before a switch fails under pressure', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		const target = chapterAt(snapshot, 1);
		useAppStore.getState().setContent('保存失败后必须保留的正文');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValueOnce(new Error('writeFailed:C:\\private\\chapter.md'));
		const read = vi.spyOn(desktopBridge, 'readText');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openResource(target)
		)));

		expect(write).toHaveBeenCalledTimes(1);
		expect(read).not.toHaveBeenCalled();
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().session?.content).toBe('保存失败后必须保留的正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('keeps the latest chapter intent when an earlier read completes late', async () => {
		const snapshot = await openChapter();
		const second = chapterAt(snapshot, 1);
		const third = chapterAt(snapshot, 2);
		let finishSecondRead: ((result: Awaited<ReturnType<typeof desktopBridge.readText>>) => void)
			| undefined;
		const read = vi.spyOn(desktopBridge, 'readText')
			.mockImplementationOnce(() => new Promise(resolve => { finishSecondRead = resolve; }));

		const secondOpen = useAppStore.getState().openResource(second);
		await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
		const latestOpens = Array.from({ length: 100 }, () => (
			useAppStore.getState().openResource(third)
		));
		finishSecondRead?.({
			content: '过期的第二章内容',
			hash: 'second-stale-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		await Promise.all([secondOpen, ...latestOpens]);

		expect(read).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().activeResource?.id).toBe(third.id);
		expect(useAppStore.getState().session?.state.resourceId).toBe(third.id);
		expect(useAppStore.getState().session?.content).not.toBe('过期的第二章内容');
	});

	it('does not activate a chapter whose manuscript read failed 100 times', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		const target = chapterAt(snapshot, 1);
		const originalContent = useAppStore.getState().session?.content;
		const read = vi.spyOn(desktopBridge, 'readText')
			.mockRejectedValue(new Error('readFailed:C:\\private\\chapter.md'));

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openResource(target)
		)));

		expect(read).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().session?.state.resourceId).toBe(active.id);
		expect(useAppStore.getState().session?.content).toBe(originalContent);
		expect(useAppStore.getState().error).toBe('无法打开该资源，请重试。');
	});

	it('protects text entered while the target chapter is still loading', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		const target = chapterAt(snapshot, 1);
		let finishTargetRead: ((result: Awaited<ReturnType<typeof desktopBridge.readText>>) => void)
			| undefined;
		const read = vi.spyOn(desktopBridge, 'readText')
			.mockImplementationOnce(() => new Promise(resolve => { finishTargetRead = resolve; }));
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValueOnce(new Error('writeFailed:C:\\private\\chapter.md'));

		const opening = useAppStore.getState().openResource(target);
		await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
		useAppStore.getState().setContent('章节加载期间继续输入的正文');
		finishTargetRead?.({
			content: '目标章节正文',
			hash: 'target-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		await opening;

		expect(write).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().session?.content).toBe('章节加载期间继续输入的正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
		expect(useAppStore.getState().error).toBe('当前正文尚未安全保存，未切换资源。');
	});

	it('asks once and preserves a dirty tab under 100 cancelled close actions', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		useAppStore.getState().setContent('取消关闭后必须继续保留的正文');
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');
		const read = vi.spyOn(desktopBridge, 'readText');

		Array.from({ length: 100 }, () => (
			useAppStore.getState().closeResource(active.id)
		));

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(write).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().tabs.map(tab => tab.id)).toContain(active.id);
		expect(useAppStore.getState().session?.content).toBe('取消关闭后必须继续保留的正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('discards instead of saving and opens the next tab once under 100 accepted closes', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		const next = chapterAt(snapshot, 1);
		await useAppStore.getState().openResource(next);
		await useAppStore.getState().openResource(active);
		useAppStore.getState().setContent('作者已经明确选择放弃的正文');
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');
		const read = vi.spyOn(desktopBridge, 'readText');

		Array.from({ length: 100 }, () => (
			useAppStore.getState().closeResource(active.id)
		));

		await vi.waitFor(() => expect(useAppStore.getState().activeResource?.id).toBe(next.id));
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(write).not.toHaveBeenCalled();
		expect(read).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().tabs.map(tab => tab.id)).not.toContain(active.id);
		expect(useAppStore.getState().session?.state.resourceId).toBe(next.id);
	});

	it('coalesces 100 save-copy actions into one native save dialog', async () => {
		await openChapter();
		useAppStore.getState().setContent('需要另存副本保护的正文');
		const completions: Array<(path: string | undefined) => void> = [];
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs').mockImplementation(() => (
			new Promise(resolve => { completions.push(resolve); })
		));

		const saves = Array.from({ length: 100 }, () => useAppStore.getState().saveAs());

		expect(saveTextAs).toHaveBeenCalledTimes(1);
		completions[0]?.('D:\\Exports\\关闭前副本.md');
		expect(await Promise.all(saves)).toEqual(Array.from({ length: 100 }, () => true));
	});

	it('releases a cancelled close for one later explicit retry', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		useAppStore.getState().setContent('第一次取消后仍可再次决定的正文');
		const confirm = vi.spyOn(window, 'confirm')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(true);
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');

		useAppStore.getState().closeResource(active.id);
		await Promise.resolve();
		useAppStore.getState().closeResource(active.id);

		expect(confirm).toHaveBeenCalledTimes(2);
		expect(write).not.toHaveBeenCalled();
		expect(useAppStore.getState().tabs.map(tab => tab.id)).not.toContain(active.id);
		expect(useAppStore.getState().activeResource).toBeUndefined();
		expect(useAppStore.getState().session).toBeUndefined();
	});

	it('never leaves a closed chapter active when the next tab cannot be read', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		const next = chapterAt(snapshot, 1);
		await useAppStore.getState().openResource(next);
		await useAppStore.getState().openResource(active);
		const read = vi.spyOn(desktopBridge, 'readText')
			.mockRejectedValueOnce(new Error('readFailed:C:\\private\\chapter.md'));

		useAppStore.getState().closeResource(active.id);

		await vi.waitFor(() => expect(useAppStore.getState().error).toBe('无法打开该资源，请重试。'));
		expect(read).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().tabs.map(tab => tab.id)).not.toContain(active.id);
		expect(useAppStore.getState().tabs.map(tab => tab.id)).toContain(next.id);
		expect(useAppStore.getState().activeResource).toBeUndefined();
		expect(useAppStore.getState().session).toBeUndefined();
		expect(useAppStore.getState().recentlyClosedResources[0]?.id).toBe(active.id);
	});

	it('closes a background tab under pressure without disturbing the dirty active draft', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		const background = chapterAt(snapshot, 1);
		await useAppStore.getState().openResource(background);
		await useAppStore.getState().openResource(active);
		useAppStore.getState().setContent('关闭后台标签时不能碰到的当前正文');
		const confirm = vi.spyOn(window, 'confirm');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');
		const read = vi.spyOn(desktopBridge, 'readText');

		Array.from({ length: 100 }, () => (
			useAppStore.getState().closeResource(background.id)
		));

		expect(confirm).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
		expect(useAppStore.getState().tabs.map(tab => tab.id)).not.toContain(background.id);
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().session?.content).toBe('关闭后台标签时不能碰到的当前正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('releases a cancelled save-copy action for one explicit retry', async () => {
		await openChapter();
		useAppStore.getState().setContent('另存取消后仍然保留的正文');
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs')
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce('D:\\Exports\\重试副本.md');

		expect(await useAppStore.getState().saveAs()).toBe(false);
		expect(await useAppStore.getState().saveAs()).toBe(true);

		expect(saveTextAs).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().session?.content).toBe('另存取消后仍然保留的正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});
});
