import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import {
	openWriterFixtureAndContinue,
	resetWriterWorkspaceFixture
} from '../../app/WriterWorkspaceTestHarness.test-utils';
import { useAppStore } from '../../app/store';

beforeEach(resetWriterWorkspaceFixture);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	localStorage.clear();
});

describe('WriterNavigator author navigation', () => {
	it('renders visible enabled results, previews by keyboard, opens by pointer and restores focus on Escape', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openWriterFixtureAndContinue(user);
		const trigger = screen.getByRole('button', { name: '打开作者导航器' });
		trigger.focus();

		fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
		const input = await screen.findByRole('combobox', { name: '作者导航器' });
		expect(input).toHaveFocus();
		await user.type(input, '第二章');
		const result = (await screen.findAllByTestId('writer-navigator-result')).find(control => (
			control.textContent?.includes('第二章')
		));
		expect(result).toBeVisible();
		expect(result).toBeEnabled();
		expect(result).toHaveAttribute('data-result-kind', 'chapter');
		expect(result).toHaveAttribute('data-result-id', expect.any(String));
		expect(result).toHaveAttribute('aria-selected', 'true');
		const chapterBeforePreview = useAppStore.getState().activeResourceId;

		fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
		expect(await screen.findByRole('complementary', { name: '结果预览' }))
			.toBeInTheDocument();
		expect(useAppStore.getState().activeResourceId).toBe(chapterBeforePreview);

		fireEvent.keyDown(input, { key: 'Escape' });
		await waitFor(() => expect(screen.queryByRole(
			'dialog',
			{ name: '作者导航器' }
		)).not.toBeInTheDocument());
		expect(trigger).toHaveFocus();

		await user.click(trigger);
		const reopenedInput = await screen.findByRole('combobox', { name: '作者导航器' });
		await user.type(reopenedInput, '第二章');
		const reopenedResult = (await screen.findAllByTestId('writer-navigator-result'))
			.find(control => control.textContent?.includes('第二章'));
		await user.click(reopenedResult!);
		await waitFor(() => expect(useAppStore.getState().activeResourceId)
			.not.toBe(chapterBeforePreview));
		expect(screen.queryByRole('dialog', { name: '作者导航器' }))
			.not.toBeInTheDocument();
	});
});
