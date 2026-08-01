export type ChapterExportFormat = 'markdown' | 'plain-text';

export interface ChapterExportReceipt {
	readonly id: string;
	readonly projectId: string;
	readonly chapterId: string;
	readonly chapterTitle: string;
	readonly format: ChapterExportFormat;
	readonly destination: string;
	readonly exportedAt: string;
	readonly wordCount: number;
}

export const chapterExportFormatLabels: Readonly<Record<ChapterExportFormat, string>> = {
	markdown: 'Markdown',
	'plain-text': '纯文本'
};

const validFormats = new Set<ChapterExportFormat>(['markdown', 'plain-text']);

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

export function parseChapterExportReceipts(
	input: unknown
): readonly ChapterExportReceipt[] {
	if (!Array.isArray(input)) return [];
	return input.flatMap((candidate): readonly ChapterExportReceipt[] => {
		if (!candidate || typeof candidate !== 'object') return [];
		const value = candidate as Partial<ChapterExportReceipt>;
		if (
			typeof value.id !== 'string'
			|| typeof value.projectId !== 'string'
			|| typeof value.chapterId !== 'string'
			|| typeof value.chapterTitle !== 'string'
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
			chapterId: value.chapterId,
			chapterTitle: value.chapterTitle,
			format: value.format,
			destination: value.destination,
			exportedAt: value.exportedAt,
			wordCount: Math.floor(value.wordCount ?? 0)
		}];
	}).slice(0, 100);
}
