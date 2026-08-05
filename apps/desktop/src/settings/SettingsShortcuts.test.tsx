import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../app/store';
import { SettingsPage } from './SettingsPage';

describe('workspace shortcut discoverability', () => {
	it('shows every pane and writer shortcut and selects appearance choices in Settings', async () => {
		const user = userEvent.setup();
		useAppStore.setState({ theme: 'paper', accent: 'gold' });
		render(<SettingsPage />);

		const themeChoices = screen.getAllByTestId('settings-theme-choice');
		expect(themeChoices).toHaveLength(4);
		const midnightChoice = themeChoices.find(choice => (
			choice.getAttribute('data-theme-id') === 'midnight'
		));
		expect(midnightChoice).toBeDefined();
		await user.click(midnightChoice!);
		expect(useAppStore.getState().theme).toBe('midnight');
		expect(midnightChoice).toHaveClass('is-active');

		const accentChoices = screen.getAllByTestId('settings-accent-choice');
		expect(accentChoices).toHaveLength(3);
		const blueChoice = accentChoices.find(choice => (
			choice.getAttribute('data-accent-id') === 'blue'
		));
		expect(blueChoice).toBeDefined();
		await user.click(blueChoice!);
		expect(useAppStore.getState().accent).toBe('blue');
		expect(blueChoice).toHaveClass('is-active');

		expect(screen.getByRole('heading', { name: '工作区快捷键' })).toBeInTheDocument();
		expect(screen.getByLabelText('Ctrl+B')).toHaveTextContent('CtrlB');
		expect(screen.getByLabelText('Ctrl+Alt+B')).toHaveTextContent('CtrlAltB');
		expect(screen.getByLabelText('Ctrl+J')).toHaveTextContent('CtrlJ');
		for (const shortcut of [
			'Ctrl/Cmd+K',
			'Ctrl/Cmd+Shift+F',
			'Ctrl/Cmd+N',
			'Ctrl/Cmd+Shift+N',
			'Ctrl/Cmd+Shift+Space',
			'Alt/Option+A',
			'F11',
			'Ctrl/Cmd+S',
			'Ctrl/Cmd+W',
			'Ctrl/Cmd+Shift+T',
			'Ctrl/Cmd+Tab',
			'Ctrl/Cmd+Z'
		]) {
			expect(screen.getByLabelText(shortcut)).toBeInTheDocument();
		}
	});
});
