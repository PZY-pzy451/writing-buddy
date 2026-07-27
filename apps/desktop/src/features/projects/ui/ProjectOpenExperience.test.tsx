import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicProjectOpenError } from '@writing-buddy/platform-ports';
import { App } from '../../../app/App';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';

const lockError: PublicProjectOpenError = {
	code: 'projectLocked',
	stage: 'acquire-lock',
	safePath: 'C:\\Users\\***\\Novel',
	canOpenReadOnly: true,
	canRepair: false,
	diagnosticId: 'project-open-integration-lock'
};

function resetForProjectOpen(recentProjectRoot: string): void {
	useAppStore.setState({
		recentProjectRoot,
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		projectOpenError: undefined,
		pendingProjectRoot: undefined,
		projectOpenBusyAction: undefined,
		loading: false,
		error: undefined
	});
}

describe('project open integration', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('turns a startup lock conflict into an actionable read-only recovery', async () => {
		const user = userEvent.setup();
		const projectRoot = 'C:\\Users\\Alice\\Novel';
		const fixture = await desktopBridge.openProject(projectRoot);
		const openProject = vi.spyOn(desktopBridge, 'openProject')
			.mockRejectedValueOnce(Object.assign(new Error(lockError.code), lockError))
			.mockResolvedValueOnce({ ...fixture, root: projectRoot, readOnly: true });
		resetForProjectOpen(projectRoot);

		render(<App />);
		await screen.findByRole('dialog', { name: '作品打开失败' });
		expect(screen.getByText('获取写入锁')).toBeInTheDocument();
		expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: '只读打开' }));
		await screen.findByRole('main', { name: '作品仪表盘' });
		expect(openProject).toHaveBeenNthCalledWith(2, projectRoot, 'read-only');
		expect(useAppStore.getState().snapshot?.readOnly).toBe(true);
	});

	it('automatically restores a successful recent project on the next startup', async () => {
		const projectRoot = 'D:\\projects\\restored-story';
		const openProject = vi.spyOn(desktopBridge, 'openProject');
		resetForProjectOpen(projectRoot);

		render(<App />);
		await screen.findByRole('main', { name: '作品仪表盘' });

		expect(openProject).toHaveBeenCalledWith(projectRoot, 'read-write');
		expect(useAppStore.getState().recentProjectRoot).toBe('browser-fixture');
	});
});
