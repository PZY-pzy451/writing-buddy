import { describe, expect, it } from 'vitest';
import { parseForeshadowing } from '../model/Foreshadowing';
import { parsePlotThread } from '../model/PlotThread';
import { runPlotRules } from './plotRules';

const timestamp = '2026-07-27T00:00:00.000Z';
const base = { aliases: [], tags: [], schemaVersion: 1 as const, createdAt: timestamp, updatedAt: timestamp, revision: 0, evidenceIds: [] };

describe('plot rules', () => {
	it('reports active overdue threads and unrecovered foreshadowing', () => {
		const thread = parsePlotThread({
			...base, id: 'plot-thread:notebook', type: 'plotThread', title: '遗失笔记',
			status: 'active', targetResolution: { chapterId: 'chapter:chapter-003', narrativeOrder: 3 }
		});
		const clue = parseForeshadowing({
			...base, id: 'foreshadowing:clock', type: 'foreshadowing', title: '停摆时钟',
			status: 'reminded',
			plantedAt: { chapterId: 'chapter:chapter-001', narrativeOrder: 1 },
			plannedPayoffAt: { chapterId: 'chapter:chapter-004', narrativeOrder: 4 }
		});
		const issues = runPlotRules([thread], [clue], 6);
		expect(issues.map(issue => issue.ruleId)).toEqual([
			'plot.thread-at-risk',
			'plot.foreshadowing-overdue'
		]);
		expect(issues[1]?.evidence).toHaveLength(2);
	});

	it('does not flag resolved lifecycle records', () => {
		const thread = parsePlotThread({
			...base, id: 'plot-thread:done', type: 'plotThread', title: '完成',
			status: 'resolved', targetResolution: { chapterId: 'chapter:chapter-001', narrativeOrder: 1 }
		});
		expect(runPlotRules([thread], [], 10)).toEqual([]);
	});

	it('separately reports an actual payoff that precedes the author plan', () => {
		const clue = parseForeshadowing({
			...base,
			id: 'foreshadowing:early',
			type: 'foreshadowing',
			title: '过早响起的钟',
			status: 'resolved',
			actualPayoffAt: { chapterId: 'chapter:chapter-002', narrativeOrder: 2 },
			plannedPayoffAt: { chapterId: 'chapter:chapter-006', narrativeOrder: 6 }
		});
		expect(runPlotRules([], [clue], 3).map(issue => issue.ruleId)).toEqual([
			'plot.foreshadowing-early-payoff'
		]);
	});
});
