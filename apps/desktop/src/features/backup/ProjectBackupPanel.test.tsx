import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import {
	openWriterFixtureAndContinue,
	resetWriterWorkspaceFixture
} from '../../app/WriterWorkspaceTestHarness.test-utils';
import { desktopBridge } from '../../platform/bridge';

beforeEach(resetWriterWorkspaceFixture);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	localStorage.clear();
});

describe('ProjectBackupPanel author recovery', () => {
	it('renders enabled backup actions and deduplicates one hundred repeated create clicks into one successful backup', async () => {
		const user = userEvent.setup();
		const createBackup = vi.spyOn(desktopBridge, 'createBackup');
		const inspectBackup = vi.spyOn(desktopBridge, 'inspectBackup');
		render(<App />);
		await openWriterFixtureAndContinue(user);
		await user.click(screen.getByRole('button', { name: '历史' }));

		expect(await screen.findByRole('heading', { name: '项目便携备份' }))
			.toBeInTheDocument();
		const actions = screen.getAllByTestId('project-backup-action');
		expect(actions).toHaveLength(3);
		const create = actions.find(action => (
			action.getAttribute('data-backup-action') === 'create'
		));
		expect(create).toBeVisible();
		expect(create).toBeEnabled();
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				create!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		await waitFor(() => expect(createBackup).toHaveBeenCalledOnce());
		await waitFor(() => expect(inspectBackup).toHaveBeenCalledOnce());
		expect(inspectBackup).toHaveBeenCalledWith('browser-fixture.wbbackup');
		expect(await screen.findByText(/备份已创建并校验/u)).toBeInTheDocument();
		expect(screen.getByText(/校验通过/u)).toBeInTheDocument();
		const restore = screen.getAllByTestId('project-backup-action').find(action => (
			action.getAttribute('data-backup-action') === 'restore'
		));
		expect(restore).toBeEnabled();
	});
});
