import type {
	DesktopBridge,
	MoveCommand,
	ProjectStructureMoveResult
} from '@writing-buddy/platform-ports';

type ProjectStructureMoveGateway = Pick<DesktopBridge, 'moveProjectStructure'>;

export class ProjectStructureMoveGatewayError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'ProjectStructureMoveGatewayError';
	}
}

export class ProjectStructureMoveService {
	constructor(private readonly gateway: ProjectStructureMoveGateway) {}

	async execute(
		projectRoot: string,
		command: MoveCommand
	): Promise<ProjectStructureMoveResult> {
		try {
			return await this.gateway.moveProjectStructure({ projectRoot, command });
		} catch (error) {
			const message = typeof error === 'string'
				? error
				: error instanceof Error
					? error.message
					: 'projectMoveFailed';
			throw new ProjectStructureMoveGatewayError(
				message.split(':')[0] ?? 'projectMoveFailed'
			);
		}
	}
}

