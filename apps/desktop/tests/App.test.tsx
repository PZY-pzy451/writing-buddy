import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/app/App';

describe('Writing Buddy product shell', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('opens the browser fixture and keeps chapters and references in one sidebar', async () => {
		render(<App />);
		await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '第一章 停摆的时钟' })).toBeInTheDocument());
		expect(screen.getByText('作品内容')).toBeInTheDocument();
		expect(screen.getByText(/写作资料/)).toBeInTheDocument();
		expect(screen.getByText('林墨')).toBeInTheDocument();
		expect(screen.getByLabelText('正文编辑器')).toBeInTheDocument();
	});

	it('opens a character as a product form instead of Markdown', async () => {
		const user = userEvent.setup();
		render(<App />);
		const character = await screen.findByRole('button', { name: /林墨/ });
		await user.click(character);
		await waitFor(() => expect(screen.getByText('人物卡')).toBeInTheDocument());
		expect(screen.getByLabelText('名称')).toHaveValue('林墨');
		expect(screen.queryByLabelText('正文编辑器')).not.toBeInTheDocument();
	});
});
