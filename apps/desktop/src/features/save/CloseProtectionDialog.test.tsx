import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { CloseProtectionDialog } from './CloseProtectionDialog';

describe('CloseProtectionDialog', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		useAppStore.setState({ closeProtectionOpen: false });
	});

	it('explains durable auxiliary state, cancels safely and requires explicit discard', async () => {
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

		expect(screen.getByRole('dialog', { name: '退出前确认正文安全' })).toBeInTheDocument();
		expect(screen.getByText(/快速记录已经单独落盘/u)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '继续写作' }));
		expect(onExit).not.toHaveBeenCalled();

		act(() => {
			useAppStore.setState({ closeProtectionOpen: true });
		});
		await user.click(screen.getByRole('button', { name: '不保存并退出' }));
		expect(onExit).toHaveBeenCalledTimes(1);
	});

	it('waits for an in-flight save and exits only after it becomes clean', async () => {
		const onExit = vi.fn();
		useAppStore.setState({
			closeProtectionOpen: true,
			saveState: { type: 'saving', startedAt: '2026-07-29T11:05:00.000Z' }
		});
		render(<CloseProtectionDialog onExit={onExit} />);

		expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled();
		expect(onExit).not.toHaveBeenCalled();
		act(() => {
			useAppStore.setState({
				saveState: {
					type: 'clean',
					savedAt: '2026-07-29T11:05:01.000Z'
				}
			});
		});

		await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
	});

	it('opens one native save-copy dialog and exits once under 100 close actions', async () => {
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
		const saveCopy = screen.getByRole('button', { name: '另存副本并退出' });

		act(() => {
			for (let index = 0; index < 100; index += 1) fireEvent.click(saveCopy);
		});

		expect(saveTextAs).toHaveBeenCalledTimes(1);
		expect(onExit).not.toHaveBeenCalled();
		act(() => completions[0]?.('D:\\Exports\\退出前副本.md'));
		await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
		expect(useAppStore.getState().closeProtectionOpen).toBe(false);
	});
});
