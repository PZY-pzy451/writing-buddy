import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AtomicWriteResult } from '@writing-buddy/platform-ports';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { CloseProtectionDialog } from './CloseProtectionDialog';

describe('CloseProtectionDialog', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		useAppStore.setState({ closeProtectionOpen: false });
	});

	it('shows accessible enabled exit controls, clicks cancel and conflict dismissal, and confirms destructive discard', async () => {
		const user = userEvent.setup();
		const onExit = vi.fn();
		useAppStore.setState({
			closeProtectionOpen: true,
			saveState: { type: 'dirty' },
			activeResource: {
				id: 'chapter-one',
				type: 'chapter',
				title: '第四章 桥下的画师',
				path: 'chapters/four.md',
				projectId: 'project-one'
			}
		});
		render(<CloseProtectionDialog onExit={onExit} />);

		expect(screen.getByTestId('close-protection-dialog')).toBeInTheDocument();
		expect(screen.getByRole('dialog', { name: '退出前确认正文安全' })).toBeInTheDocument();
		expect(screen.getByText(/快速记录已经单独落盘/u)).toBeInTheDocument();
		const continueWriting = screen.getByTestId('close-protection-continue-writing');
		expect(continueWriting).toBeVisible();
		expect(continueWriting).toBeEnabled();
		expect(screen.getByRole('button', { name: '继续写作' })).toBe(continueWriting);
		await user.click(continueWriting);
		expect(onExit).not.toHaveBeenCalled();
		expect(screen.queryByTestId('close-protection-dialog')).not.toBeInTheDocument();

		act(() => {
			useAppStore.setState({ closeProtectionOpen: true });
		});
		const cancel = screen.getByTestId('close-protection-cancel');
		expect(cancel).toBeVisible();
		expect(cancel).toBeEnabled();
		expect(screen.getByRole('button', { name: '取消退出' })).toBe(cancel);
		await user.click(cancel);
		expect(onExit).not.toHaveBeenCalled();
		expect(screen.queryByTestId('close-protection-dialog')).not.toBeInTheDocument();

		act(() => {
			useAppStore.setState({
				closeProtectionOpen: true,
				saveState: {
					type: 'external_conflict',
					detectedAt: '2026-07-29T11:04:00.000Z'
				}
			});
		});
		const resolveConflict = screen.getByTestId('close-protection-resolve-conflict');
		expect(resolveConflict).toBeVisible();
		expect(resolveConflict).toBeEnabled();
		expect(screen.getByRole('button', { name: '先处理文件冲突' })).toBe(resolveConflict);
		await user.click(resolveConflict);
		expect(onExit).not.toHaveBeenCalled();
		expect(screen.queryByTestId('close-protection-dialog')).not.toBeInTheDocument();

		act(() => {
			useAppStore.setState({
				closeProtectionOpen: true,
				saveState: { type: 'dirty' }
			});
		});
		const discard = screen.getByTestId('close-protection-discard');
		expect(discard).toBeVisible();
		expect(discard).toBeEnabled();
		expect(screen.getByRole('button', { name: '不保存并退出' })).toBe(discard);
		await user.click(discard);
		expect(onExit).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId('close-protection-dialog')).not.toBeInTheDocument();
	});

	it('shows accessible enabled save-and-exit, deduplicates 100 repeated clicks into one loading disabled persisted write, and hides after successful clean exit', async () => {
		await useAppStore.getState().openProject('browser-fixture');
		const snapshot = useAppStore.getState().snapshot;
		const chapter = snapshot?.project.volumes.flatMap(volume => volume.chapters)[0];
		if (!snapshot || !chapter) throw new Error('missing browser chapter fixture');
		await useAppStore.getState().openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
		useAppStore.getState().setContent('退出前需要原子保存的正文');
		useAppStore.setState({ closeProtectionOpen: true });
		const completions: Array<(result: AtomicWriteResult) => void> = [];
		const writeTextAtomic = vi.spyOn(desktopBridge, 'writeTextAtomic').mockImplementation(() => (
			new Promise(resolve => { completions.push(resolve); })
		));
		const onExit = vi.fn();
		render(<CloseProtectionDialog onExit={onExit} />);
		const saveAndExit = screen.getByTestId('close-protection-save-exit');
		expect(saveAndExit).toBeVisible();
		expect(saveAndExit).toBeEnabled();
		expect(screen.getByRole('button', { name: '保存并退出' })).toBe(saveAndExit);

		act(() => {
			for (let index = 0; index < 100; index += 1) fireEvent.click(saveAndExit);
		});

		expect(writeTextAtomic).toHaveBeenCalledTimes(1);
		expect(saveAndExit).toBeDisabled();
		expect(onExit).not.toHaveBeenCalled();
		act(() => completions[0]?.({
			hash: 'saved-on-exit',
			modifiedAt: '2026-07-29T11:05:01.000Z',
			byteLength: 36
		}));

		await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
		expect(useAppStore.getState().session?.state.dirty).toBe(false);
		expect(useAppStore.getState().closeProtectionOpen).toBe(false);
		expect(screen.queryByTestId('close-protection-dialog')).not.toBeInTheDocument();
	});

	it('shows accessible enabled save-copy, deduplicates 100 repeated clicks into one native dialog and hides after successful exit', async () => {
		await useAppStore.getState().openProject('browser-fixture');
		const snapshot = useAppStore.getState().snapshot;
		const chapter = snapshot?.project.volumes.flatMap(volume => volume.chapters)[0];
		if (!snapshot || !chapter) throw new Error('missing browser chapter fixture');
		await useAppStore.getState().openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
		useAppStore.getState().setContent('退出前需要另存保护的正文');
		useAppStore.setState({ closeProtectionOpen: true });
		const completions: Array<(path: string | undefined) => void> = [];
		const saveTextAs = vi.spyOn(desktopBridge, 'saveTextAs').mockImplementation(() => (
			new Promise(resolve => { completions.push(resolve); })
		));
		const onExit = vi.fn();
		render(<CloseProtectionDialog onExit={onExit} />);
		const saveCopy = screen.getByTestId('close-protection-save-copy');
		expect(saveCopy).toBeVisible();
		expect(saveCopy).toBeEnabled();
		expect(screen.getByRole('button', { name: '另存副本并退出' })).toBe(saveCopy);

		act(() => {
			for (let index = 0; index < 100; index += 1) fireEvent.click(saveCopy);
		});

		expect(saveTextAs).toHaveBeenCalledTimes(1);
		expect(onExit).not.toHaveBeenCalled();
		act(() => completions[0]?.('D:\\Exports\\退出前副本.md'));
		await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
		expect(useAppStore.getState().closeProtectionOpen).toBe(false);
		expect(screen.queryByTestId('close-protection-dialog')).not.toBeInTheDocument();
	});
});
