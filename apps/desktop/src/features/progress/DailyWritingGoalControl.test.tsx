import { fireEvent, render, screen } from '@testing-library/react';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../app/store';
import { localDateKey } from './DailyWritingProgressModel';
import { DailyWritingGoalControl } from './DailyWritingGoalControl';

const snapshot: ProjectSnapshot = {
	root: 'D:/Writing Goal Fixture',
	projectRevision: 'goal-revision',
	project: {
		schemaVersion: 1,
		projectId: 'project-goal',
		title: '雾港来信',
		volumes: []
	},
	resources: [],
	wordCounts: {},
	integrityIssues: [],
	readOnly: false
};

afterEach(() => {
	useAppStore.setState({ snapshot: undefined, writingProgress: {} });
});

describe('DailyWritingGoalControl', () => {
	it('shows progress and updates a valid project goal with the keyboard form', () => {
		useAppStore.setState({
			snapshot,
			writingProgress: {
				'project-goal': {
					goal: 1_000,
					days: [{ date: localDateKey(), words: 420 }]
				}
			}
		});
		render(<DailyWritingGoalControl placement="dashboard" />);

		fireEvent.click(screen.getByLabelText(/今日写作进度 420 \/ 1,000 字/u));
		fireEvent.change(screen.getByLabelText('每日目标'), { target: { value: '1500' } });
		fireEvent.submit(screen.getByLabelText('每日目标').closest('form') as HTMLFormElement);

		expect(screen.getByRole('status')).toHaveTextContent('今日目标已更新为 1,500 字');
		expect(useAppStore.getState().writingProgress['project-goal']?.goal).toBe(1_500);
	});

	it('keeps invalid values inline and does not mutate the goal', () => {
		useAppStore.setState({ snapshot, writingProgress: {} });
		render(<DailyWritingGoalControl placement="header" />);

		fireEvent.click(screen.getByLabelText(/今日写作进度/u));
		fireEvent.change(screen.getByLabelText('每日目标'), { target: { value: '99' } });
		fireEvent.submit(screen.getByLabelText('每日目标').closest('form') as HTMLFormElement);

		expect(screen.getByRole('alert')).toHaveTextContent('100–100,000');
		expect(useAppStore.getState().writingProgress).toEqual({});
	});
});
