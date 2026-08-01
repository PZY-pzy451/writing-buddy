import { describe, expect, it } from 'vitest';
import { analyzeDraftImport, toProjectImportSource } from './DraftImportModel';

describe('DraftImportModel', () => {
	it('detects explicit Markdown and plain chapter headings without inventing structure', () => {
		const analysis = analyzeDraftImport({
			fileName: '零点回声.md',
			format: 'markdown',
			byteLength: 128,
			content: '# 零点回声\n\n## 第一章 · 迟到四十七秒\n站台恢复供电。\n\n2. 城市回声协议\n顾言追踪信号。'
		}, 'outline');

		expect(analysis.chapters).toEqual([
			{ title: '第一章 · 迟到四十七秒', note: '站台恢复供电。' },
			{ title: '2. 城市回声协议', note: '顾言追踪信号。' }
		]);
		expect(toProjectImportSource(analysis)).toMatchObject({
			kind: 'outline',
			fileName: '零点回声.md',
			chapters: analysis.chapters
		});
	});

	it('keeps manuscript content unchanged and reports prose statistics', () => {
		const content = '雨落在站台。\r\n\r\nSomething changed.';
		const analysis = analyzeDraftImport({
			fileName: '正文.txt',
			format: 'plain-text',
			byteLength: 42,
			content
		}, 'manuscript');

		expect(analysis.file.content).toBe(content);
		expect(analysis.paragraphCount).toBe(2);
		expect(analysis.wordCount).toBe(7);
		expect(analysis.chapters).toEqual([]);
	});

	it('rejects an outline that has no explicit chapter boundaries', () => {
		expect(() => analyzeDraftImport({
			fileName: '想法.txt',
			format: 'plain-text',
			byteLength: 18,
			content: '一个人在雨夜回到旧车站。'
		}, 'outline')).toThrowError('importOutlineHasNoChapters');
	});

	it('rejects rather than silently dropping chapters beyond the bounded plan', () => {
		const content = Array.from({ length: 201 }, (_, index) => `${index + 1}. 第 ${index + 1} 章`).join('\n');
		expect(() => analyzeDraftImport({
			fileName: '超长大纲.md',
			format: 'markdown',
			byteLength: new TextEncoder().encode(content).byteLength,
			content
		}, 'outline')).toThrowError('importOutlineTooManyChapters');
	});
});
