import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopBridge } from '../../platform/bridge';
import { AiSettingsSection } from './AiSettingsSection';
import {
	configureAiSettingsKey,
	resetAiSettingsActionState
} from './AiSettingsActionTestHarness.test-utils';

describe('AI settings cancel credential-removal action', () => {
	beforeEach(resetAiSettingsActionState);
	afterEach(() => vi.restoreAllMocks());

	it('hides the destructive confirmation after focused keyboard cancel, leaves focus, preserves visual identity and restart state without deleting credentials', async () => {
		await configureAiSettingsKey();
		const deleteDeepSeekKey = vi.spyOn(desktopBridge, 'deleteDeepSeekKey');
		const user = userEvent.setup();
		const view = render(<AiSettingsSection />);
		await user.click(screen.getByRole('button', { name: '移除凭据' }));

		const cancel = screen.getByTestId('ai-settings-remove-credential-cancel');
		expect(cancel).toHaveAttribute('data-ai-action', 'cancel-remove-credential');
		expect(cancel).toHaveAccessibleName('取消');
		expect(cancel).toBeVisible();
		expect(cancel).toBeEnabled();
		cancel.focus();
		expect(document.activeElement).toBe(cancel);
		await user.keyboard('{Enter}');

		expect(screen.queryByRole('group', { name: '确认移除凭据' })).not.toBeInTheDocument();
		expect(document.activeElement).not.toBe(cancel);
		expect(deleteDeepSeekKey).not.toHaveBeenCalled();

		view.unmount();
		render(<AiSettingsSection />);
		expect(screen.queryByRole('group', { name: '确认移除凭据' })).not.toBeInTheDocument();
	});
});
