import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
	it('TC-DAILY-WRITING-GOAL-001 daily-writing-goal-form renders accessible visible enabled progress, opens by pointer and persists keyboard save success', async () => {
		const user = userEvent.setup();
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
		const form = screen.getByRole('form', { name: '每日写作目标设置' });
		expect(form).toHaveAttribute('data-testid', 'daily-writing-goal-form');
		expect(form).toHaveAttribute('data-placement', 'dashboard');

		await user.click(screen.getByLabelText(/今日写作进度 420 \/ 1,000 字/u));
		const input = screen.getByLabelText('每日目标');
		await user.clear(input);
		await user.type(input, '1500');
		await user.keyboard('{Enter}');

		expect(screen.getByRole('status')).toHaveTextContent('今日目标已更新为 1,500 字');
		expect(useAppStore.getState().writingProgress['project-goal']?.goal).toBe(1_500);
	});

	it('TC-DAILY-WRITING-GOAL-002 daily-writing-goal-form reports invalid failure inline without persistence mutation', () => {
		useAppStore.setState({ snapshot, writingProgress: {} });
		render(<DailyWritingGoalControl placement="header" />);
		const form = screen.getByRole('form', { name: '每日写作目标设置' });
		expect(form).toHaveAttribute('data-testid', 'daily-writing-goal-form');
		expect(form).toHaveAttribute('data-placement', 'header');

		fireEvent.click(screen.getByLabelText(/今日写作进度/u));
		fireEvent.change(screen.getByLabelText('每日目标'), { target: { value: '99' } });
		fireEvent.submit(form);

		expect(screen.getByRole('alert')).toHaveTextContent('100–100,000');
		expect(useAppStore.getState().writingProgress).toEqual({});
	});
});
