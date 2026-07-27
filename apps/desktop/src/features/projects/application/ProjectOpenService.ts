import type {
	ProjectOpenMode,
	ProjectRepairResult,
	ProjectSnapshot,
	PublicProjectOpenError
} from '@writing-buddy/platform-ports';

export type {
	ProjectOpenMode,
	ProjectRepairResult,
	PublicProjectOpenError
} from '@writing-buddy/platform-ports';

export interface ProjectOpenGateway {
	openProject(projectRoot: string, mode: ProjectOpenMode): Promise<ProjectSnapshot>;
	repairProject(projectRoot: string): Promise<ProjectRepairResult>;
	revealProjectDirectory(projectRoot: string): Promise<void>;
}

export type ProjectOpenResult =
	| { readonly ok: true; readonly snapshot: ProjectSnapshot }
	| { readonly ok: false; readonly error: PublicProjectOpenError };

const openStages = new Set([
	'select-path',
	'read-manifest',
	'validate-schema',
	'acquire-lock',
	'integrity-scan',
	'load-index'
]);

function redactProjectPath(projectRoot: string): string {
	const normalized = projectRoot.replaceAll('/', '\\');
	const segments = normalized.split('\\');
	const usersIndex = segments.findIndex(segment => segment.toLocaleLowerCase('en-US') === 'users');
	if (usersIndex >= 0 && usersIndex + 1 < segments.length) {
		segments[usersIndex + 1] = '***';
	}
	return segments.join('\\');
}

function diagnosticId(): string {
	const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID().replaceAll('-', '').slice(0, 12)
		: Math.random().toString(16).slice(2, 14).padEnd(12, '0');
	return `project-open-${Date.now().toString(36)}-${random}`;
}

function isPublicProjectOpenError(value: unknown): value is PublicProjectOpenError {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<PublicProjectOpenError>;
	return typeof candidate.code === 'string'
		&& typeof candidate.stage === 'string'
		&& openStages.has(candidate.stage)
		&& typeof candidate.canOpenReadOnly === 'boolean'
		&& typeof candidate.canRepair === 'boolean'
		&& typeof candidate.diagnosticId === 'string'
		&& (candidate.safePath === undefined || typeof candidate.safePath === 'string');
}

export function toPublicProjectOpenError(
	error: unknown,
	projectRoot: string
): PublicProjectOpenError {
	if (isPublicProjectOpenError(error)) {
		return {
			...error,
			...(error.safePath ? { safePath: redactProjectPath(error.safePath) } : {})
		};
	}
	return {
		code: 'projectOpenFailed',
		stage: 'read-manifest',
		safePath: redactProjectPath(projectRoot),
		canOpenReadOnly: false,
		canRepair: false,
		diagnosticId: diagnosticId()
	};
}

export class ProjectOpenService {
	constructor(private readonly gateway: ProjectOpenGateway) {}

	openProjectReadWrite(projectRoot: string): Promise<ProjectOpenResult> {
		return this.open(projectRoot, 'read-write');
	}

	openProjectReadOnly(projectRoot: string): Promise<ProjectOpenResult> {
		return this.open(projectRoot, 'read-only');
	}

	repairProject(projectRoot: string): Promise<ProjectRepairResult> {
		return this.gateway.repairProject(projectRoot);
	}

	revealProjectDirectory(projectRoot: string): Promise<void> {
		return this.gateway.revealProjectDirectory(projectRoot);
	}

	private async open(projectRoot: string, mode: ProjectOpenMode): Promise<ProjectOpenResult> {
		try {
			return {
				ok: true,
				snapshot: await this.gateway.openProject(projectRoot, mode)
			};
		} catch (error) {
			return {
				ok: false,
				error: toPublicProjectOpenError(error, projectRoot)
			};
		}
	}
}
