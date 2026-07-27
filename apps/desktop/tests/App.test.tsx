import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/app/App';
import { useAppStore } from '../src/app/store';

describe('Writing Buddy product shell', () => {
	beforeEach(() => {
		localStorage.clear();
		useAppStore.setState({
			recentProjectRoot: undefined,
			snapshot: undefined,
			activeResource: undefined,
			activeResourceId: undefined,
			session: undefined,
			resourceContent: undefined,
			resourceHash: undefined,
			openResourceIds: [],
			tabs: [],
			projectOpenError: undefined,
			pendingProjectRoot: undefined,
			projectOpenBusyAction: undefined,
			loading: false,
			error: undefined,
			activeMode: 'works'
		});
	});

	it('opens the browser fixture and keeps chapters and references in one sidebar', async () => {
		const user = userEvent.setup();
		render(<App />);
		await user.click(await screen.findByRole('button', { name: '选择项目' }));
		await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '第一章 停摆的时钟' })).toBeInTheDocument());
		expect(screen.getByText('作品内容')).toBeInTheDocument();
		expect(screen.getByText(/写作资料/)).toBeInTheDocument();
		expect(screen.getByText('林墨')).toBeInTheDocument();
		expect(screen.getByLabelText('正文编辑器')).toBeInTheDocument();
	});

	it('opens a character as a product form instead of Markdown', async () => {
		const user = userEvent.setup();
		render(<App />);
		await user.click(await screen.findByRole('button', { name: '选择项目' }));
		const character = await screen.findByRole('button', { name: /林墨/ });
		await user.click(character);
		await waitFor(() => expect(screen.getByText('人物卡')).toBeInTheDocument());
		expect(screen.getByLabelText('名称')).toHaveValue('林墨');
		expect(screen.queryByLabelText('正文编辑器')).not.toBeInTheDocument();
	});

	it('gives every system route a dedicated full-height workspace', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('navigation', { name: '全局导航' });

		for (const label of ['搜索', '审校', '版本', 'AI 测试', '设置']) {
			await user.click(screen.getByRole('button', { name: label }));
			expect(document.querySelector('.app-shell')).toHaveClass('is-system-page');
			expect(screen.queryByRole('tablist', { name: '已打开资源' })).not.toBeInTheDocument();
			const workspace = document.querySelector('.center-workspace');
			expect(workspace?.children).toHaveLength(1);
			expect(workspace?.firstElementChild).toHaveClass('canvas-surface');
		}
	});
});
