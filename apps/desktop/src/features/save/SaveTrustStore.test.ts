import type {
	AtomicWriteResult,
	ProjectSnapshot
} from '@writing-buddy/platform-ports';
import type { TextFile } from '@writing-buddy/domain';
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

const fixtureStoryReference = {
	type: 'character' as const,
	id: 'character:lin-mo'
};

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

	it('coalesces 100 waiting save calls into one follow-up write for a newer edit', async () => {
		await openChapter();
		useAppStore.getState().setContent('first payload');
		let finishFirstWrite: ((result: AtomicWriteResult) => void) | undefined;
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockImplementationOnce(() => new Promise(resolve => { finishFirstWrite = resolve; }))
			.mockResolvedValueOnce({
				hash: 'coalesced-follow-up-hash',
				modifiedAt: '2026-08-04T10:01:00.000Z',
				byteLength: 24
			});

		const firstSave = useAppStore.getState().save();
		useAppStore.getState().setContent('newer payload');
		const waitingSaves = Array.from({ length: 100 }, () => (
			useAppStore.getState().save()
		));
		finishFirstWrite?.({
			hash: 'coalesced-first-hash',
			modifiedAt: '2026-08-04T10:00:00.000Z',
			byteLength: 20
		});
		await Promise.all([firstSave, ...waitingSaves]);

		expect(write).toHaveBeenCalledTimes(2);
		expect(write.mock.calls[1]?.[0]).toMatchObject({
			content: 'newer payload',
			expectedHash: 'coalesced-first-hash'
		});
		expect(useAppStore.getState().saveState).toEqual({
			type: 'clean',
			savedAt: '2026-08-04T10:01:00.000Z'
		});
	});

	it('does not convert 100 same-tick save calls into hidden retries after a failure', async () => {
		await openChapter();
		useAppStore.getState().setContent('must remain available after an offline save');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValue(new Error('networkOffline:C:\\private\\chapter.md'));

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().save()
		)));

		expect(write).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().saveState).toEqual({
			type: 'offline',
			pendingChanges: 1
		});
		expect(useAppStore.getState().session?.state.dirty).toBe(true);

		write.mockResolvedValueOnce({
			hash: 'explicit-retry-hash',
			modifiedAt: '2026-08-04T10:02:00.000Z',
			byteLength: 46
		});
		await useAppStore.getState().save();

		expect(write).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().saveState).toEqual({
			type: 'clean',
			savedAt: '2026-08-04T10:02:00.000Z'
		});
	});

	it('does not retry a non-retryable save failure for waiting callers', async () => {
		await openChapter();
		useAppStore.getState().setContent('permission failure must require a new decision');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValue(new Error('accessDenied:C:\\private\\chapter.md'));

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().save()
		)));

		expect(write).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().saveState).toEqual({
			type: 'failed',
			errorCode: 'accessDenied',
			retryable: false
		});
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('does not start normal-save retries when an active force-save fails', async () => {
		await openChapter();
		useAppStore.getState().setContent('force-save failure must remain one author intent');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValue(new Error('accessDenied:C:\\private\\chapter.md'));

		const forceSave = useAppStore.getState().forceSave();
		const waitingSaves = Array.from({ length: 100 }, () => (
			useAppStore.getState().save()
		));
		const [forceSaved] = await Promise.all([forceSave, ...waitingSaves]);

		expect(forceSaved).toBe(false);
		expect(write).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().saveState).toEqual({
			type: 'failed',
			errorCode: 'accessDenied',
			retryable: false
		});
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('ignores a late save failure after the author switches projects', async () => {
		const firstSnapshot = await openChapter();
		useAppStore.getState().setContent('old project draft');
		let failOldWrite: ((error: Error) => void) | undefined;
		vi.spyOn(desktopBridge, 'writeTextAtomic').mockImplementationOnce(() => (
			new Promise((_, reject) => { failOldWrite = reject; })
		));
		const oldSave = useAppStore.getState().save();
		const secondSnapshot: ProjectSnapshot = {
			...firstSnapshot,
			root: 'browser-fixture-second-project',
			project: {
				...firstSnapshot.project,
				projectId: 'project-second-save-lifecycle',
				title: 'Second project'
			}
		};
		vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
		vi.spyOn(desktopBridge, 'openProject').mockResolvedValueOnce(secondSnapshot);

		await useAppStore.getState().openProject(secondSnapshot.root);
		await useAppStore.getState().openResource(firstChapter(secondSnapshot));
		expect(useAppStore.getState().saveState.type).toBe('clean');
		failOldWrite?.(new Error('networkOffline:C:\\private\\old-project.md'));
		await oldSave;

		expect(useAppStore.getState().snapshot?.project.projectId)
			.toBe(secondSnapshot.project.projectId);
		expect(useAppStore.getState().activeResource?.projectId)
			.toBe(secondSnapshot.project.projectId);
		expect(useAppStore.getState().saveState.type).toBe('clean');
	});

	it('does not apply a late save receipt to a same-id chapter in another project', async () => {
		const firstSnapshot = await openChapter();
		useAppStore.getState().setContent('old project payload');
		let finishOldWrite: ((result: AtomicWriteResult) => void) | undefined;
		vi.spyOn(desktopBridge, 'writeTextAtomic').mockImplementationOnce(() => (
			new Promise(resolve => { finishOldWrite = resolve; })
		));
		const oldSave = useAppStore.getState().save();
		const secondSnapshot: ProjectSnapshot = {
			...firstSnapshot,
			root: 'browser-fixture-same-chapter-id',
			project: {
				...firstSnapshot.project,
				projectId: 'project-same-chapter-id',
				title: 'Same chapter id project'
			}
		};
		vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
		vi.spyOn(desktopBridge, 'openProject').mockResolvedValueOnce(secondSnapshot);

		await useAppStore.getState().openProject(secondSnapshot.root);
		await useAppStore.getState().openResource(firstChapter(secondSnapshot));
		const secondBaseline = useAppStore.getState().session?.originalContent;
		const secondDiskHash = useAppStore.getState().session?.state.diskHash;
		useAppStore.getState().setContent('new project draft');
		finishOldWrite?.({
			hash: 'old-project-late-hash',
			modifiedAt: '2026-08-04T10:03:00.000Z',
			byteLength: 19
		});
		await oldSave;

		expect(useAppStore.getState().session?.content).toBe('new project draft');
		expect(useAppStore.getState().session?.originalContent).toBe(secondBaseline);
		expect(useAppStore.getState().session?.state.diskHash).toBe(secondDiskHash);
		expect(useAppStore.getState().saveState).toEqual({ type: 'dirty' });
	});

	it('does not reveal an old-project conflict after its delayed disk read', async () => {
		const firstSnapshot = await openChapter();
		useAppStore.getState().setContent('old project conflict payload');
		vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValueOnce(new Error('externalChange:old-project'));
		const originalReadText = desktopBridge.readText.bind(desktopBridge);
		let finishOldDiskRead: ((file: TextFile) => void) | undefined;
		const read = vi.spyOn(desktopBridge, 'readText')
			.mockImplementationOnce(() => new Promise(resolve => { finishOldDiskRead = resolve; }))
			.mockImplementation((root, path) => originalReadText(root, path));
		const oldSave = useAppStore.getState().save();
		await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
		const secondSnapshot: ProjectSnapshot = {
			...firstSnapshot,
			root: 'browser-fixture-after-conflict',
			project: {
				...firstSnapshot.project,
				projectId: 'project-after-conflict',
				title: 'Project after conflict'
			}
		};
		vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
		vi.spyOn(desktopBridge, 'openProject').mockResolvedValueOnce(secondSnapshot);

		await useAppStore.getState().openProject(secondSnapshot.root);
		await useAppStore.getState().openResource(firstChapter(secondSnapshot));
		finishOldDiskRead?.({
			content: 'old project disk content',
			hash: 'old-project-disk-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		await oldSave;

		expect(useAppStore.getState().externalConflict).toBeUndefined();
		expect(useAppStore.getState().saveState.type).toBe('clean');
		expect(useAppStore.getState().snapshot?.project.projectId)
			.toBe(secondSnapshot.project.projectId);
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

	it('coalesces 100 external-change checks into one disk read and one conflict', async () => {
		await openChapter();
		useAppStore.getState().setContent('必须保留的本地正文');
		let finishRead: ((file: TextFile) => void) | undefined;
		const read = vi.spyOn(desktopBridge, 'readText').mockImplementationOnce(() => (
			new Promise(resolve => { finishRead = resolve; })
		));

		const checks = Array.from({ length: 100 }, () => (
			useAppStore.getState().verifyExternalChange()
		));
		expect(read).toHaveBeenCalledTimes(1);
		finishRead?.({
			content: '磁盘上的外部版本',
			hash: 'external-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		await Promise.all(checks);

		expect(read).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().externalConflict?.disk.content)
			.toBe('磁盘上的外部版本');
		expect(useAppStore.getState().session?.content).toBe('必须保留的本地正文');
	});

	it('ignores a delayed disk check from the chapter the author already left', async () => {
		const snapshot = await openChapter();
		const previous = firstChapter(snapshot);
		const target = chapterAt(snapshot, 1);
		const targetFile = await desktopBridge.readText(snapshot.root, target.path);
		let finishPreviousRead: ((file: TextFile) => void) | undefined;
		const read = vi.spyOn(desktopBridge, 'readText')
			.mockImplementationOnce(() => new Promise(resolve => { finishPreviousRead = resolve; }))
			.mockResolvedValueOnce(targetFile);

		const checking = useAppStore.getState().verifyExternalChange();
		await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
		await useAppStore.getState().openResource(target);
		finishPreviousRead?.({
			content: '旧章节迟到的磁盘版本',
			hash: 'previous-external-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		await checking;

		expect(useAppStore.getState().activeResource?.id).toBe(target.id);
		expect(useAppStore.getState().session?.state.resourceId).toBe(target.id);
		expect(useAppStore.getState().session?.content).toBe(targetFile.content);
		expect(useAppStore.getState().session?.state.resourceId).not.toBe(previous.id);
		expect(useAppStore.getState().externalConflict).toBeUndefined();
	});

	it('does not revive a stale conflict after a newer save completes', async () => {
		const snapshot = await openChapter();
		const chapter = firstChapter(snapshot);
		const staleDisk = await desktopBridge.readText(snapshot.root, chapter.path);
		let finishRead: ((file: TextFile) => void) | undefined;
		vi.spyOn(desktopBridge, 'readText').mockImplementationOnce(() => (
			new Promise(resolve => { finishRead = resolve; })
		));
		vi.spyOn(desktopBridge, 'writeTextAtomic').mockResolvedValueOnce({
			hash: 'newer-saved-hash',
			modifiedAt: '2026-08-03T21:10:00.000Z',
			byteLength: 30
		});

		const checking = useAppStore.getState().verifyExternalChange();
		useAppStore.getState().setContent('校验期间已经安全保存的新正文');
		await useAppStore.getState().save();
		finishRead?.({
			...staleDisk,
			content: '保存完成前读取到的旧外部正文',
			hash: 'external-before-save-hash'
		});
		await checking;

		expect(useAppStore.getState().externalConflict).toBeUndefined();
		expect(useAppStore.getState().session?.content)
			.toBe('校验期间已经安全保存的新正文');
		expect(useAppStore.getState().session?.state.diskHash).toBe('newer-saved-hash');
		expect(useAppStore.getState().session?.state.dirty).toBe(false);
	});

	it('coalesces 100 explicit overwrites and releases a failure for retry', async () => {
		await openChapter();
		useAppStore.getState().setContent('作者明确选择覆盖的正文');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockResolvedValue({
				hash: 'forced-hash',
				modifiedAt: '2026-08-03T21:11:00.000Z',
				byteLength: 30
			});

		const overwrites = Array.from({ length: 100 }, () => (
			useAppStore.getState().forceSave()
		));
		expect(await Promise.all(overwrites))
			.toEqual(Array.from({ length: 100 }, () => true));
		expect(write).toHaveBeenCalledTimes(1);

		useAppStore.getState().setContent('失败后重试的正文');
		write.mockRejectedValueOnce(new Error('writeFailed:C:\\private\\chapter.md'))
			.mockResolvedValueOnce({
				hash: 'retry-forced-hash',
				modifiedAt: '2026-08-03T21:12:00.000Z',
				byteLength: 24
			});
		expect(await useAppStore.getState().forceSave()).toBe(false);
		expect(await useAppStore.getState().forceSave()).toBe(true);
		expect(write).toHaveBeenCalledTimes(3);
	});

	it('serializes an explicit overwrite and then writes edits made in flight', async () => {
		await openChapter();
		useAppStore.getState().setContent('第一次明确覆盖的正文');
		let finishFirstWrite: ((result: AtomicWriteResult) => void) | undefined;
		let firstFinished = false;
		let secondStartedBeforeFirstFinished = false;
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockImplementationOnce(() => new Promise(resolve => { finishFirstWrite = resolve; }))
			.mockImplementationOnce(() => {
				secondStartedBeforeFirstFinished = !firstFinished;
				return Promise.resolve({
					hash: 'second-force-hash',
					modifiedAt: '2026-08-03T21:14:00.000Z',
					byteLength: 36
				});
			});

		const first = useAppStore.getState().forceSave();
		useAppStore.getState().setContent('覆盖期间继续输入的最新正文');
		const second = useAppStore.getState().forceSave();
		firstFinished = true;
		finishFirstWrite?.({
			hash: 'first-force-hash',
			modifiedAt: '2026-08-03T21:13:00.000Z',
			byteLength: 30
		});
		expect(await Promise.all([first, second])).toEqual([true, true]);

		expect(secondStartedBeforeFirstFinished).toBe(false);
		expect(write).toHaveBeenCalledTimes(2);
		expect(write.mock.calls[1]?.[0].content).toBe('覆盖期间继续输入的最新正文');
		expect(useAppStore.getState().session?.state.diskHash).toBe('second-force-hash');
		expect(useAppStore.getState().session?.state.dirty).toBe(false);
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

	it('saves once and loads once when 100 actions open a Story resource from a dirty chapter', async () => {
		await openChapter();
		useAppStore.getState().setContent('打开人物资料前必须安全保存的正文');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');
		const getStoryResource = vi.spyOn(desktopBridge, 'getStoryResource');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openStoryResource(fixtureStoryReference)
		)));

		expect(write).toHaveBeenCalledTimes(1);
		expect(getStoryResource).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().activeResource?.id)
			.toBe('story:character:character:lin-mo');
		expect(useAppStore.getState().session).toBeUndefined();
		expect(useAppStore.getState().saveState.type).toBe('clean');
	});

	it('keeps the latest chapter intent when a direct Story resource load completes late', async () => {
		const snapshot = await openChapter();
		const target = chapterAt(snapshot, 1);
		const fixtureStory = await desktopBridge.getStoryResource(
			snapshot.root,
			fixtureStoryReference.type,
			fixtureStoryReference.id
		);
		if (!fixtureStory) throw new Error('missing browser Story resource fixture');
		let finishStoryLoad: ((resource: typeof fixtureStory) => void) | undefined;
		const getStoryResource = vi.spyOn(desktopBridge, 'getStoryResource')
			.mockImplementationOnce(() => new Promise(resolve => { finishStoryLoad = resolve; }));
		const read = vi.spyOn(desktopBridge, 'readText');

		const storyOpen = useAppStore.getState().openStoryResource(fixtureStoryReference);
		await vi.waitFor(() => expect(getStoryResource).toHaveBeenCalledTimes(1));
		const latestOpens = Array.from({ length: 100 }, () => (
			useAppStore.getState().openResource(target)
		));
		finishStoryLoad?.(fixtureStory);
		await Promise.all([storyOpen, ...latestOpens]);

		expect(getStoryResource).toHaveBeenCalledTimes(1);
		expect(read).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().activeResource?.id).toBe(target.id);
		expect(useAppStore.getState().session?.state.resourceId).toBe(target.id);
		expect(useAppStore.getState().tabs.map(tab => tab.id))
			.not.toContain('story:character:character:lin-mo');
	});

	it('restores one closed Story resource once and consumes its history entry', async () => {
		const snapshot = await openChapter();
		const chapter = firstChapter(snapshot);
		await useAppStore.getState().openStoryResource(fixtureStoryReference);
		const storyId = useAppStore.getState().activeResource?.id;
		if (!storyId) throw new Error('Story resource did not open');
		useAppStore.getState().closeResource(storyId);
		await vi.waitFor(() => expect(useAppStore.getState().activeResource?.id).toBe(chapter.id));
		const getStoryResource = vi.spyOn(desktopBridge, 'getStoryResource');

		const restores = Array.from({ length: 100 }, () => (
			useAppStore.getState().restoreLastClosedResource()
		));
		expect(await Promise.all(restores)).toEqual(Array.from({ length: 100 }, () => true));

		expect(getStoryResource).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().activeResource?.id).toBe(storyId);
		expect(useAppStore.getState().recentlyClosedResources.map(resource => resource.id))
			.not.toContain(storyId);
		expect(await useAppStore.getState().restoreLastClosedResource()).toBe(false);
	});

	it('keeps the dirty chapter when saving before a direct Story open fails', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		useAppStore.getState().setContent('人物资料打开前保存失败也不能丢失的正文');
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValueOnce(new Error('writeFailed:C:\\private\\chapter.md'));
		const getStoryResource = vi.spyOn(desktopBridge, 'getStoryResource');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openStoryResource(fixtureStoryReference)
		)));

		expect(write).toHaveBeenCalledTimes(1);
		expect(getStoryResource).not.toHaveBeenCalled();
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().session?.content)
			.toBe('人物资料打开前保存失败也不能丢失的正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('protects text entered while a Story resource is loading', async () => {
		const snapshot = await openChapter();
		const active = firstChapter(snapshot);
		const fixtureStory = await desktopBridge.getStoryResource(
			snapshot.root,
			fixtureStoryReference.type,
			fixtureStoryReference.id
		);
		if (!fixtureStory) throw new Error('missing browser Story resource fixture');
		let finishStoryLoad: ((resource: typeof fixtureStory) => void) | undefined;
		const getStoryResource = vi.spyOn(desktopBridge, 'getStoryResource')
			.mockImplementationOnce(() => new Promise(resolve => { finishStoryLoad = resolve; }));
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic')
			.mockRejectedValueOnce(new Error('writeFailed:C:\\private\\chapter.md'));

		const opening = useAppStore.getState().openStoryResource(fixtureStoryReference);
		await vi.waitFor(() => expect(getStoryResource).toHaveBeenCalledTimes(1));
		useAppStore.getState().setContent('人物资料加载期间继续输入的正文');
		finishStoryLoad?.(fixtureStory);
		await opening;

		expect(write).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().activeResource?.id).toBe(active.id);
		expect(useAppStore.getState().session?.content).toBe('人物资料加载期间继续输入的正文');
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
		expect(useAppStore.getState().tabs.map(tab => tab.id))
			.not.toContain('story:character:character:lin-mo');
	});

	it('rechecks an active missing Story resource and upgrades it when data returns', async () => {
		const snapshot = await openChapter();
		const fixtureStory = await desktopBridge.getStoryResource(
			snapshot.root,
			fixtureStoryReference.type,
			fixtureStoryReference.id
		);
		if (!fixtureStory) throw new Error('missing browser Story resource fixture');
		const getStoryResource = vi.spyOn(desktopBridge, 'getStoryResource')
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(fixtureStory);

		await useAppStore.getState().openStoryResource(fixtureStoryReference);
		expect(useAppStore.getState().storyOpenResult?.status).toBe('missing');
		await useAppStore.getState().openStoryResource(fixtureStoryReference);

		expect(getStoryResource).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().storyOpenResult?.status).toBe('ready');
		expect(useAppStore.getState().activeResource?.title).toBe('林墨');
	});

	it('restores a missing Story resource once under 100 same-tick actions', async () => {
		const snapshot = await openChapter();
		await desktopBridge.moveStoryResourceToTrash(
			snapshot.root,
			fixtureStoryReference.type,
			fixtureStoryReference.id
		);
		await useAppStore.getState().openStoryResource(fixtureStoryReference);
		expect(useAppStore.getState().storyOpenResult?.status).toBe('missing');
		const restore = vi.spyOn(desktopBridge, 'restoreStoryResourceFromTrash');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().restoreStoryResource()
		)));

		expect(restore).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().storyOpenResult?.status).toBe('ready');
		expect(useAppStore.getState().activeResource?.title).toBe('林墨');
	});

	it('does not let a late Story trash restore overwrite a newer chapter intent', async () => {
		const snapshot = await openChapter();
		const target = chapterAt(snapshot, 1);
		await desktopBridge.moveStoryResourceToTrash(
			snapshot.root,
			fixtureStoryReference.type,
			fixtureStoryReference.id
		);
		await useAppStore.getState().openStoryResource(fixtureStoryReference);
		const originalRestore = desktopBridge.restoreStoryResourceFromTrash.bind(desktopBridge);
		let finishRestore: (() => void) | undefined;
		const restore = vi.spyOn(desktopBridge, 'restoreStoryResourceFromTrash')
			.mockImplementationOnce(async (...args) => {
				await new Promise<void>(resolve => { finishRestore = resolve; });
				return originalRestore(...args);
			});

		const restoring = useAppStore.getState().restoreStoryResource();
		await vi.waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
		const chapterOpening = useAppStore.getState().openResource(target);
		finishRestore?.();
		await Promise.all([restoring, chapterOpening]);

		expect(useAppStore.getState().activeResource?.id).toBe(target.id);
		expect(useAppStore.getState().session?.state.resourceId).toBe(target.id);
		expect(useAppStore.getState().storyOpenResult).toBeUndefined();
	});

	it('localizes a failed Story trash restore and releases it for retry', async () => {
		const snapshot = await openChapter();
		await desktopBridge.moveStoryResourceToTrash(
			snapshot.root,
			fixtureStoryReference.type,
			fixtureStoryReference.id
		);
		await useAppStore.getState().openStoryResource(fixtureStoryReference);
		const originalRestore = desktopBridge.restoreStoryResourceFromTrash.bind(desktopBridge);
		const restore = vi.spyOn(desktopBridge, 'restoreStoryResourceFromTrash')
			.mockRejectedValueOnce(new Error('trashReadFailed:C:\\private\\story\\trash.json'))
			.mockImplementationOnce((...args) => originalRestore(...args));

		await useAppStore.getState().restoreStoryResource();

		expect(useAppStore.getState().error).toBe('资料不在可恢复区，请重新检查或稍后重试。');
		expect(useAppStore.getState().error).not.toContain('C:\\private');
		expect(useAppStore.getState().storyOpenResult?.status).toBe('missing');

		await useAppStore.getState().restoreStoryResource();

		expect(restore).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().storyOpenResult?.status).toBe('ready');
		expect(useAppStore.getState().error).toBeUndefined();
	});
});
