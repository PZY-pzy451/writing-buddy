export const projectSchemaVersion = 1 as const;

export type ChapterStatus = 'draft' | 'revision' | 'completed';
export type ResourceType =
	| 'chapter'
	| 'note'
	| 'character'
	| 'worldbuilding'
	| 'timeline'
	| 'item'
	| 'story'
	| 'review'
	| 'version'
	| 'trash'
	| 'settings';

export interface SceneMetadata {
	readonly location: string;
	readonly time: string;
	readonly pov: string;
	readonly characters: readonly string[];
	readonly goal: string;
	readonly note: string;
}

export interface ChapterDescriptor {
	readonly id: string;
	readonly title: string;
	readonly file: string;
	readonly status?: ChapterStatus;
	readonly targetWords?: number;
	readonly scene: SceneMetadata;
}

export interface VolumeDescriptor {
	readonly id: string;
	readonly title: string;
	readonly chapters: readonly ChapterDescriptor[];
}

export interface WritingProject {
	readonly schemaVersion: typeof projectSchemaVersion;
	readonly projectId: string;
	readonly title: string;
	readonly volumes: readonly VolumeDescriptor[];
}

export interface ResourceDescriptor {
	readonly id: string;
	readonly type: ResourceType;
	readonly title: string;
	readonly path?: string;
	readonly projectId: string;
	readonly dirty?: boolean;
}

export interface TextFile {
	readonly content: string;
	readonly encoding: 'utf-8';
	readonly eol: 'lf' | 'crlf';
	readonly hasBom: boolean;
	readonly hash: string;
}

export interface CursorState {
	readonly lineNumber: number;
	readonly column: number;
	readonly scrollTop: number;
}

export function emptySceneMetadata(): SceneMetadata {
	return {
		location: '',
		time: '',
		pov: '',
		characters: [],
		goal: '',
		note: ''
	};
}

export function flattenChapters(project: WritingProject): readonly ChapterDescriptor[] {
	return project.volumes.flatMap(volume => volume.chapters);
}

export function findChapter(
	project: WritingProject,
	chapterId: string
): { readonly volume: VolumeDescriptor; readonly chapter: ChapterDescriptor } | undefined {
	for (const volume of project.volumes) {
		const chapter = volume.chapters.find(candidate => candidate.id === chapterId);
		if (chapter) {
			return { volume, chapter };
		}
	}
	return undefined;
}

export function countWords(value: string): number {
	const normalized = value
		.replace(/\[\[[^\]]+\]\]/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.trim();
	if (!normalized) {
		return 0;
	}
	const han = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
	const latin = normalized
		.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, ' ')
		.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
	return han + latin;
}

export function normalizeProjectRelativePath(value: string): string {
	if (
		value.length === 0 ||
		value.includes('\0') ||
		value.includes('\\') ||
		value.startsWith('/') ||
		/^[A-Za-z]:($|\/)/.test(value)
	) {
		throw new Error('unsafePath');
	}
	const segments = value.split('/');
	if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
		throw new Error('unsafePath');
	}
	return segments.join('/');
}
