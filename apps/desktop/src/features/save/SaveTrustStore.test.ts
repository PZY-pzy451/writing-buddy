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
	const chapter = snapshot.project.volumes[0]?.chapters[0];
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
});
