import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import {
	confirmStoryCore,
	createCreationJourneyState,
	parseCreationJourneyState,
	selectStoryDirections,
	serializeCreationJourneyState,
	setGeneratedStoryCore,
	setJourneyChapterProposals,
	setStoryDirections,
	setStoryOutline,
	updateStoryElement
} from './CreationJourneyModel';
import { CreationJourneyPage } from './CreationJourneyPage';

const now = () => '2026-07-30T01:02:03.000Z';

function completeJourney() {
	let state = createCreationJourneyState('novel-001', {
		id: (() => {
			let index = 0;
			return () => `journey-element:${++index}`;
		})(),
		now
	});
	['旧车站玻璃顶', '失忆记者', '每天重置的夜雨'].forEach((text, index) => {
		state = updateStoryElement(state, state.elements[index].id, { text }, now);
	});
	state = setGeneratedStoryCore(state, {
		oneSentence: '失忆记者必须在一夜内找回被抹去的车站真相。',
		protagonist: '失忆记者林越',
		goal: '找回记忆并公开真相',
		obstacle: '操控记忆的站长',
		stakes: '失败会让城市忘记失踪者',
		mystery: '雨痕为何每天相同',
		readerExperience: '克制而紧张的悬疑体验',
		endingDirection: '公开真相但失去私人记忆'
	}, now);
	state = confirmStoryCore(state, now);
	state = setStoryDirections(state, [
		{
			id: 'journey-direction:truth',
			title: '公开真相',
			premise: '调查集体遗忘事故。',
			centralConflict: '真相会摧毁私人记忆。',
			endingPromise: '以公开与遗忘的交换收束。',
			tone: '克制悬疑'
		},
		{
			id: 'journey-direction:loop',
			title: '打破循环',
			premise: '车站困在同一个雨夜。',
			centralConflict: '接近出口就会失忆。',
			endingPromise: '主动留下守门结束循环。',
			tone: '高概念惊悚'
		},
		{
			id: 'journey-direction:family',
			title: '寻找姐姐',
			premise: '事故真相指向姐姐。',
			centralConflict: '姐姐可能制造了循环。',
			endingPromise: '以姐妹之间的选择收束。',
			tone: '情感悬疑'
		}
	], now);
	state = selectStoryDirections(state, ['journey-direction:truth'], now);
	state = setStoryOutline(state, Array.from({ length: 5 }, (_, index) => ({
		id: `journey-outline:${index + 1}`,
		title: `节点 ${index + 1}`,
		summary: `第 ${index + 1} 个故事推进`,
		purpose: '推进调查'
	})), now);
	return setJourneyChapterProposals(state, Array.from({ length: 3 }, (_, index) => ({
		id: `journey-chapter:${index + 1}`,
		title: `第 ${index + 1} 章`,
		goal: '推进主角调查',
		summary: '形成一次可见的选择',
		sourceNodeIds: [`journey-outline:${index + 1}`]
	})), now);
}

describe('Phase 1.2C guided creation journey experience', () => {
	beforeEach(async () => {
		localStorage.clear();
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		useAppStore.setState({
			snapshot: {
				root: 'D:/Novel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-001',
					title: 'Novel',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			}
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		act(() => {
			useAppStore.setState({ snapshot: undefined });
		});
		localStorage.clear();
	});

	it('asks one explicit question, locks decisions, and resolves impacts one item at a time', async () => {
		const user = userEvent.setup();
		let persisted = serializeCreationJourneyState(completeJourney());
		vi.spyOn(desktopBridge, 'readCreationJourneyState').mockResolvedValue({
			content: persisted,
			hash: 'journey-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		vi.spyOn(desktopBridge, 'writeCreationJourneyState').mockImplementation(
			(_root, content) => {
				persisted = content;
				return Promise.resolve({
					hash: `journey-hash-${parseCreationJourneyState(content).revision}`,
					byteLength: content.length,
					modifiedAt: now()
				});
			}
		);
		const aiSpy = vi.spyOn(desktopBridge, 'startAiGeneration');
		render(<CreationJourneyPage />);
		const waitForJourneySave = () => waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('已保存到项目');
		});

		expect(await screen.findByRole('heading', { name: '确认前三章怎样承接总纲' }))
			.toBeInTheDocument();
		expect(aiSpy).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: '让 AI 问一个关键问题' }));
		const question = await screen.findByRole('heading', {
			name: '如果主角失败，他最不能承受失去什么？'
		});
		const questionCard = question.closest('section');
		expect(questionCard).not.toBeNull();
		expect(within(questionCard!).getAllByRole('button', { pressed: false })).toHaveLength(3);
		await user.click(within(questionCard!).getByRole('button', { name: /最后的记忆/ }));
		await user.click(within(questionCard!).getByRole('button', { name: '确认这个答案' }));
		await waitFor(() => expect(question).not.toBeInTheDocument());
		await waitForJourneySave();
		expect(aiSpy).toHaveBeenCalledTimes(1);
		expect(parseCreationJourneyState(persisted).guidance.answers).toHaveLength(1);

		await user.click(screen.getByRole('button', { name: /故事核心/ }));
		const stakes = await screen.findByLabelText('失败代价');
		await user.click(screen.getByRole('button', { name: '锁定失败代价' }));
		expect(stakes).toBeDisabled();
		await user.click(screen.getByRole('button', { name: '解锁失败代价' }));
		expect(stakes).toBeEnabled();
		await user.clear(stakes);
		await user.type(stakes, '失败会让姐姐永远不存在');
		await waitForJourneySave();

		expect(await screen.findByText('上游内容已修改，下游草稿仍保持原样'))
			.toBeInTheDocument();
		expect(screen.getByText('方向 3 项 · 提纲 5 项 · 章节 3 项待处理'))
			.toBeInTheDocument();
		const opener = screen.getByRole('button', { name: '查看影响' });
		await user.click(opener);
		const dialog = await screen.findByRole('dialog', { name: '查看上游修改的影响' });
		expect(within(dialog).getAllByRole('button', { name: '保留当前内容' })).toHaveLength(11);

		await user.click(within(dialog).getAllByRole('button', { name: '保留当前内容' })[0]);
		await waitFor(() => {
			expect(within(dialog).getAllByRole('button', { name: '保留当前内容' })).toHaveLength(10);
		});
		await waitForJourneySave();
		await user.click(within(dialog).getAllByRole('button', { name: 'AI 重新生成此项' })[0]);
		await waitFor(() => {
			expect(aiSpy).toHaveBeenCalledTimes(2);
			expect(within(dialog).getAllByRole('button', { name: '保留当前内容' })).toHaveLength(9);
		});

		await user.keyboard('{Escape}');
		await waitFor(() => expect(dialog).not.toBeInTheDocument());
		expect(opener).toHaveFocus();
		expect(parseCreationJourneyState(persisted).impacts.filter(
			impact => impact.status === 'pending'
		)).toHaveLength(9);
	}, 20_000);
});
