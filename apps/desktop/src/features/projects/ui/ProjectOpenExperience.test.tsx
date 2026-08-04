import { act, render, screen } from '@testing-library/react';
import type { ProjectSnapshot, PublicProjectOpenError } from '@writing-buddy/platform-ports';
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
		writerSessions: {},
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

		const readOnlyButton = screen.getByRole('button', { name: '只读打开' });
		act(() => {
			for (let index = 0; index < 100; index += 1) {
				readOnlyButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			}
		});
		await screen.findByRole('main', { name: '写作首页' });
		expect(openProject).toHaveBeenCalledTimes(2);
		expect(openProject).toHaveBeenNthCalledWith(2, projectRoot, 'read-only');
		expect(useAppStore.getState().snapshot?.readOnly).toBe(true);
	});

	it('automatically restores a successful recent project on the next startup', async () => {
		const projectRoot = 'D:\\projects\\restored-story';
		const openProject = vi.spyOn(desktopBridge, 'openProject');
		resetForProjectOpen(projectRoot);

		render(<App />);
		await screen.findByRole('main', { name: '写作首页' });

		expect(openProject).toHaveBeenCalledWith(projectRoot, 'read-write');
		expect(useAppStore.getState().recentProjectRoot).toBe('browser-fixture');
	});

	it('opens one directory chooser for 100 same-tick project switch actions', async () => {
		resetForProjectOpen('');
		const chooseProject = vi.spyOn(desktopBridge, 'chooseProject');
		const openProject = vi.spyOn(desktopBridge, 'openProject');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().chooseProject()
		)));

		expect(chooseProject).toHaveBeenCalledTimes(1);
		expect(openProject).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().snapshot).toBeDefined();
	});

	it('opens the latest distinct project once when 100 actions replace a delayed target', async () => {
		resetForProjectOpen('');
		const fixture = await desktopBridge.openProject('browser-fixture');
		const firstTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\delayed-first',
			project: {
				...fixture.project,
				projectId: 'project-delayed-first',
				title: 'Delayed first project'
			}
		};
		const latestTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\latest-target',
			project: {
				...fixture.project,
				projectId: 'project-latest-target',
				title: 'Latest target project'
			}
		};
		let finishFirstOpen: ((snapshot: ProjectSnapshot) => void) | undefined;
		const openProject = vi.spyOn(desktopBridge, 'openProject')
			.mockImplementationOnce(() => new Promise(resolve => { finishFirstOpen = resolve; }))
			.mockResolvedValueOnce(latestTarget);

		const firstOpen = useAppStore.getState().openProject(firstTarget.root);
		await vi.waitFor(() => expect(openProject).toHaveBeenCalledTimes(1));
		const latestOpens = Array.from({ length: 100 }, () => (
			useAppStore.getState().openProject(latestTarget.root)
		));
		finishFirstOpen?.(firstTarget);
		await Promise.all([firstOpen, ...latestOpens]);

		expect(openProject).toHaveBeenCalledTimes(2);
		expect(openProject).toHaveBeenNthCalledWith(1, firstTarget.root, 'read-write');
		expect(openProject).toHaveBeenNthCalledWith(2, latestTarget.root, 'read-write');
		expect(useAppStore.getState().snapshot?.project.projectId)
			.toBe(latestTarget.project.projectId);
		expect(useAppStore.getState().recentProjectRoot).toBe(latestTarget.root);
	});

	it('does not expose the superseded project while the latest target is still loading', async () => {
		resetForProjectOpen('');
		const fixture = await desktopBridge.openProject('browser-fixture');
		const firstTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\superseded-visible',
			project: { ...fixture.project, projectId: 'project-superseded-visible' }
		};
		const latestTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\latest-still-loading',
			project: { ...fixture.project, projectId: 'project-latest-still-loading' }
		};
		let finishFirstOpen: ((snapshot: ProjectSnapshot) => void) | undefined;
		let finishLatestOpen: ((snapshot: ProjectSnapshot) => void) | undefined;
		const openProject = vi.spyOn(desktopBridge, 'openProject')
			.mockImplementationOnce(() => new Promise(resolve => { finishFirstOpen = resolve; }))
			.mockImplementationOnce(() => new Promise(resolve => { finishLatestOpen = resolve; }));

		const firstOpen = useAppStore.getState().openProject(firstTarget.root);
		await vi.waitFor(() => expect(openProject).toHaveBeenCalledTimes(1));
		const latestOpen = useAppStore.getState().openProject(latestTarget.root);
		finishFirstOpen?.(firstTarget);
		await vi.waitFor(() => expect(openProject).toHaveBeenCalledTimes(2));
		const stateWhileLatestLoads = useAppStore.getState();

		finishLatestOpen?.(latestTarget);
		await Promise.all([firstOpen, latestOpen]);
		expect(stateWhileLatestLoads.snapshot).toBeUndefined();
		expect(stateWhileLatestLoads.loading).toBe(true);
		expect(stateWhileLatestLoads.pendingProjectRoot).toBe(latestTarget.root);
		expect(useAppStore.getState().snapshot?.project.projectId)
			.toBe(latestTarget.project.projectId);
	});

	it('skips an intermediate target when a newer project is selected during loading', async () => {
		resetForProjectOpen('');
		const fixture = await desktopBridge.openProject('browser-fixture');
		const firstTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\first-intent',
			project: { ...fixture.project, projectId: 'project-first-intent' }
		};
		const intermediateTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\intermediate-intent',
			project: { ...fixture.project, projectId: 'project-intermediate-intent' }
		};
		const latestTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\final-intent',
			project: { ...fixture.project, projectId: 'project-final-intent' }
		};
		let finishFirstOpen: ((snapshot: ProjectSnapshot) => void) | undefined;
		const openProject = vi.spyOn(desktopBridge, 'openProject')
			.mockImplementationOnce(() => new Promise(resolve => { finishFirstOpen = resolve; }))
			.mockImplementation(root => Promise.resolve(
				root === latestTarget.root ? latestTarget : intermediateTarget
			));

		const firstOpen = useAppStore.getState().openProject(firstTarget.root);
		await vi.waitFor(() => expect(openProject).toHaveBeenCalledTimes(1));
		const intermediateOpen = useAppStore.getState().openProject(intermediateTarget.root);
		const latestOpens = Array.from({ length: 100 }, () => (
			useAppStore.getState().openProject(latestTarget.root)
		));
		finishFirstOpen?.(firstTarget);
		await Promise.all([firstOpen, intermediateOpen, ...latestOpens]);

		expect(openProject).toHaveBeenCalledTimes(2);
		expect(openProject).toHaveBeenNthCalledWith(2, latestTarget.root, 'read-write');
		expect(openProject).not.toHaveBeenCalledWith(intermediateTarget.root, 'read-write');
		expect(useAppStore.getState().snapshot?.project.projectId)
			.toBe(latestTarget.project.projectId);
	});

	it('continues to the latest queued project after the delayed target fails', async () => {
		resetForProjectOpen('');
		const fixture = await desktopBridge.openProject('browser-fixture');
		const failedRoot = 'D:\\Projects\\unavailable-first';
		const latestTarget: ProjectSnapshot = {
			...fixture,
			root: 'D:\\Projects\\available-latest',
			project: { ...fixture.project, projectId: 'project-available-latest' }
		};
		let failFirstOpen: ((error: Error) => void) | undefined;
		const openProject = vi.spyOn(desktopBridge, 'openProject')
			.mockImplementationOnce(() => new Promise((_, reject) => { failFirstOpen = reject; }))
			.mockResolvedValueOnce(latestTarget);

		const firstOpen = useAppStore.getState().openProject(failedRoot);
		await vi.waitFor(() => expect(openProject).toHaveBeenCalledTimes(1));
		const latestOpens = Array.from({ length: 100 }, () => (
			useAppStore.getState().openProject(latestTarget.root)
		));
		failFirstOpen?.(Object.assign(new Error(lockError.code), lockError));
		await Promise.all([firstOpen, ...latestOpens]);

		expect(openProject).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().snapshot?.project.projectId)
			.toBe(latestTarget.project.projectId);
		expect(useAppStore.getState().projectOpenError).toBeUndefined();
		expect(useAppStore.getState().pendingProjectRoot).toBeUndefined();
	});

	it('reuses one accepted dirty-draft decision for the latest queued project', async () => {
		resetForProjectOpen('');
		await useAppStore.getState().chooseProject();
		const current = useAppStore.getState().snapshot;
		const chapter = current?.project.volumes[0]?.chapters[0];
		if (!current || !chapter) throw new Error('Browser project fixture is incomplete.');
		await useAppStore.getState().openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: current.project.projectId
		});
		useAppStore.getState().setContent('dirty draft approved for one project switch');
		const firstTarget: ProjectSnapshot = {
			...current,
			root: 'D:\\Projects\\approved-first',
			project: { ...current.project, projectId: 'project-approved-first' }
		};
		const latestTarget: ProjectSnapshot = {
			...current,
			root: 'D:\\Projects\\approved-latest',
			project: { ...current.project, projectId: 'project-approved-latest' }
		};
		let finishFirstOpen: ((snapshot: ProjectSnapshot) => void) | undefined;
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const openProject = vi.spyOn(desktopBridge, 'openProject')
			.mockImplementationOnce(() => new Promise(resolve => { finishFirstOpen = resolve; }))
			.mockResolvedValueOnce(latestTarget);

		const firstOpen = useAppStore.getState().openProject(firstTarget.root);
		await vi.waitFor(() => expect(openProject).toHaveBeenCalledTimes(1));
		const latestOpens = Array.from({ length: 100 }, () => (
			useAppStore.getState().openProject(latestTarget.root)
		));
		finishFirstOpen?.(firstTarget);
		await Promise.all([firstOpen, ...latestOpens]);

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(openProject).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().snapshot?.project.projectId)
			.toBe(latestTarget.project.projectId);
		expect(useAppStore.getState().session).toBeUndefined();
	});

	it('releases the directory chooser guard after failure so the author can retry', async () => {
		resetForProjectOpen('');
		const chooseProject = vi.spyOn(desktopBridge, 'chooseProject')
			.mockRejectedValueOnce(new Error('dialog unavailable'))
			.mockResolvedValueOnce('browser-fixture');

		await useAppStore.getState().chooseProject();
		expect(useAppStore.getState().error).toBe('无法打开项目选择器，请重试。');
		await useAppStore.getState().chooseProject();

		expect(chooseProject).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().snapshot).toBeDefined();
		expect(useAppStore.getState().error).toBeUndefined();
	});

	it('keeps a dirty manuscript intact when 100 same-tick project opens are cancelled', async () => {
		resetForProjectOpen('');
		await useAppStore.getState().chooseProject();
		const snapshot = useAppStore.getState().snapshot;
		const chapter = snapshot?.project.volumes[0]?.chapters[0];
		if (!snapshot || !chapter) throw new Error('Browser project fixture is incomplete.');
		await useAppStore.getState().openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
		useAppStore.getState().setContent(`${useAppStore.getState().session?.content ?? ''}未保存切换保护`);
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const openProject = vi.spyOn(desktopBridge, 'openProject')
			.mockRejectedValue(new Error('project switch must remain cancelled'));

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openProject('D:\\WritingBuddy\\Projects\\另一个作品')
		)));

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(openProject).not.toHaveBeenCalled();
		expect(useAppStore.getState().snapshot?.root).toBe(snapshot.root);
		expect(useAppStore.getState().session?.state.dirty).toBe(true);
	});

	it('confirms once and opens once when a dirty manuscript switch is accepted under pressure', async () => {
		resetForProjectOpen('');
		await useAppStore.getState().chooseProject();
		const snapshot = useAppStore.getState().snapshot;
		const chapter = snapshot?.project.volumes[0]?.chapters[0];
		if (!snapshot || !chapter) throw new Error('Browser project fixture is incomplete.');
		await useAppStore.getState().openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
		useAppStore.getState().setContent(`${useAppStore.getState().session?.content ?? ''}确认放弃的修改`);
		const targetRoot = 'D:\\WritingBuddy\\Projects\\确认切换作品';
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const openProject = vi.spyOn(desktopBridge, 'openProject').mockResolvedValue({
			...snapshot,
			root: targetRoot,
			project: {
				...snapshot.project,
				projectId: 'project-switch-target',
				title: '确认切换作品'
			}
		});

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().openProject(targetRoot)
		)));

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(openProject).toHaveBeenCalledTimes(1);
		expect(openProject).toHaveBeenCalledWith(targetRoot, 'read-write');
		expect(useAppStore.getState().snapshot?.root).toBe(targetRoot);
		expect(useAppStore.getState().session).toBeUndefined();
	});

	it('deduplicates 100 repair actions and 100 directory reveals from recovery', async () => {
		const projectRoot = 'C:\\Users\\Alice\\Novel';
		resetForProjectOpen(projectRoot);
		useAppStore.setState({ pendingProjectRoot: projectRoot, projectOpenError: {
			...lockError,
			code: 'staleLockRemoveFailed',
			canOpenReadOnly: false,
			canRepair: true
		} });
		const repairProject = vi.spyOn(desktopBridge, 'repairProject');
		const openProject = vi.spyOn(desktopBridge, 'openProject');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().repairProject()
		)));

		expect(repairProject).toHaveBeenCalledTimes(1);
		expect(openProject).toHaveBeenCalledTimes(1);
		useAppStore.setState({
			pendingProjectRoot: projectRoot,
			projectOpenError: lockError,
			projectOpenBusyAction: undefined
		});
		const revealProjectDirectory = vi.spyOn(desktopBridge, 'revealProjectDirectory');

		await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().revealProjectDirectory()
		)));

		expect(revealProjectDirectory).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().projectOpenBusyAction).toBeUndefined();
	});
});
