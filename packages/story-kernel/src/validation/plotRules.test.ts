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
});
