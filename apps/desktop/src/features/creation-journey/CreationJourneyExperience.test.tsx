import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';

function resetWorkspace(): void {
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
		projectWizardOpen: false,
		loading: false,
		error: undefined,
		activeMode: 'works',
		storyView: 'characters',
		theme: 'paper',
		accent: 'gold'
	});
}

describe('Phase 1.2B creation journey experience', () => {
	beforeEach(async () => {
		resetWorkspace();
		await desktopBridge.saveDeepSeekKey('browser-fixture');
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('moves from three ideas to three saved chapters without automatic AI', async () => {
		const user = userEvent.setup();
		const aiSpy = vi.spyOn(desktopBridge, 'startAiGeneration');
		const materializeSpy = vi.spyOn(desktopBridge, 'materializeCreationJourney');
		render(<App />);

		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: '新建项目' }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		await user.type(within(dialog).getByLabelText('作品名称'), '雨夜记忆');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));

		expect(await within(dialog).findByRole('heading', { name: '你现在从哪里开始？' }))
			.toBeInTheDocument();
		expect(within(dialog).getAllByRole('button', { name: /进入|打开/ })).toHaveLength(6);
		expect(within(dialog).getByRole('button', { name: /我只有几个想法/ }))
			.toHaveAttribute('aria-pressed', 'true');
		expect(aiSpy).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '初始结构' })).toBeInTheDocument();
		const firstChapterOption = within(dialog).getByText('创建第一章草稿').closest('label');
		expect(firstChapterOption?.querySelector('input')).toBeDisabled();
		expect(firstChapterOption?.querySelector('input')).not.toBeChecked();

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /创建项目/ }));

		expect(await screen.findByRole('heading', { name: '先把脑中的碎片放下来' }))
			.toHaveFocus();
		expect(aiSpy).not.toHaveBeenCalled();
		const ideas = screen.getAllByPlaceholderText('例如：一个只在雨夜出现的旧车站');
		await user.type(ideas[0], '旧车站玻璃顶');
		await user.type(ideas[1], '失忆记者');
		await user.type(ideas[2], '每天重置的夜雨');
		await user.click(screen.getByRole('button', { name: '整理成故事核心' }));

		expect(await screen.findByRole('heading', { name: '把碎片收束成一个故事核心' }))
			.toBeInTheDocument();
		expect(aiSpy).toHaveBeenCalledTimes(1);
		expect(screen.getByDisplayValue(/失忆记者必须在一夜内/)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '确认故事核心' }));

		expect(await screen.findByRole('heading', { name: '比较三个真正不同的方向' }))
			.toBeInTheDocument();
		expect(aiSpy).toHaveBeenCalledTimes(1);
		await user.click(screen.getByRole('button', { name: '生成 3 个故事方向' }));
		await waitFor(() => {
			expect(aiSpy).toHaveBeenCalledTimes(2);
			expect(screen.queryByRole('alert')).not.toBeInTheDocument();
			expect(screen.getAllByRole('button', { name: /选择此方向/ })).toHaveLength(3);
		});
		expect(aiSpy).toHaveBeenCalledTimes(2);
		await user.click(screen.getAllByRole('button', { name: /选择此方向/ })[0]);
		await user.click(screen.getByRole('button', { name: '生成故事总纲' }));

		expect(await screen.findByRole('heading', { name: '调整故事节点的顺序' }))
			.toBeInTheDocument();
		expect(aiSpy).toHaveBeenCalledTimes(3);
		expect(screen.getAllByLabelText('节点标题').map(input => (input as HTMLInputElement).value).slice(0, 2))
			.toEqual(['雨夜抵达', '重复雨痕']);
		await user.click(screen.getAllByRole('button', { name: /下移总纲节点/ })[0]);
		expect(screen.getAllByLabelText('节点标题').map(input => (input as HTMLInputElement).value).slice(0, 2))
			.toEqual(['重复雨痕', '雨夜抵达']);
		await user.click(screen.getByRole('button', { name: '拆分为 3 个开篇章节' }));

		expect(await screen.findByRole('heading', { name: '确认前三章怎样承接总纲' }))
			.toBeInTheDocument();
		expect(screen.getAllByText(/第 [123] 章/)).toHaveLength(3);
		expect(aiSpy).toHaveBeenCalledTimes(4);
		await user.click(screen.getByRole('button', { name: '创建 3 章并进入第一章' }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { level: 1, name: '夜雨站台' })).toBeInTheDocument();
		});
		expect(materializeSpy).toHaveBeenCalledTimes(1);
		expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters).toHaveLength(3);
	}, 20_000);
});
