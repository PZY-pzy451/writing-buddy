import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopBridge } from '../../platform/bridge';
import { AiSettingsSection } from './AiSettingsSection';
import {
	configureAiSettingsKey,
	resetAiSettingsActionState
} from './AiSettingsActionTestHarness.test-utils';

describe('AI settings request credential-removal action', () => {
	beforeEach(resetAiSettingsActionState);
	afterEach(() => vi.restoreAllMocks());

	it('renders a visible enabled accessible visual action and opens an explicit destructive confirmation without deleting credentials', async () => {
		await configureAiSettingsKey();
		const deleteDeepSeekKey = vi.spyOn(desktopBridge, 'deleteDeepSeekKey');
		const user = userEvent.setup();
		render(<AiSettingsSection />);

		const request = screen.getByTestId('ai-settings-remove-credential-request');
		expect(request).toHaveAttribute('data-ai-action', 'request-remove-credential');
		expect(request).toHaveAccessibleName('移除凭据');
		expect(request).toBeVisible();
		expect(request).toBeEnabled();
		expect(request).toHaveClass('danger-button');
		await user.click(request);

		expect(screen.getByRole('group', { name: '确认移除凭据' })).toBeInTheDocument();
		expect(deleteDeepSeekKey).not.toHaveBeenCalled();
	});
});
