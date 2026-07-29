import { render, screen } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

describe('workspace shortcut discoverability', () => {
	it('shows the pane shortcuts in Settings', () => {
		render(<SettingsPage />);

		expect(screen.getByRole('heading', { name: '工作区快捷键' })).toBeInTheDocument();
		expect(screen.getByLabelText('Ctrl+B')).toHaveTextContent('CtrlB');
		expect(screen.getByLabelText('Ctrl+Alt+B')).toHaveTextContent('CtrlAltB');
		expect(screen.getByLabelText('Ctrl+J')).toHaveTextContent('CtrlJ');
	});
});
