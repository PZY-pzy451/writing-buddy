import type { TextFile } from '@writing-buddy/domain';
import type {
	AtomicWriteRequest,
	AtomicWriteResult,
	Disposable,
	FileEntry,
	FileStat,
	FileSystemPort,
	FileWatchEvent
} from '@writing-buddy/platform-ports';

export * from './deterministicAiMock';
export * from './deterministicProjectFixture';

export type FakeFileSystemOperation =
	| 'readText'
	| 'writeTextAtomic'
	| 'readBytes'
	| 'writeBytesAtomic'
	| 'list'
	| 'stat'
	| 'watch';

export interface FakeFileSystemSeed {
	readonly projectRoot: string;
	readonly relativePath: string;
	readonly content: string;
	readonly eol?: 'lf' | 'crlf';
	readonly hasBom?: boolean;
}

export function fakeFileHash(content: string): string {
	let hash = 0;
	for (const character of content) {
		hash = Math.imul(hash, 31) + (character.codePointAt(0) ?? 0) | 0;
	}
	return Math.abs(hash).toString(16).padStart(64, '0');
}

export class FakeFileSystem implements FileSystemPort {
	private readonly files = new Map<string, TextFile>();
	private readonly listeners = new Set<(event: FileWatchEvent) => void>();
	private readonly failures = new Map<FakeFileSystemOperation, string[]>();
	private modifiedTick = 0;

	private consumeFailure(operation: FakeFileSystemOperation): void {
		const queue = this.failures.get(operation);
		const error = queue?.shift();
		if (queue?.length === 0) this.failures.delete(operation);
		if (error) throw new Error(error);
	}

	private nextModifiedAt(): string {
		const value = new Date(Date.UTC(2026, 0, 1, 0, 0, this.modifiedTick)).toISOString();
		this.modifiedTick += 1;
		return value;
	}

	failNext(operation: FakeFileSystemOperation, errorCode: string): void {
		this.failures.set(operation, [...(this.failures.get(operation) ?? []), errorCode]);
	}

	reset(seeds: readonly FakeFileSystemSeed[] = []): void {
		this.files.clear();
		this.listeners.clear();
		this.failures.clear();
		this.modifiedTick = 0;
		for (const seed of seeds) {
			this.add(seed.projectRoot, seed.relativePath, seed.content, seed.eol, seed.hasBom);
		}
	}

	dump(): readonly FakeFileSystemSeed[] {
		return [...this.files.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([path, file]) => {
			const separator = path.lastIndexOf('/');
			return {
				projectRoot: path.slice(0, separator),
				relativePath: path.slice(separator + 1),
				content: file.content,
				eol: file.eol,
				hasBom: file.hasBom
			};
		});
	}

	dispose(): void {
		this.reset();
	}

	add(projectRoot: string, relativePath: string, content: string, eol: 'lf' | 'crlf' = 'lf', hasBom = false): void {
		this.files.set(`${projectRoot}/${relativePath}`, {
			content,
			encoding: 'utf-8',
			eol,
			hasBom,
			hash: fakeFileHash(content)
		});
	}

	async readText(projectRoot: string, relativePath: string): Promise<TextFile> {
		this.consumeFailure('readText');
		const file = this.files.get(`${projectRoot}/${relativePath}`);
		if (!file) {
			throw new Error('notFound');
		}
		return file;
	}

	async writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		this.consumeFailure('writeTextAtomic');
		const key = `${request.projectRoot}/${request.relativePath}`;
		const existing = this.files.get(key);
		if (!request.force && existing && existing.hash !== request.expectedHash) {
			throw new Error('externalChange');
		}
		const hash = fakeFileHash(request.content);
		this.files.set(key, {
			content: request.content,
			encoding: 'utf-8',
			eol: request.eol,
			hasBom: request.hasBom,
			hash
		});
		for (const listener of this.listeners) {
			listener({ relativePath: request.relativePath, kind: existing ? 'modified' : 'created' });
		}
		return { hash, byteLength: new TextEncoder().encode(request.content).byteLength, modifiedAt: this.nextModifiedAt() };
	}

	async readBytes(projectRoot: string, relativePath: string): Promise<Uint8Array> {
		this.consumeFailure('readBytes');
		const file = await this.readText(projectRoot, relativePath);
		return new TextEncoder().encode(file.content);
	}

	async writeBytesAtomic(projectRoot: string, relativePath: string, data: Uint8Array): Promise<AtomicWriteResult> {
		this.consumeFailure('writeBytesAtomic');
		const content = new TextDecoder().decode(data);
		const existing = this.files.get(`${projectRoot}/${relativePath}`);
		return this.writeTextAtomic({
			projectRoot,
			relativePath,
			content,
			expectedHash: existing?.hash ?? '',
			eol: 'lf',
			hasBom: false
		});
	}

	async list(projectRoot: string, relativePath: string): Promise<readonly FileEntry[]> {
		this.consumeFailure('list');
		const prefix = `${projectRoot}/${relativePath}`.replace(/\/$/, '') + '/';
		return [...this.files.keys()]
			.filter(path => path.startsWith(prefix))
			.map(path => ({ name: path.slice(prefix.length), path, kind: 'file' as const }));
	}

	async stat(projectRoot: string, relativePath: string): Promise<FileStat | undefined> {
		this.consumeFailure('stat');
		const file = this.files.get(`${projectRoot}/${relativePath}`);
		return file
			? { kind: 'file', byteLength: new TextEncoder().encode(file.content).byteLength, modifiedAt: this.nextModifiedAt() }
			: undefined;
	}

	async watch(_projectRoot: string, listener: (event: FileWatchEvent) => void): Promise<Disposable> {
		this.consumeFailure('watch');
		this.listeners.add(listener);
		return { dispose: () => this.listeners.delete(listener) };
	}
}
