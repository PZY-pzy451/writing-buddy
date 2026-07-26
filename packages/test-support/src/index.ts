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

function fakeHash(content: string): string {
	let hash = 0;
	for (const character of content) {
		hash = Math.imul(hash, 31) + (character.codePointAt(0) ?? 0) | 0;
	}
	return Math.abs(hash).toString(16).padStart(64, '0');
}

export class FakeFileSystem implements FileSystemPort {
	private readonly files = new Map<string, TextFile>();
	private readonly listeners = new Set<(event: FileWatchEvent) => void>();

	add(projectRoot: string, relativePath: string, content: string, eol: 'lf' | 'crlf' = 'lf', hasBom = false): void {
		this.files.set(`${projectRoot}/${relativePath}`, {
			content,
			encoding: 'utf-8',
			eol,
			hasBom,
			hash: fakeHash(content)
		});
	}

	async readText(projectRoot: string, relativePath: string): Promise<TextFile> {
		const file = this.files.get(`${projectRoot}/${relativePath}`);
		if (!file) {
			throw new Error('notFound');
		}
		return file;
	}

	async writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		const key = `${request.projectRoot}/${request.relativePath}`;
		const existing = this.files.get(key);
		if (!request.force && existing && existing.hash !== request.expectedHash) {
			throw new Error('externalChange');
		}
		const hash = fakeHash(request.content);
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
		return { hash, byteLength: new TextEncoder().encode(request.content).byteLength, modifiedAt: new Date().toISOString() };
	}

	async readBytes(projectRoot: string, relativePath: string): Promise<Uint8Array> {
		const file = await this.readText(projectRoot, relativePath);
		return new TextEncoder().encode(file.content);
	}

	async writeBytesAtomic(projectRoot: string, relativePath: string, data: Uint8Array): Promise<AtomicWriteResult> {
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
		const prefix = `${projectRoot}/${relativePath}`.replace(/\/$/, '') + '/';
		return [...this.files.keys()]
			.filter(path => path.startsWith(prefix))
			.map(path => ({ name: path.slice(prefix.length), path, kind: 'file' as const }));
	}

	async stat(projectRoot: string, relativePath: string): Promise<FileStat | undefined> {
		const file = this.files.get(`${projectRoot}/${relativePath}`);
		return file
			? { kind: 'file', byteLength: new TextEncoder().encode(file.content).byteLength, modifiedAt: new Date().toISOString() }
			: undefined;
	}

	async watch(_projectRoot: string, listener: (event: FileWatchEvent) => void): Promise<Disposable> {
		this.listeners.add(listener);
		return { dispose: () => this.listeners.delete(listener) };
	}
}
