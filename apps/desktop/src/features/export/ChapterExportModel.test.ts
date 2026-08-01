import { describe, expect, it } from 'vitest';
import {
	buildChapterExportContent,
	buildWorkExportContent,
	parseChapterExportReceipts,
	suggestedChapterExportName,
	suggestedWorkExportName
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
		expect(suggestedWorkExportName('零点回声：第一部/终稿?', 'markdown'))
			.toBe('零点回声：第一部-终稿-.md');
		expect(suggestedWorkExportName('  ', 'plain-text')).toBe('novel.txt');
	});

	it('assembles every volume and chapter in order without editor-only anchors', () => {
		const volumes = [{
			title: '第一卷 零点回声',
			chapters: [{
				title: '第一章 停摆的时钟',
				content: '# 第一章 停摆的时钟\n\n<!-- wb:scene id="scene:one" -->\n正文一。'
			}, {
				title: '第二章 城市回声',
				content: '## 不同的原始标题\n\n正文二。'
			}]
		}];
		expect(buildWorkExportContent('零点回声', volumes, 'markdown')).toBe([
			'# 零点回声',
			'## 第一卷 零点回声',
			'### 第一章 停摆的时钟',
			'正文一。',
			'### 第二章 城市回声',
			'## 不同的原始标题\n\n正文二。\n'
		].join('\n\n'));
		expect(buildWorkExportContent('零点回声', volumes, 'plain-text')).toBe([
			'零点回声',
			'【第一卷 零点回声】',
			'第一章 停摆的时钟',
			'正文一。',
			'第二章 城市回声',
			'不同的原始标题\n\n正文二。\n'
		].join('\n\n'));
	});

	it('migrates legacy chapter receipts and keeps valid whole-work receipts', () => {
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
			id: 'export:2',
			projectId: 'project:1',
			scope: 'work',
			title: '零点回声',
			chapterCount: 12,
			format: 'markdown',
			destination: 'D:\\Exports\\零点回声.md',
			exportedAt: '2026-08-01T12:00:00.000Z',
			wordCount: 50000
		}, {
			id: 'invalid',
			format: 'pdf'
		}])).toEqual([{
			id: 'export:1',
			projectId: 'project:1',
			scope: 'chapter',
			title: '第一章',
			chapterId: 'chapter:1',
			chapterTitle: '第一章',
			chapterCount: 1,
			format: 'plain-text',
			destination: 'D:\\Exports\\第一章.txt',
			exportedAt: '2026-07-31T12:00:00.000Z',
			wordCount: 1200
		}, {
			id: 'export:2',
			projectId: 'project:1',
			scope: 'work',
			title: '零点回声',
			chapterCount: 12,
			format: 'markdown',
			destination: 'D:\\Exports\\零点回声.md',
			exportedAt: '2026-08-01T12:00:00.000Z',
			wordCount: 50000
		}]);
	});
});
