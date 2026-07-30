import { describe, expect, it } from 'vitest';
import {
	createPendingDraftCandidate,
	discardPendingDraftCandidate,
	editPendingDraftCandidate,
	isPendingDraftCandidateStale,
	rebasePendingDraftCandidateRevision,
	resolvePendingDraftEdit
} from './InlineDraftCandidateModel';

const manuscript = '雨还在下。\n\n林墨站在旧车站门口。';

describe('InlineDraftCandidateModel', () => {
	it('captures an exact cursor insertion target without changing the manuscript', () => {
		const cursorOffset = manuscript.length;
		const candidate = createPendingDraftCandidate({
			id: 'draft:cursor',
			actionId: 'manuscript-continuation',
			projectId: 'project:one',
			chapterId: 'chapter:one',
			resourceId: 'chapter:one',
			mode: 'insert_at_cursor',
			start: cursorOffset,
			end: cursorOffset,
			baseDocumentRevision: 7,
			currentContent: manuscript,
			content: '\n\n售票窗后传来一声轻响。',
			targetSummary: '第一章 / 当前光标之后',
			contextSummary: '当前正文与作者指令'
		});

		expect(candidate).toMatchObject({
			id: 'draft:cursor',
			status: 'ready',
			generatedContent: '\n\n售票窗后传来一声轻响。',
			content: '\n\n售票窗后传来一声轻响。',
			target: {
				mode: 'insert_at_cursor',
				range: { start: cursorOffset, end: cursorOffset },
				baseDocumentRevision: 7
			}
		});
		expect(manuscript).toBe('雨还在下。\n\n林墨站在旧车站门口。');
		expect(resolvePendingDraftEdit(
			candidate,
			'chapter:one',
			7,
			manuscript
		)).toEqual({
			start: cursorOffset,
			end: cursorOffset,
			text: '\n\n售票窗后传来一声轻响。'
		});
	});

	it('captures a replacement range and becomes stale after any author edit', () => {
		const start = manuscript.indexOf('林墨');
		const end = manuscript.length;
		const candidate = createPendingDraftCandidate({
			id: 'draft:rewrite',
			actionId: 'selection-rewrite:polish',
			projectId: 'project:one',
			chapterId: 'chapter:one',
			resourceId: 'chapter:one',
			mode: 'replace_selection',
			start,
			end,
			baseDocumentRevision: 3,
			currentContent: manuscript,
			content: '林墨独自停在旧车站斑驳的门檐下。',
			targetSummary: '第一章 / 替换当前选区',
			contextSummary: '润色，不改变情节事实'
		});

		expect(candidate.target.anchorTarget).toBe('林墨站在旧车站门口。');
		expect(isPendingDraftCandidateStale(
			candidate,
			'chapter:one',
			3,
			manuscript
		)).toBe(false);
		expect(isPendingDraftCandidateStale(
			candidate,
			'chapter:one',
			4,
			`${manuscript}后来。`
		)).toBe(true);
		expect(() => resolvePendingDraftEdit(
			candidate,
			'chapter:one',
			4,
			`${manuscript}后来。`
		)).toThrow('stalePendingDraftCandidate');
	});

	it('marks author edits and rejects empty or discarded candidates', () => {
		const candidate = createPendingDraftCandidate({
			id: 'draft:editable',
			actionId: 'manuscript-continuation',
			projectId: 'project:one',
			chapterId: 'chapter:one',
			resourceId: 'chapter:one',
			mode: 'insert_at_cursor',
			start: manuscript.length,
			end: manuscript.length,
			baseDocumentRevision: 1,
			currentContent: manuscript,
			content: '原始候选',
			targetSummary: '当前光标之后',
			contextSummary: '当前正文'
		});
		const edited = editPendingDraftCandidate(candidate, '作者修改后的候选');
		expect(edited).toMatchObject({ content: '作者修改后的候选', status: 'edited' });

		const empty = editPendingDraftCandidate(candidate, '  ');
		expect(() => resolvePendingDraftEdit(
			empty,
			'chapter:one',
			1,
			manuscript
		)).toThrow('emptyPendingDraftCandidate');

		const discarded = discardPendingDraftCandidate(edited);
		expect(discarded.status).toBe('discarded');
		expect(() => resolvePendingDraftEdit(
			discarded,
			'chapter:one',
			1,
			manuscript
		)).toThrow('pendingDraftNotApplicable');
	});

	it('rebases only a save-induced revision change with identical target content', () => {
		const candidate = createPendingDraftCandidate({
			id: 'draft:save-rebase',
			actionId: 'manuscript-continuation',
			projectId: 'project:one',
			chapterId: 'chapter:one',
			resourceId: 'chapter:one',
			mode: 'insert_at_cursor',
			start: manuscript.length,
			end: manuscript.length,
			baseDocumentRevision: 5,
			currentContent: manuscript,
			content: '门内传来脚步声。',
			targetSummary: '当前光标之后',
			contextSummary: '当前正文'
		});

		expect(rebasePendingDraftCandidateRevision(
			candidate,
			6,
			manuscript
		).target.baseDocumentRevision).toBe(6);
		expect(() => rebasePendingDraftCandidateRevision(
			candidate,
			6,
			`${manuscript}新增`
		)).toThrow('pendingDraftTargetChanged');
	});
});
