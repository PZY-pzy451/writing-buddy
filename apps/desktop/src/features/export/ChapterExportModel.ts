import type { DocxExportDocument } from '@writing-buddy/platform-ports';

export type ChapterExportFormat = 'markdown' | 'plain-text';
export type WorkExportFormat = ChapterExportFormat | 'docx';
export type ManuscriptExportFormat = WorkExportFormat;

export type ManuscriptExportScope = 'chapter' | 'work';

export interface WorkExportChapter {
	readonly title: string;
	readonly content: string;
}

export interface WorkExportVolume {
	readonly title: string;
	readonly chapters: readonly WorkExportChapter[];
}

export interface ChapterExportReceipt {
	readonly id: string;
	readonly projectId: string;
	readonly scope: ManuscriptExportScope;
	readonly title: string;
	readonly chapterId?: string;
	readonly chapterTitle?: string;
	readonly chapterCount: number;
	readonly format: ManuscriptExportFormat;
	readonly destination: string;
	readonly exportedAt: string;
	readonly wordCount: number;
}

export const chapterExportFormatLabels: Readonly<Record<ManuscriptExportFormat, string>> = {
	markdown: 'Markdown',
	'plain-text': '纯文本',
	docx: 'Word 文档'
};

const validFormats = new Set<ManuscriptExportFormat>(['markdown', 'plain-text', 'docx']);

export function buildChapterExportContent(
	content: string,
	format: ChapterExportFormat
): string {
	if (format === 'markdown') return content;
	return content
		.replace(/<!--\s*wb:scene\b[\s\S]*?-->/gu, '')
		.replace(/^\s{0,3}#{1,6}\s+/gmu, '')
		.replace(/\n{3,}/gu, '\n\n')
		.trimStart();
}

function singleLineTitle(value: string, fallback: string): string {
	return value.replace(/[\r\n]+/gu, ' ').replace(/\s{2,}/gu, ' ').trim() || fallback;
}

function stripSceneAnchors(content: string): string {
	return content.replace(/<!--\s*wb:scene\b[\s\S]*?-->/gu, '');
}

function stripMatchingOpeningHeading(content: string, title: string): string {
	const lines = content.replace(/\r\n?/gu, '\n').split('\n');
	const index = lines.findIndex(line => line.trim().length > 0);
	if (index < 0) return '';
	const match = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u.exec(lines[index] ?? '');
	if (match?.[1]?.trim() === title.trim()) {
		lines.splice(index, 1);
	}
	return lines.join('\n').trim();
}

export function buildWorkExportContent(
	title: string,
	volumes: readonly WorkExportVolume[],
	format: ChapterExportFormat
): string {
	const workTitle = singleLineTitle(title, '未命名作品');
	const sections: string[] = [format === 'markdown' ? `# ${workTitle}` : workTitle];
	for (const [volumeIndex, volume] of volumes.entries()) {
		const volumeTitle = singleLineTitle(volume.title, `第 ${volumeIndex + 1} 卷`);
		sections.push(format === 'markdown' ? `## ${volumeTitle}` : `【${volumeTitle}】`);
		for (const [chapterIndex, chapter] of volume.chapters.entries()) {
			const chapterTitle = singleLineTitle(chapter.title, `第 ${chapterIndex + 1} 章`);
			const source = stripSceneAnchors(chapter.content);
			const body = format === 'markdown'
				? stripMatchingOpeningHeading(source, chapterTitle)
				: buildChapterExportContent(
					stripMatchingOpeningHeading(source, chapterTitle),
					'plain-text'
				).trim();
			sections.push(format === 'markdown' ? `### ${chapterTitle}` : chapterTitle);
			if (body) sections.push(body);
		}
	}
	return `${sections.join('\n\n').trimEnd()}\n`;
}

export function buildWorkDocxDocument(
	title: string,
	volumes: readonly WorkExportVolume[]
): DocxExportDocument {
	return {
		title: singleLineTitle(title, '未命名作品'),
		volumes: volumes.map((volume, volumeIndex) => ({
			title: singleLineTitle(volume.title, `第 ${volumeIndex + 1} 卷`),
			chapters: volume.chapters.map((chapter, chapterIndex) => {
				const chapterTitle = singleLineTitle(chapter.title, `第 ${chapterIndex + 1} 章`);
				const source = stripMatchingOpeningHeading(
					stripSceneAnchors(chapter.content),
					chapterTitle
				);
				return {
					title: chapterTitle,
					content: buildChapterExportContent(source, 'plain-text').trim()
				};
			})
		}))
	};
}

export function suggestedChapterExportName(
	title: string,
	format: ChapterExportFormat
): string {
	const base = title
		.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
		.replace(/[.\s]+$/gu, '')
		.trim()
		.slice(0, 96) || 'chapter';
	return `${base}.${format === 'markdown' ? 'md' : 'txt'}`;
}

export function suggestedWorkExportName(
	title: string,
	format: WorkExportFormat
): string {
	const base = title
		.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
		.replace(/[.\s]+$/gu, '')
		.trim()
		.slice(0, 96) || 'novel';
	return `${base}.${format === 'markdown' ? 'md' : format === 'docx' ? 'docx' : 'txt'}`;
}

export function parseChapterExportReceipts(
	input: unknown
): readonly ChapterExportReceipt[] {
	if (!Array.isArray(input)) return [];
	return input.flatMap((candidate): readonly ChapterExportReceipt[] => {
		if (!candidate || typeof candidate !== 'object') return [];
		const value = candidate as Partial<ChapterExportReceipt> & {
			readonly scope?: unknown;
			readonly title?: unknown;
			readonly chapterCount?: unknown;
		};
		const scope: ManuscriptExportScope = value.scope === 'work' ? 'work' : 'chapter';
		const legacyChapterTitle = typeof value.chapterTitle === 'string'
			? value.chapterTitle
			: undefined;
		const title = typeof value.title === 'string'
			? value.title
			: legacyChapterTitle;
		const chapterCount = scope === 'work'
			? value.chapterCount
			: 1;
		if (
			typeof value.id !== 'string'
			|| typeof value.projectId !== 'string'
			|| typeof title !== 'string'
			|| !title.trim()
			|| (scope === 'chapter' && typeof value.chapterId !== 'string')
			|| (scope === 'chapter' && typeof legacyChapterTitle !== 'string')
			|| !Number.isFinite(chapterCount)
			|| (chapterCount ?? -1) < 0
			|| typeof value.format !== 'string'
			|| !validFormats.has(value.format)
			|| typeof value.destination !== 'string'
			|| typeof value.exportedAt !== 'string'
			|| !Number.isFinite(value.wordCount)
			|| (value.wordCount ?? -1) < 0
		) return [];
		return [{
			id: value.id,
			projectId: value.projectId,
			scope,
			title,
			...(scope === 'chapter' ? {
				chapterId: value.chapterId,
				chapterTitle: legacyChapterTitle
			} : {}),
			chapterCount: Math.floor(chapterCount ?? 0),
			format: value.format,
			destination: value.destination,
			exportedAt: value.exportedAt,
			wordCount: Math.floor(value.wordCount ?? 0)
		}];
	}).slice(0, 100);
}
