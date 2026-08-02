import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { createTextAnchor, type ReviewIssue } from '@writing-buddy/review';
import type { ChapterExportReceipt } from '../export/ChapterExportModel';
import { selectPublishReadiness } from './PublishReadinessModel';

function snapshot(): ProjectSnapshot {
	return {
		root: 'D:\\novel',
		projectRevision: 'revision-1',
		project: {
			schemaVersion: 1,
			projectId: 'project-one',
			title: '雾港来信',
			volumes: [{
				id: 'volume-one',
				title: '第一卷',
				chapters: [{
					id: 'chapter-one',
					title: '第一章',
					file: 'chapters/one.md',
					status: 'completed',
					scene: { location: '', time: '', pov: '', characters: [], goal: '', note: '' }
				}, {
					id: 'chapter-two',
					title: '第二章',
					file: 'chapters/two.md',
					status: 'completed',
					scene: { location: '', time: '', pov: '', characters: [], goal: '', note: '' }
				}]
			}]
		},
		resources: [],
		wordCounts: { 'chapter-one': 800, 'chapter-two': 1200 },
		integrityIssues: [],
		readOnly: false
	};
}

function receipt(patch: Partial<ChapterExportReceipt> = {}): ChapterExportReceipt {
	return {
		id: 'receipt-one',
		projectId: 'project-one',
		scope: 'work',
		title: '雾港来信',
		chapterCount: 2,
		format: 'docx',
		destination: 'D:\\Exports\\雾港来信.docx',
		exportedAt: '2026-08-02T08:00:00.000Z',
		wordCount: 2000,
		...patch
	};
}

function issue(severity: ReviewIssue['severity']): ReviewIssue {
	return {
		id: `issue-${severity}`,
		projectId: 'project-one',
		resourceId: 'chapter-one',
		ruleId: 'fixture',
		severity,
		status: 'open',
		title: '待处理问题',
		message: '请确认这处表达。',
		anchor: createTextAnchor('夜雨落下。', 0, 2),
		createdAt: '2026-08-02T07:00:00.000Z',
		updatedAt: '2026-08-02T07:00:00.000Z',
		origin: 'local'
	};
}

describe('PublishReadinessModel', () => {
	it('passes all deterministic checks when the saved completed work has a matching receipt', () => {
		const result = selectPublishReadiness({
			snapshot: snapshot(),
			saveState: { type: 'clean', savedAt: '2026-08-02T08:00:00.000Z' },
			issues: [],
			receipts: [receipt()]
		});

		expect(result).toMatchObject({
			status: 'passed',
			blockedCount: 0,
			attentionCount: 0,
			passedCount: 6,
			chapterCount: 2,
			wordCount: 2000
		});
		expect(result.checks.find(check => check.id === 'delivery')?.detail)
			.toContain('不是逐字校验');
	});

	it('uses the active unsaved word count and blocks empty chapters plus dirty saving', () => {
		const project = snapshot();
		const result = selectPublishReadiness({
			snapshot: { ...project, wordCounts: { 'chapter-one': 800, 'chapter-two': 0 } },
			saveState: { type: 'dirty' },
			issues: [],
			receipts: [],
			activeChapter: { resourceId: 'chapter-one', wordCount: 950 }
		});

		expect(result.status).toBe('blocked');
		expect(result.wordCount).toBe(950);
		expect(result.checks.find(check => check.id === 'manuscript')).toMatchObject({
			status: 'blocked',
			action: { type: 'chapter', resourceId: 'chapter-two' }
		});
		expect(result.checks.find(check => check.id === 'save')).toMatchObject({
			status: 'blocked',
			action: { type: 'save' }
		});
	});

	it('treats unresolved review errors as blockers and lower severities as author decisions', () => {
		const blocked = selectPublishReadiness({
			snapshot: snapshot(),
			saveState: { type: 'clean', savedAt: '2026-08-02T08:00:00.000Z' },
			issues: [issue('error'), issue('warning')],
			receipts: [receipt()]
		});
		const attention = selectPublishReadiness({
			snapshot: snapshot(),
			saveState: { type: 'clean', savedAt: '2026-08-02T08:00:00.000Z' },
			issues: [issue('suggestion')],
			receipts: [receipt()]
		});

		expect(blocked.checks.find(check => check.id === 'review')).toMatchObject({
			status: 'blocked',
			action: { type: 'review', resourceId: 'chapter-one', offset: 0 }
		});
		expect(attention.status).toBe('attention');
		expect(attention.checks.find(check => check.id === 'review')?.status).toBe('attention');
	});

	it('surfaces integrity failures, read-only warnings and incomplete chapter metadata', () => {
		const project = snapshot();
		const result = selectPublishReadiness({
			snapshot: {
				...project,
				readOnly: true,
				project: {
					...project.project,
					volumes: project.project.volumes.map(volume => ({
						...volume,
						chapters: volume.chapters.map((chapter, index) => index === 0
							? { ...chapter, status: 'revision' as const }
							: chapter)
					}))
				},
				integrityIssues: [{ severity: 'warning', code: 'fixture', message: '索引需要重建。' }]
			},
			saveState: { type: 'clean', savedAt: '2026-08-02T08:00:00.000Z' },
			issues: [],
			receipts: [receipt()]
		});

		expect(result.status).toBe('attention');
		expect(result.checks.find(check => check.id === 'completion')).toMatchObject({
			status: 'attention',
			action: { type: 'chapter', resourceId: 'chapter-one' }
		});
		expect(result.checks.find(check => check.id === 'integrity')?.detail).toContain('只读');
	});

	it('compares only the newest whole-work receipt with current counts', () => {
		const result = selectPublishReadiness({
			snapshot: snapshot(),
			saveState: { type: 'clean', savedAt: '2026-08-02T08:00:00.000Z' },
			issues: [],
			receipts: [
				receipt(),
				receipt({
					id: 'receipt-new',
					exportedAt: '2026-08-02T09:00:00.000Z',
					wordCount: 1900
				})
			]
		});

		expect(result.status).toBe('attention');
		expect(result.checks.find(check => check.id === 'delivery')).toMatchObject({
			status: 'attention',
			action: { type: 'history', label: '重新导出整书' }
		});
	});

	it('blocks a project without chapters and routes it to planning', () => {
		const project = snapshot();
		const result = selectPublishReadiness({
			snapshot: {
				...project,
				project: { ...project.project, volumes: [] },
				wordCounts: {}
			},
			saveState: { type: 'clean', savedAt: '2026-08-02T08:00:00.000Z' },
			issues: [],
			receipts: []
		});

		expect(result.status).toBe('blocked');
		expect(result.checks.find(check => check.id === 'manuscript')).toMatchObject({
			status: 'blocked',
			action: { type: 'planning' }
		});
	});
});
