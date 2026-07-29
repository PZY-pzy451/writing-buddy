import { render, screen } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

describe('workspace shortcut discoverability', () => {
	it('shows every pane and writer shortcut in Settings', () => {
		render(<SettingsPage />);

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
