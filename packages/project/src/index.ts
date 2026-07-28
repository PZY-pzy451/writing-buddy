import type { CursorState, ResourceDescriptor, TextFile } from '@writing-buddy/domain';
import type { AtomicWriteRequest, AtomicWriteResult, FileSystemPort } from '@writing-buddy/platform-ports';

export * from './ProjectTemplateRegistry';
export * from './ProjectStructureMove';

export interface DocumentSessionState {
	readonly resourceId: string;
	readonly path: string;
	readonly modelUri: string;
	readonly encoding: 'utf-8';
	readonly originalEol: 'lf' | 'crlf';
	readonly hasBom: boolean;
	readonly diskHash: string;
	readonly dirty: boolean;
	readonly version: number;
	readonly cursor: CursorState;
}

export class ExternalFileChangeError extends Error {
	constructor(readonly expectedHash: string, readonly actualHash: string) {
		super('The file changed on disk.');
		this.name = 'ExternalFileChangeError';
	}
}

export class DocumentSession {
	private contentValue: string;
	private savedContent: string;
	private stateValue: DocumentSessionState;

	constructor(
		resourceId: string,
		path: string,
		file: TextFile,
		cursor: CursorState = { lineNumber: 1, column: 1, scrollTop: 0 }
	) {
		this.contentValue = file.content;
		this.savedContent = file.content;
		this.stateValue = {
			resourceId,
			path,
			modelUri: `writing-buddy://${encodeURIComponent(resourceId)}/${path}`,
			encoding: 'utf-8',
			originalEol: file.eol,
			hasBom: file.hasBom,
			diskHash: file.hash,
			dirty: false,
			version: 1,
			cursor
		};
	}

	get state(): DocumentSessionState {
		return this.stateValue;
	}

	get content(): string {
		return this.contentValue;
	}

	get originalContent(): string {
		return this.savedContent;
	}

	copy(): DocumentSession {
		const copy = new DocumentSession(
			this.stateValue.resourceId,
			this.stateValue.path,
			{
				content: this.contentValue,
				encoding: this.stateValue.encoding,
				eol: this.stateValue.originalEol,
				hasBom: this.stateValue.hasBom,
				hash: this.stateValue.diskHash
			},
			this.stateValue.cursor
		);
		copy.savedContent = this.savedContent;
		copy.stateValue = { ...this.stateValue };
		return copy;
	}

	updateContent(content: string): void {
		if (content === this.contentValue) {
			return;
		}
		this.contentValue = content;
		this.stateValue = {
			...this.stateValue,
			dirty: content !== this.savedContent,
			version: this.stateValue.version + 1
		};
	}

	updateCursor(cursor: CursorState): void {
		this.stateValue = { ...this.stateValue, cursor };
	}

	toWriteRequest(projectRoot: string, force = false): AtomicWriteRequest {
		return {
			projectRoot,
			relativePath: this.stateValue.path,
			content: this.contentValue,
			expectedHash: this.stateValue.diskHash,
			eol: this.stateValue.originalEol,
			hasBom: this.stateValue.hasBom,
			...(force ? { force: true } : {})
		};
	}

	markSaved(result: AtomicWriteResult): void {
		this.savedContent = this.contentValue;
		this.stateValue = { ...this.stateValue, diskHash: result.hash, dirty: false };
	}

	reload(file: TextFile): void {
		this.contentValue = file.content;
		this.savedContent = file.content;
		this.stateValue = {
			...this.stateValue,
			originalEol: file.eol,
			hasBom: file.hasBom,
			diskHash: file.hash,
			dirty: false,
			version: this.stateValue.version + 1
		};
	}
}

export class DocumentSessionService {
	private readonly sessions = new Map<string, DocumentSession>();

	constructor(private readonly fileSystem: FileSystemPort) {}

	async open(projectRoot: string, resource: ResourceDescriptor, cursor?: CursorState): Promise<DocumentSession> {
		const existing = this.sessions.get(resource.id);
		if (existing) {
			return existing;
		}
		if (!resource.path) {
			throw new Error(`Resource has no document path: ${resource.id}`);
		}
		const file = await this.fileSystem.readText(projectRoot, resource.path);
		const session = new DocumentSession(resource.id, resource.path, file, cursor);
		this.sessions.set(resource.id, session);
		return session;
	}

	get(resourceId: string): DocumentSession | undefined {
		return this.sessions.get(resourceId);
	}

	async save(projectRoot: string, resourceId: string, force = false): Promise<void> {
		const session = this.sessions.get(resourceId);
		if (!session) {
			throw new Error(`Unknown document session: ${resourceId}`);
		}
		const result = await this.fileSystem.writeTextAtomic(session.toWriteRequest(projectRoot, force));
		session.markSaved(result);
	}

	close(resourceId: string): boolean {
		const session = this.sessions.get(resourceId);
		if (!session || session.state.dirty) {
			return false;
		}
		return this.sessions.delete(resourceId);
	}
}

export interface TabState {
	readonly resources: readonly ResourceDescriptor[];
	readonly activeId?: string;
}

export class ResourceTabManager {
	private stateValue: TabState = { resources: [] };

	get state(): TabState {
		return this.stateValue;
	}

	open(resource: ResourceDescriptor): void {
		const exists = this.stateValue.resources.some(candidate => candidate.id === resource.id);
		this.stateValue = {
			resources: exists
				? this.stateValue.resources.map(candidate => (
					candidate.id === resource.id ? resource : candidate
				))
				: [...this.stateValue.resources, resource],
			activeId: resource.id
		};
	}

	activate(resourceId: string): void {
		if (this.stateValue.resources.some(resource => resource.id === resourceId)) {
			this.stateValue = { ...this.stateValue, activeId: resourceId };
		}
	}

	close(resourceId: string): void {
		const index = this.stateValue.resources.findIndex(resource => resource.id === resourceId);
		if (index < 0) {
			return;
		}
		const resources = this.stateValue.resources.filter(resource => resource.id !== resourceId);
		const activeId = this.stateValue.activeId === resourceId
			? resources[Math.min(index, resources.length - 1)]?.id
			: this.stateValue.activeId;
		this.stateValue = { resources, activeId };
	}

	restore(state: TabState): void {
		this.stateValue = {
			resources: [...state.resources],
			activeId: state.activeId && state.resources.some(resource => resource.id === state.activeId)
				? state.activeId
				: state.resources[0]?.id
		};
	}
}

export interface EditTransaction {
	readonly id: string;
	readonly resourceId: string;
	readonly before: string;
	readonly after: string;
	readonly createdAt: string;
}

export class EditTransactionService {
	private readonly undoStack: EditTransaction[] = [];
	private readonly redoStack: EditTransaction[] = [];

	apply(resourceId: string, before: string, after: string): EditTransaction {
		const transaction: EditTransaction = {
			id: crypto.randomUUID(),
			resourceId,
			before,
			after,
			createdAt: new Date().toISOString()
		};
		this.undoStack.push(transaction);
		this.redoStack.length = 0;
		return transaction;
	}

	undo(current: string): { readonly content: string; readonly transaction: EditTransaction } | undefined {
		const transaction = this.undoStack.at(-1);
		if (!transaction || transaction.after !== current) {
			return undefined;
		}
		this.undoStack.pop();
		this.redoStack.push(transaction);
		return { content: transaction.before, transaction };
	}

	redo(current: string): { readonly content: string; readonly transaction: EditTransaction } | undefined {
		const transaction = this.redoStack.at(-1);
		if (!transaction || transaction.before !== current) {
			return undefined;
		}
		this.redoStack.pop();
		this.undoStack.push(transaction);
		return { content: transaction.after, transaction };
	}
}
