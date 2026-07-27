import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
	it('shows safe recovery actions and expandable diagnostics for a lock conflict', async () => {
		const user = userEvent.setup();
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

		await user.click(screen.getByRole('button', { name: '查看诊断' }));
		expect(screen.getByText('project-open-test-locked')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '只读打开' }));
		await user.click(screen.getByRole('button', { name: '重试' }));
		await user.click(screen.getByRole('button', { name: '打开目录' }));
		await user.click(screen.getByRole('button', { name: '关闭' }));

		expect(onOpenReadOnly).toHaveBeenCalledOnce();
		expect(onRetry).toHaveBeenCalledOnce();
		expect(onOpenDirectory).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('shows repair only when the structured error allows it', () => {
		render(
			<ProjectOpenErrorDialog
				error={{ ...lockedError, code: 'staleLockRemoveFailed', canRepair: true }}
				onRetry={vi.fn()}
				onOpenReadOnly={vi.fn()}
				onRepair={vi.fn()}
				onOpenDirectory={vi.fn()}
				onClose={vi.fn()}
			/>
		);

		expect(screen.getByRole('button', { name: '修复项目' })).toBeInTheDocument();
	});
});
