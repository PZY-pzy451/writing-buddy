import type {
	CreateProjectRequest,
	CreatedProject,
	DesktopBridge,
	ProjectCreationPreflight
} from '@writing-buddy/platform-ports';
import {
	ProjectCreationError,
	ProjectCreationService
} from './ProjectCreationService';

const request: CreateProjectRequest = {
	name: '桥下的画师',
	description: '',
	rootDirectory: 'D:\\WritingBuddy\\Projects',
	projectType: 'longform',
	language: 'zh-CN',
	templateId: 'blank-longform',
	selectedInitialResources: ['first-volume', 'first-chapter'],
	themeId: 'paper',
	accentId: 'gold',
	writingMode: 'manuscriptFirst'
};

function gateway(
	preflight: ProjectCreationPreflight,
	created?: CreatedProject
): Pick<DesktopBridge, 'chooseProjectParentDirectory' | 'preflightProjectCreation' | 'createProject'> {
	return {
		chooseProjectParentDirectory: vi.fn(() => Promise.resolve('D:\\WritingBuddy\\Projects')),
		preflightProjectCreation: vi.fn(() => Promise.resolve(preflight)),
		createProject: vi.fn(() => created
			? Promise.resolve(created)
			: Promise.reject(new Error('projectCreationFailed')))
	};
}

describe('ProjectCreationService', () => {
	it('does not invoke the write command when preflight reports an issue', async () => {
		const adapter = gateway({
			valid: false,
			createdFileCount: 0,
			createdDirectoryCount: 0,
			issues: [{
				field: 'rootDirectory',
				code: 'projectTargetExists',
				message: '同名作品目录已经存在，不会自动覆盖。'
			}]
		});
		const service = new ProjectCreationService(adapter);

		await expect(service.create(request)).rejects.toEqual(
			new ProjectCreationError('projectTargetExists')
		);
		expect(adapter.createProject).not.toHaveBeenCalled();
	});

	it('creates only after a successful preflight and preserves the result', async () => {
		const created: CreatedProject = {
			root: 'D:\\WritingBuddy\\Projects\\桥下的画师',
			projectId: 'project-a11ce001',
			firstChapterId: 'chapter-a11ce001',
			createdFileCount: 3,
			createdDirectoryCount: 4
		};
		const adapter = gateway({
			valid: true,
			targetRoot: created.root,
			createdFileCount: 3,
			createdDirectoryCount: 4,
			issues: []
		}, created);
		const service = new ProjectCreationService(adapter);

		await expect(service.create(request)).resolves.toEqual(created);
		expect(adapter.preflightProjectCreation).toHaveBeenCalledWith(request);
		expect(adapter.createProject).toHaveBeenCalledWith(request);
	});
});

