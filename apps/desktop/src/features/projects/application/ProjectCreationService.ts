import type {
	CreateProjectRequest,
	CreatedProject,
	DesktopBridge,
	ProjectCreationPreflight
} from '@writing-buddy/platform-ports';

type ProjectCreationGateway = Pick<
	DesktopBridge,
	'chooseProjectParentDirectory' | 'preflightProjectCreation' | 'createProject'
>;

export class ProjectCreationError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'ProjectCreationError';
	}
}

export class ProjectCreationService {
	constructor(private readonly gateway: ProjectCreationGateway) {}

	chooseParentDirectory(): Promise<string | undefined> {
		return this.gateway.chooseProjectParentDirectory();
	}

	preflight(request: CreateProjectRequest): Promise<ProjectCreationPreflight> {
		return this.gateway.preflightProjectCreation(request);
	}

	async create(request: CreateProjectRequest): Promise<CreatedProject> {
		const preflight = await this.preflight(request);
		if (!preflight.valid) {
			throw new ProjectCreationError(
				preflight.issues[0]?.code ?? 'projectCreationPreflightFailed'
			);
		}
		try {
			return await this.gateway.createProject(request);
		} catch (error) {
			throw new ProjectCreationError(
				typeof error === 'string'
					? error
					: error instanceof Error
						? error.message.split(':')[0]
						: 'projectCreationFailed'
			);
		}
	}
}
