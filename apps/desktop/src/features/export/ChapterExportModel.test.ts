import { describe, expect, it } from 'vitest';
import {
	buildChapterExportContent,
	parseChapterExportReceipts,
	suggestedChapterExportName
} from './ChapterExportModel';

describe('ChapterExportModel', () => {
	it('keeps Markdown intact and removes editor-only scene anchors from plain text', () => {
		const content = '# 第一章\n\n<!-- wb:scene id="scene:one" -->\n正文。\n\n\n下一段。';
		expect(buildChapterExportContent(content, 'markdown')).toBe(content);
		expect(buildChapterExportContent(content, 'plain-text')).toBe(
			'第一章\n\n正文。\n\n下一段。'
		);
	});

	it('creates Windows-safe suggested file names', () => {
		expect(suggestedChapterExportName('第一章：雨夜/旧站?', 'markdown'))
			.toBe('第一章：雨夜-旧站-.md');
		expect(suggestedChapterExportName('  ', 'plain-text')).toBe('chapter.txt');
	});

	it('keeps only structurally valid durable export receipts', () => {
		expect(parseChapterExportReceipts([{
			id: 'export:1',
			projectId: 'project:1',
			chapterId: 'chapter:1',
			chapterTitle: '第一章',
			format: 'plain-text',
			destination: 'D:\\Exports\\第一章.txt',
			exportedAt: '2026-07-31T12:00:00.000Z',
			wordCount: 1200.8
		}, {
			id: 'invalid',
			format: 'pdf'
		}])).toEqual([{
			id: 'export:1',
			projectId: 'project:1',
			chapterId: 'chapter:1',
			chapterTitle: '第一章',
			format: 'plain-text',
			destination: 'D:\\Exports\\第一章.txt',
			exportedAt: '2026-07-31T12:00:00.000Z',
			wordCount: 1200
		}]);
	});
});
