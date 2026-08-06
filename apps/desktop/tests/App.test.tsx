import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/app/App';
import { useAppStore } from '../src/app/store';

describe('Writing Buddy product shell', () => {
	beforeEach(() => {
		localStorage.clear();
		useAppStore.setState({
			recentProjectRoot: undefined,
			recentProjectRoots: [],
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
			projectWizardOpen: false,
			activeMode: 'works'
		});
	});

	it('renders enabled Global Rail items and survives 100 repeated Story Library pointer selections', async () => {
		const user = userEvent.setup();
		render(<App />);
		const sidebar = await screen.findByRole('navigation', { name: '最近作品' });
		await user.click(within(sidebar.parentElement as HTMLElement).getByRole('button', { name: '打开项目' }));
		await screen.findByRole('main', { name: '写作首页' });
		await user.click(screen.getByRole('button', { name: '继续上次位置' }));
		await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '第一章 停摆的时钟' })).toBeInTheDocument());
		expect(screen.getByText('作品内容')).toBeInTheDocument();
		expect(screen.queryByText(/写作资料/)).not.toBeInTheDocument();
		expect(screen.getByLabelText('正文编辑器')).toBeInTheDocument();

		const storyLibrary = screen.getAllByTestId('global-rail-item')
			.find(control => control.getAttribute('data-global-mode') === 'references');
		expect(storyLibrary).toHaveAccessibleName('故事库');
		expect(storyLibrary).toBeEnabled();
		for (let selection = 0; selection < 100; selection += 1) {
			fireEvent.click(storyLibrary!);
		}
		expect(useAppStore.getState().activeMode).toBe('references');
		const library = await screen.findByRole('navigation', { name: '故事库页面' });
		expect(within(library).getByRole('button', { name: /当前相关/ })).toBeInTheDocument();
		expect(within(library).getByRole('button', { name: /人物，身份/ })).toBeInTheDocument();
	});

	it('opens a character as a product form instead of Markdown', async () => {
		const user = userEvent.setup();
		render(<App />);
		const sidebar = await screen.findByRole('navigation', { name: '最近作品' });
		await user.click(within(sidebar.parentElement as HTMLElement).getByRole('button', { name: '打开项目' }));
		await screen.findByRole('main', { name: '写作首页' });
		await user.click(screen.getByRole('button', { name: '故事库' }));
		const library = await screen.findByRole('navigation', { name: '故事库页面' });
		await user.click(within(library).getByRole('button', { name: /人物，身份/ }));
		const character = await screen.findByRole('button', { name: /林墨/ });
		await user.click(character);
		expect(await screen.findByLabelText('人物姓名')).toHaveValue('林墨');
		expect(screen.getByRole('tablist', { name: '人物详情' })).toBeInTheDocument();
		expect(screen.queryByLabelText('正文编辑器')).not.toBeInTheDocument();
	});

});
