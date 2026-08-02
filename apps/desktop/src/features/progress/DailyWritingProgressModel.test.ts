import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DAILY_WRITING_GOAL,
	localDateKey,
	parseWritingProgressMap,
	recordDailyWritingDelta,
	selectTodayWritingProgress,
	setProjectDailyWritingGoal
} from './DailyWritingProgressModel';

describe('daily writing progress', () => {
	it('uses the local calendar date instead of a UTC slice', () => {
		const localEvening = new Date(2026, 7, 2, 23, 45, 0);
		expect(localDateKey(localEvening)).toBe('2026-08-02');
	});

	it('counts net editor growth and reverses words removed by undo', () => {
		const now = new Date(2026, 7, 2, 10, 0, 0);
		let progress = recordDailyWritingDelta({}, 'project-one', 240, now);
		progress = recordDailyWritingDelta(progress, 'project-one', -90, now);
		progress = recordDailyWritingDelta(progress, 'project-one', 90, now);

		expect(selectTodayWritingProgress(progress, 'project-one', now)).toMatchObject({
			words: 240,
			goal: DEFAULT_DAILY_WRITING_GOAL,
			remaining: 760,
			percent: 24,
			completed: false
		});
	});

	it('isolates projects and rolls new writing into the local day', () => {
		const firstDay = new Date(2026, 7, 2, 23, 59, 0);
		const secondDay = new Date(2026, 7, 3, 0, 1, 0);
		let progress = recordDailyWritingDelta({}, 'project-one', 500, firstDay);
		progress = recordDailyWritingDelta(progress, 'project-one', 80, secondDay);
		progress = recordDailyWritingDelta(progress, 'project-two', 30, secondDay);

		expect(selectTodayWritingProgress(progress, 'project-one', firstDay).words).toBe(500);
		expect(selectTodayWritingProgress(progress, 'project-one', secondDay).words).toBe(80);
		expect(selectTodayWritingProgress(progress, 'project-two', secondDay).words).toBe(30);
	});

	it('validates project goals and preserves the current ledger', () => {
		const now = new Date(2026, 7, 2, 10, 0, 0);
		const progress = recordDailyWritingDelta({}, 'project-one', 600, now);
		const updated = setProjectDailyWritingGoal(progress, 'project-one', 500);

		expect(selectTodayWritingProgress(updated, 'project-one', now)).toMatchObject({
			goal: 500,
			words: 600,
			remaining: 0,
			percent: 100,
			completed: true
		});
		expect(() => setProjectDailyWritingGoal(updated, 'project-one', 99)).toThrow(
			'dailyWritingGoalInvalid'
		);
	});

	it('drops malformed persisted records and defaults invalid goals', () => {
		const parsed = parseWritingProgressMap({
			'project-one': {
				goal: Number.NaN,
				days: [
					{ date: '2026-08-02', words: 320 },
					{ date: 'bad-date', words: 10 },
					{ date: '2026-08-03', words: -2 }
				]
			},
			'': { goal: 900, days: [] }
		});

		expect(parsed).toEqual({
			'project-one': {
				goal: DEFAULT_DAILY_WRITING_GOAL,
				days: [{ date: '2026-08-02', words: 320 }]
			}
		});
	});
});
