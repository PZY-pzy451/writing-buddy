import type { TextFile } from '@writing-buddy/domain';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../app/store';
import { desktopBridge } from '../platform/bridge';
import { ExternalConflictDialog } from './ExternalConflictDialog';

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
		saveState: { type: 'clean', savedAt: '2026-08-03T21:00:00.000Z' }
	});
}

function firstChapter(snapshot: ProjectSnapshot) {
	const chapter = snapshot.project.volumes.flatMap(volume => volume.chapters)[0];
	if (!chapter) throw new Error('missing browser chapter fixture');
	return {
		id: chapter.id,
		type: 'chapter' as const,
		title: chapter.title,
		path: chapter.file,
		projectId: snapshot.project.projectId
	};
}

async function openConflict(): Promise<TextFile> {
	await useAppStore.getState().openProject('browser-fixture');
	const snapshot = useAppStore.getState().snapshot;
	if (!snapshot) throw new Error('browser fixture failed to open');
	await useAppStore.getState().openResource(firstChapter(snapshot));
	useAppStore.getState().setContent('尚未保存的作者正文');
	const disk: TextFile = {
		content: '磁盘上的外部正文',
		hash: 'external-hash',
		encoding: 'utf-8',
		eol: 'lf',
		hasBom: false
	};
	useAppStore.setState({
		externalConflict: { disk, detectedAt: '2026-08-03T21:01:00.000Z' },
		saveState: {
			type: 'external_conflict',
			detectedAt: '2026-08-03T21:01:00.000Z'
		}
	});
	return disk;
}

describe('ExternalConflictDialog', () => {
	beforeEach(resetStore);

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it.each([
		['cancelled', () => Promise.resolve(undefined)],
		['failed', () => Promise.reject(new Error('saveCopyFailed:C:\\private\\draft.md'))]
	])('keeps both versions visible when save-copy is %s', async (_case, result) => {
		const user = userEvent.setup();
		const disk = await openConflict();
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs')
			.mockImplementationOnce(result);
		render(<ExternalConflictDialog />);

		await user.click(screen.getByRole('button', { name: '另存为' }));
		await waitFor(() => expect(saveTextAs).toHaveBeenCalledTimes(1));

		expect(screen.getByRole('dialog', { name: '文件已在磁盘上被修改' }))
			.toBeInTheDocument();
		expect(screen.getByText('尚未保存的作者正文')).toBeInTheDocument();
		expect(screen.getByText(disk.content)).toBeInTheDocument();
		expect(useAppStore.getState().externalConflict?.disk).toEqual(disk);
	});

	it('dismisses the conflict only after a successful save-copy', async () => {
		const user = userEvent.setup();
		await openConflict();
		vi.spyOn(desktopBridge, 'saveTextAs')
			.mockResolvedValueOnce('D:\\Exports\\冲突前副本.md');
		render(<ExternalConflictDialog />);

		await user.click(screen.getByRole('button', { name: '另存为' }));
		await waitFor(() => {
			expect(screen.queryByRole('dialog', { name: '文件已在磁盘上被修改' }))
				.not.toBeInTheDocument();
		});
		expect(useAppStore.getState().externalConflict).toBeUndefined();
	});

	it('locks mutually exclusive conflict actions while overwrite is pending', async () => {
		const user = userEvent.setup();
		await openConflict();
		let rejectWrite: ((error: Error) => void) | undefined;
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic').mockImplementationOnce(() => (
			new Promise((_resolve, reject) => { rejectWrite = reject; })
		));
		render(<ExternalConflictDialog />);

		await user.click(screen.getByRole('button', { name: '明确覆盖' }));
		await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
		expect(screen.getByRole('button', { name: '另存为' })).toBeDisabled();
		expect(screen.getByRole('button', { name: '重新加载磁盘版本' })).toBeDisabled();
		expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
		expect(screen.getByRole('button', { name: '暂不处理' })).toBeDisabled();

		rejectWrite?.(new Error('writeFailed:C:\\private\\chapter.md'));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: '明确覆盖' })).toBeEnabled();
		});
		expect(screen.getByRole('dialog', { name: '文件已在磁盘上被修改' }))
			.toBeInTheDocument();
	});
});
