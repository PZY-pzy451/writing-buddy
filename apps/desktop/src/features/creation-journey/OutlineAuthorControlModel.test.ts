import { describe, expect, it } from 'vitest';
import {
	createCreationJourneyState,
	setGeneratedGenreOutline,
	toggleJourneyLock,
	updateGenreToOutlineInput
} from './CreationJourneyModel';
import {
	analyzeOutlineCandidateImpact,
	applyOutlineCandidateSelection,
	createOutlineCandidatePreview,
	diffOutlineCandidate,
	undoOutlineCandidateApply
} from './OutlineAuthorControlModel';

function outlineState() {
	let id = 0;
	const initial = updateGenreToOutlineInput(
		createCreationJourneyState('author-control', { startRoute: 'genre' }),
		{ genre: '都市悬疑' }
	);
	return setGeneratedGenreOutline(initial, {
		outline: {
			title: '雨夜旧站',
			genre: '都市悬疑',
			premise: '记者追查只在雨夜出现的旧车站。'
		},
		storyBeats: Array.from({ length: 5 }, (_, index) => ({
			title: `故事节点 ${index + 1}`,
			summary: `推进调查 ${index + 1}`,
			goal: `取得线索 ${index + 1}`,
			conflict: `遭遇阻碍 ${index + 1}`,
			outcome: `留下变化 ${index + 1}`,
			hook: `雨痕变化 ${index + 1}`,
			povHint: '记者'
		})),
		suggestedCharacters: [],
		suggestedWorldRules: [],
		warnings: []
	}, {
		id: prefix => `${prefix}:author-${++id}`,
		now: () => '2026-07-30T01:00:00.000Z'
	});
}

function preview() {
	const state = outlineState();
	const target = state.outline[1];
	return {
		state,
		target,
		preview: createOutlineCandidatePreview(state, target.id, [
			{
				label: '冲突升级',
				rationale: '让线索带来更直接的代价。',
				replacement: {
					title: target.title,
					summary: '记者拿到名单，却发现自己的名字也在其中。',
					purpose: target.purpose,
					goal: target.goal ?? '',
					conflict: '公开名单会立即抹去记者最后的私人记忆。',
					outcome: target.outcome ?? '',
					hook: '名单末尾出现明天的日期。',
					povHint: target.povHint ?? ''
				}
			},
			{
				label: '人物驱动',
				rationale: '把选择压到主角身上。',
				replacement: {
					title: target.title,
					summary: '记者必须在搭档与名单之间做出选择。',
					purpose: target.purpose,
					goal: target.goal ?? '',
					conflict: '搭档拒绝继续调查。',
					outcome: target.outcome ?? '',
					hook: target.hook ?? '',
					povHint: target.povHint ?? ''
				}
			},
			{
				label: '节奏收紧',
				rationale: '减少解释，提前转折。',
				replacement: {
					title: '名单反噬',
					summary: target.summary,
					purpose: target.purpose,
					goal: target.goal ?? '',
					conflict: target.conflict ?? '',
					outcome: '记者失去一段关键记忆。',
					hook: target.hook ?? '',
					povHint: target.povHint ?? ''
				}
			}
		], '2026-07-30T01:01:00.000Z')
	};
}

describe('outline author control model', () => {
	it('creates field-level diffs and applies only author-selected changed fields', () => {
		const fixture = preview();
		const diffs = diffOutlineCandidate(
			fixture.target,
			fixture.preview.alternatives[0].replacement
		);
		expect(diffs.filter(diff => diff.changed).map(diff => diff.field)).toEqual([
			'summary',
			'conflict',
			'hook'
		]);

		const result = applyOutlineCandidateSelection(
			fixture.state,
			fixture.preview,
			0,
			['conflict']
		);
		const updated = result.state.outline[1];
		expect(updated.conflict).toBe('公开名单会立即抹去记者最后的私人记忆。');
		expect(updated.summary).toBe(fixture.target.summary);
		expect(updated.hook).toBe(fixture.target.hook);
		expect(updated.source).toBe('ai_revised');
		expect(result.impact.changedFields).toEqual(['conflict']);
		expect(result.undo.appliedJourneyRevision).toBe(result.state.revision);
	});

	it('rejects stale, empty, unchanged, and locked application without mutation', () => {
		const fixture = preview();
		expect(() => applyOutlineCandidateSelection(
			{ ...fixture.state, revision: fixture.state.revision + 1 },
			fixture.preview,
			0,
			['conflict']
		)).toThrow('outlineCandidateStale');
		expect(() => applyOutlineCandidateSelection(
			fixture.state,
			fixture.preview,
			0,
			[]
		)).toThrow('outlineCandidateSelectionRequired');
		expect(() => applyOutlineCandidateSelection(
			fixture.state,
			fixture.preview,
			0,
			['title']
		)).toThrow('outlineCandidateFieldUnchanged');

		const locked = toggleJourneyLock(fixture.state, {
			kind: 'outline',
			id: fixture.target.id
		}, true);
		const lockedPreview = {
			...fixture.preview,
			baseJourneyRevision: locked.revision
		};
		expect(() => applyOutlineCandidateSelection(
			locked,
			lockedPreview,
			0,
			['conflict']
		)).toThrow('creationJourneyTargetLocked');
	});

	it('reports exact downstream nodes without modifying them and provides guarded undo', () => {
		const fixture = preview();
		const impact = analyzeOutlineCandidateImpact(
			fixture.state,
			fixture.target.id,
			['summary', 'hook']
		);
		expect(impact.targetId).toBe(fixture.target.id);
		expect(impact.downstreamNodes.map(node => node.id)).toEqual(
			fixture.state.outline.slice(2).map(node => node.id)
		);
		expect(impact.materializedChapterIds).toEqual([]);
		expect(impact.materializedSceneIds).toEqual([]);

		const applied = applyOutlineCandidateSelection(
			fixture.state,
			fixture.preview,
			0,
			['summary', 'hook']
		);
		const undone = undoOutlineCandidateApply(applied.state, applied.undo);
		expect(undone.outline.map(node => node.summary)).toEqual(
			fixture.state.outline.map(node => node.summary)
		);
		expect(() => undoOutlineCandidateApply(
			{ ...applied.state, revision: applied.state.revision + 1 },
			applied.undo
		)).toThrow('outlineCandidateUndoStale');
	});
});
