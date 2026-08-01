import type {
	ImportedOutlineChapter,
	ImportedTextFile,
	ProjectImportKind,
	ProjectImportSource
} from '@writing-buddy/platform-ports';

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_OUTLINE_CHAPTERS = 200;
const IMPORT_MAX_CHAPTER_NOTE_CHARACTERS = 4_000;

export interface DraftImportAnalysis {
	readonly kind: ProjectImportKind;
	readonly file: ImportedTextFile;
	readonly wordCount: number;
	readonly paragraphCount: number;
	readonly preview: string;
	readonly chapters: readonly ImportedOutlineChapter[];
}

function countWords(content: string): number {
	const latinWords = content.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
	const cjkCharacters = content.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
	return latinWords + cjkCharacters;
}

function cleanHeading(line: string): string | undefined {
	const trimmed = line.trim();
	const markdown = /^(#{1,6})\s+(.+?)\s*#*$/.exec(trimmed);
	const candidate = (markdown?.[2] ?? trimmed).trim();
	if (!candidate) return undefined;
	if (/^第[零〇一二三四五六七八九十百千万两\d]+(?:章|回|节)(?:\s|[·：:—-]|$)/.test(candidate)) {
		return candidate;
	}
	if (/^chapter\s+\d+(?:\s|[.:：—-]|$)/i.test(candidate)) {
		return candidate;
	}
	if (!/^\s/.test(line) && /^\d{1,3}[.、)）]\s*\S/.test(candidate)) {
		return candidate;
	}
	return undefined;
}

function outlineChapters(content: string): readonly ImportedOutlineChapter[] {
	const lines = content.split(/\r?\n/);
	const headings = lines.flatMap((line, index) => {
		const title = cleanHeading(line);
		return title ? [{ index, title }] : [];
	});
	return headings.map((heading, index) => {
		const nextLine = headings[index + 1]?.index ?? lines.length;
		const note = lines
			.slice(heading.index + 1, nextLine)
			.join('\n')
			.trim()
			.slice(0, IMPORT_MAX_CHAPTER_NOTE_CHARACTERS);
		return { title: heading.title, note };
	});
}

export function analyzeDraftImport(
	file: ImportedTextFile,
	kind: ProjectImportKind
): DraftImportAnalysis {
	const content = file.content.replace(/^\uFEFF/, '');
	if (!content.trim()) throw new Error('importSourceEmpty');
	if (file.byteLength <= 0 || file.byteLength > IMPORT_MAX_BYTES) {
		throw new Error('importSourceTooLarge');
	}
	if (content.includes('\0')) throw new Error('importSourceBinary');
	const paragraphs = content.split(/(?:\r?\n){2,}/).filter(value => value.trim());
	const chapters = kind === 'outline' ? outlineChapters(content) : [];
	if (kind === 'outline' && chapters.length === 0) {
		throw new Error('importOutlineHasNoChapters');
	}
	if (chapters.length > IMPORT_MAX_OUTLINE_CHAPTERS) {
		throw new Error('importOutlineTooManyChapters');
	}
	if (chapters.some(chapter => chapter.title.length > 120)) {
		throw new Error('importChapterTitleTooLong');
	}
	return {
		kind,
		file: { ...file, content },
		wordCount: countWords(content),
		paragraphCount: paragraphs.length,
		preview: content.trim().slice(0, 600),
		chapters
	};
}

export function toProjectImportSource(analysis: DraftImportAnalysis): ProjectImportSource {
	return {
		...analysis.file,
		kind: analysis.kind,
		chapters: analysis.chapters
	};
}
