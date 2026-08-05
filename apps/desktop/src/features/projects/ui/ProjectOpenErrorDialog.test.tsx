import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';
import type { PublicProjectOpenError } from '../application/ProjectOpenService';
import { ProjectOpenErrorDialog } from './ProjectOpenErrorDialog';

const lockedError: PublicProjectOpenError = {
	code: 'projectLocked',
	stage: 'acquire-lock',
	safePath: 'C:\\Users\\***\\Novel',
	canOpenReadOnly: true,
	canRepair: false,
	diagnosticId: 'project-open-test-locked'
};

describe('ProjectOpenErrorDialog', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shows accessible enabled recovery controls, deduplicates 100 repeated clipboard clicks, reports failure safely, retries successfully and invokes recovery actions', async () => {
		const user = userEvent.setup();
		let rejectCopy: ((reason?: unknown) => void) | undefined;
		const pendingCopy = new Promise<void>((_resolve, reject) => { rejectCopy = reject; });
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(() => pendingCopy);
		const onRetry = vi.fn();
		const onOpenReadOnly = vi.fn();
		const onOpenDirectory = vi.fn();
		const onClose = vi.fn();

		render(
			<ProjectOpenErrorDialog
				error={lockedError}
				onRetry={onRetry}
				onOpenReadOnly={onOpenReadOnly}
				onRepair={vi.fn()}
				onOpenDirectory={onOpenDirectory}
				onClose={onClose}
			/>
		);

		expect(screen.getByRole('dialog', { name: '作品打开失败' })).toBeInTheDocument();
		expect(screen.getByText('获取写入锁')).toBeInTheDocument();
		expect(screen.getByText('C:\\Users\\***\\Novel')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '修复项目' })).not.toBeInTheDocument();
		const copyPath = screen.getByRole('button', { name: '复制安全路径' });
		expect(screen.getByTestId('project-open-copy-path')).toBe(copyPath);

		act(() => {
			for (let index = 0; index < 100; index += 1) fireEvent.click(copyPath);
		});
		expect(writeText).toHaveBeenCalledTimes(1);
		expect(copyPath).toBeDisabled();
		act(() => rejectCopy?.(new Error('C:\\Users\\private-name\\clipboard-denied')));
		await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('无法复制安全路径'));
		expect(screen.getByRole('alert')).not.toHaveTextContent('private-name');
		expect(copyPath).toBeEnabled();

		writeText.mockResolvedValueOnce(undefined);
		await user.click(copyPath);
		await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('安全路径已复制'));
		expect(writeText).toHaveBeenCalledTimes(2);
		expect(screen.getByRole('button', { name: '已复制安全路径' })).toBe(copyPath);
		expect(screen.getByTestId('project-open-error-dialog')).toBeInTheDocument();

		const diagnostics = screen.getByTestId('project-open-diagnostics');
		expect(screen.getByRole('button', { name: '查看诊断' })).toBe(diagnostics);
		await user.click(diagnostics);
		expect(screen.getByText('project-open-test-locked')).toBeInTheDocument();
		await user.click(screen.getByTestId('project-open-read-only'));
		await user.click(screen.getByTestId('project-open-retry'));
		await user.click(screen.getByTestId('project-open-directory'));
		await user.click(screen.getByTestId('project-open-close'));

		expect(onOpenReadOnly).toHaveBeenCalledOnce();
		expect(onRetry).toHaveBeenCalledOnce();
		expect(onOpenDirectory).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('shows an accessible enabled repair control only when allowed, then exposes its loading disabled state', async () => {
		const user = userEvent.setup();
		const onRepair = vi.fn();
		const { rerender } = render(
			<ProjectOpenErrorDialog
				error={{ ...lockedError, code: 'staleLockRemoveFailed', canRepair: true }}
				onRetry={vi.fn()}
				onOpenReadOnly={vi.fn()}
				onRepair={onRepair}
				onOpenDirectory={vi.fn()}
				onClose={vi.fn()}
			/>
		);

		const repair = screen.getByTestId('project-open-repair');
		expect(repair).toBeVisible();
		expect(repair).toBeEnabled();
		expect(screen.getByRole('button', { name: '修复项目' })).toBe(repair);
		await user.click(repair);
		expect(onRepair).toHaveBeenCalledOnce();

		rerender(
			<ProjectOpenErrorDialog
				error={{ ...lockedError, code: 'staleLockRemoveFailed', canRepair: true }}
				busyAction="repair"
				onRetry={vi.fn()}
				onOpenReadOnly={vi.fn()}
				onRepair={onRepair}
				onOpenDirectory={vi.fn()}
				onClose={vi.fn()}
			/>
		);
		expect(repair).toBeDisabled();
		expect(repair).toHaveTextContent('正在修复…');
	});
});
