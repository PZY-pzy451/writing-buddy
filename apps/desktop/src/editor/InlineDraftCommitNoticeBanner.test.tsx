import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InlineDraftCommitNoticeBanner } from './InlineDraftCommitNoticeBanner';
import type {
	InlineDraftCommitNotice,
	InlineDraftCommitTarget
} from './InlineDraftCommitNoticeModel';

const notice: InlineDraftCommitNotice = {
	projectId: 'project-one',
	resourceId: 'chapter-one',
	modelUri: 'writing-buddy://project-one/chapter-one.md',
	contentAfterCommit: 'Committed manuscript.',
	message: 'AI draft committed.'
};

const target: InlineDraftCommitTarget = {
	projectId: notice.projectId,
	resourceId: notice.resourceId,
	modelUri: notice.modelUri,
	content: notice.contentAfterCommit
};

describe('inline draft commit notice', () => {
	it('dismisses and disables a stale notice after a resource identity change', async () => {
		const onDismiss = vi.fn();
		const onUndo = vi.fn().mockResolvedValue(undefined);
		const view = render(
			<InlineDraftCommitNoticeBanner
				notice={notice}
				target={target}
				onUndo={onUndo}
				onDismiss={onDismiss}
			/>
		);

		expect(screen.getByRole('button', { name: '撤销' })).toBeEnabled();
		view.rerender(
			<InlineDraftCommitNoticeBanner
				notice={notice}
				target={{
					...target,
					resourceId: 'chapter-two',
					modelUri: 'writing-buddy://project-one/chapter-two.md'
				}}
				onUndo={onUndo}
				onDismiss={onDismiss}
			/>
		);

		expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled();
		await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
		expect(onUndo).not.toHaveBeenCalled();
	});

	it('turns one hundred same-tick clicks into one undo action', async () => {
		let finishUndo: (() => void) | undefined;
		const onUndo = vi.fn(() => new Promise<void>(resolve => {
			finishUndo = resolve;
		}));
		render(
			<InlineDraftCommitNoticeBanner
				notice={notice}
				target={target}
				onUndo={onUndo}
				onDismiss={vi.fn()}
			/>
		);

		const undo = screen.getByRole('button', { name: '撤销' });
		for (let index = 0; index < 100; index += 1) fireEvent.click(undo);

		expect(onUndo).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: '正在撤销…' })).toBeDisabled();
		expect(screen.getByRole('button', { name: '关闭 AI 写入提示' })).toBeDisabled();
		finishUndo?.();
		await waitFor(() => expect(screen.getByRole('button', { name: '撤销' })).toBeEnabled());
	});

	it('localizes failure, releases the guard and permits an explicit retry', async () => {
		const onUndo = vi.fn()
			.mockRejectedValueOnce(new Error('rawNativeUndoFailure'))
			.mockResolvedValueOnce(undefined);
		render(
			<InlineDraftCommitNoticeBanner
				notice={notice}
				target={target}
				onUndo={onUndo}
				onDismiss={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '撤销' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('撤销未完成，请重试。');
		expect(screen.queryByText('rawNativeUndoFailure')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: '撤销' }));
		await waitFor(() => expect(onUndo).toHaveBeenCalledTimes(2));
	});
});
