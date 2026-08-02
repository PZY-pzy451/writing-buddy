import { describe, expect, it } from 'vitest';
import {
	buildChapterExportContent,
	buildWorkDocxDocument,
	buildWorkExportContent,
	confirmWholeWorkExportReceipt,
	createWorkSourceFingerprint,
	parseChapterExportReceipts,
	revokeWholeWorkExportReceipt,
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
		expect(suggestedWorkExportName('零点回声', 'docx')).toBe('零点回声.docx');
	});

	it('builds a structured Word request without duplicate headings or scene anchors', () => {
		expect(buildWorkDocxDocument('零点\n回声', [{
			title: '第一卷',
			chapters: [{
				title: '第一章 雨夜',
				content: '# 第一章 雨夜\n\n<!-- wb:scene id="scene:one" -->\n正文。'
			}]
		}])).toEqual({
			title: '零点 回声',
			volumes: [{
				title: '第一卷',
				chapters: [{ title: '第一章 雨夜', content: '正文。' }]
			}]
		});
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

	it('fingerprints exact manifest and ordered manuscript revisions', async () => {
		const chapters = [{
			id: 'chapter-one',
			path: 'chapters/one.md',
			hash: 'a'.repeat(64)
		}, {
			id: 'chapter-two',
			path: 'chapters/two.md',
			hash: 'b'.repeat(64)
		}];
		const original = await createWorkSourceFingerprint('manifest-one', chapters);

		expect(original).toMatch(/^sha256:[0-9a-f]{64}$/u);
		expect(await createWorkSourceFingerprint('manifest-one', chapters)).toBe(original);
		expect(await createWorkSourceFingerprint('manifest-two', chapters)).not.toBe(original);
		expect(await createWorkSourceFingerprint('manifest-one', chapters.slice().reverse())).not.toBe(original);
		expect(await createWorkSourceFingerprint('manifest-one', [
			{ ...chapters[0], hash: 'c'.repeat(64) },
			chapters[1]
		])).not.toBe(original);
		expect(await createWorkSourceFingerprint('manifest-one', [
			{ ...chapters[0], path: 'chapters/renamed.md' },
			chapters[1]
		])).not.toBe(original);
	});

	it('rejects incomplete or ambiguous source revisions before hashing', async () => {
		await expect(createWorkSourceFingerprint('', [])).rejects.toThrow(
			'workSourceFingerprintInputInvalid'
		);
		await expect(createWorkSourceFingerprint('manifest', [{
			id: 'chapter-one',
			path: 'chapters/one.md',
			hash: 'not-a-sha256'
		}])).rejects.toThrow('workSourceFingerprintInputInvalid');
		await expect(createWorkSourceFingerprint('manifest', [{
			id: 'chapter-one', path: 'chapters/one.md', hash: 'a'.repeat(64)
		}, {
			id: 'chapter-one', path: 'chapters/two.md', hash: 'b'.repeat(64)
		}])).rejects.toThrow('workSourceFingerprintInputInvalid');
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
			wordCount: 1200.8,
			confirmedAt: '2026-07-31T12:05:00.000Z'
		}, {
			id: 'export:2',
			projectId: 'project:1',
			scope: 'work',
			title: '零点回声',
			chapterCount: 12,
			format: 'markdown',
			destination: 'D:\\Exports\\零点回声.md',
			exportedAt: '2026-08-01T12:00:00.000Z',
			wordCount: 50000,
			sourceFingerprint: 'invalid',
			confirmedAt: 'not-a-timestamp'
		}, {
			id: 'export:3',
			projectId: 'project:1',
			scope: 'work',
			title: '零点回声 Word',
			chapterCount: 12,
			format: 'docx',
			destination: 'D:\\Exports\\零点回声.docx',
			exportedAt: '2026-08-01T13:00:00.000Z',
			wordCount: 50000,
			sourceFingerprint: `sha256:${'c'.repeat(64)}`,
			confirmedAt: '2026-08-01T13:05:00.000Z'
		}, {
			id: 'export:4',
			projectId: 'project:1',
			scope: 'work',
			title: '时间异常回执',
			chapterCount: 12,
			format: 'docx',
			destination: 'D:\\Exports\\malformed-time.docx',
			exportedAt: '2026-08-01T14:00:00.000Z',
			wordCount: 50000,
			sourceFingerprint: `sha256:${'d'.repeat(64)}`,
			confirmedAt: '2026-08-01 14:05'
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
		}, {
			id: 'export:3',
			projectId: 'project:1',
			scope: 'work',
			title: '零点回声 Word',
			chapterCount: 12,
			format: 'docx',
			destination: 'D:\\Exports\\零点回声.docx',
			exportedAt: '2026-08-01T13:00:00.000Z',
			wordCount: 50000,
			sourceFingerprint: `sha256:${'c'.repeat(64)}`,
			confirmedAt: '2026-08-01T13:05:00.000Z'
		}, {
			id: 'export:4',
			projectId: 'project:1',
			scope: 'work',
			title: '时间异常回执',
			chapterCount: 12,
			format: 'docx',
			destination: 'D:\\Exports\\malformed-time.docx',
			exportedAt: '2026-08-01T14:00:00.000Z',
			wordCount: 50000,
			sourceFingerprint: `sha256:${'d'.repeat(64)}`
		}]);
	});

	it('confirms one exact whole-work receipt per project and revokes it reversibly', () => {
		const receipts = parseChapterExportReceipts([{
			id: 'work-old',
			projectId: 'project:1',
			scope: 'work',
			title: '旧版',
			chapterCount: 10,
			format: 'docx',
			destination: 'D:\\Exports\\old.docx',
			exportedAt: '2026-08-01T12:00:00.000Z',
			wordCount: 40000,
			sourceFingerprint: `sha256:${'a'.repeat(64)}`,
			confirmedAt: '2026-08-01T12:05:00.000Z'
		}, {
			id: 'work-new',
			projectId: 'project:1',
			scope: 'work',
			title: '新版',
			chapterCount: 10,
			format: 'docx',
			destination: 'D:\\Exports\\new.docx',
			exportedAt: '2026-08-02T12:00:00.000Z',
			wordCount: 41000,
			sourceFingerprint: `sha256:${'b'.repeat(64)}`
		}, {
			id: 'other-project',
			projectId: 'project:2',
			scope: 'work',
			title: '另一部作品',
			chapterCount: 2,
			format: 'markdown',
			destination: 'D:\\Exports\\other.md',
			exportedAt: '2026-08-02T11:00:00.000Z',
			wordCount: 3000,
			sourceFingerprint: `sha256:${'c'.repeat(64)}`,
			confirmedAt: '2026-08-02T11:05:00.000Z'
		}]);

		const confirmed = confirmWholeWorkExportReceipt(
			receipts,
			'work-new',
			'2026-08-02T12:05:00.000Z'
		);
		expect(confirmed).not.toBe(receipts);
		expect(confirmed.find(receipt => receipt.id === 'work-old')?.confirmedAt)
			.toBeUndefined();
		expect(confirmed.find(receipt => receipt.id === 'work-new')?.confirmedAt)
			.toBe('2026-08-02T12:05:00.000Z');
		expect(confirmed.find(receipt => receipt.id === 'other-project')?.confirmedAt)
			.toBe('2026-08-02T11:05:00.000Z');
		expect(confirmWholeWorkExportReceipt(receipts, 'missing', '2026-08-02T12:05:00.000Z'))
			.toBe(receipts);
		expect(confirmWholeWorkExportReceipt(receipts, 'work-new', 'invalid'))
			.toBe(receipts);

		const revoked = revokeWholeWorkExportReceipt(confirmed, 'work-new');
		expect(revoked.find(receipt => receipt.id === 'work-new')?.confirmedAt)
			.toBeUndefined();
		expect(revokeWholeWorkExportReceipt(revoked, 'work-new')).toBe(revoked);
	});
});
