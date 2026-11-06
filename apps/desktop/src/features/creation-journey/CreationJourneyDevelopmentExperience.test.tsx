import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
	updateStoryElement,
	type CreationJourneyStage,
	type CreationJourneyState
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

function journeyAt(stage: CreationJourneyStage): CreationJourneyState {
	return {
		...completeJourney(),
		stage
	};
}

function mockPersistedJourney(initial: CreationJourneyState) {
	let persisted = serializeCreationJourneyState(initial);
	vi.spyOn(desktopBridge, 'readCreationJourneyState').mockResolvedValue({
		content: persisted,
		hash: 'journey-hash',
		encoding: 'utf-8',
		eol: 'lf',
		hasBom: false
	});
	const write = vi.spyOn(desktopBridge, 'writeCreationJourneyState').mockImplementation(
		(_root, content) => {
			persisted = content;
			return Promise.resolve({
				hash: `journey-hash-${parseCreationJourneyState(content).revision}`,
				byteLength: content.length,
				modifiedAt: now()
			});
		}
	);
	return {
		write,
		persisted: () => parseCreationJourneyState(persisted)
	};
}

describe('Phase 1.2C guided creation journey experience', () => {
	beforeEach(async () => {
		localStorage.clear();
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		useAppStore.setState({
			activeMode: 'planning',
			activeResource: undefined,
			activeResourceId: undefined,
			session: undefined,
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

	it('shows and selects guided decisions by pointer, disables locked fields, saves each impact, and restores keyboard focus', async () => {
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

		const guidanceTrigger = screen.getByTestId('creation-guidance-trigger');
		expect(guidanceTrigger).toHaveAccessibleName('让 AI 问一个关键问题');
		await user.click(guidanceTrigger);
		const question = await screen.findByRole('heading', {
			name: '如果主角失败，他最不能承受失去什么？'
		});
		const questionCard = question.closest('section');
		expect(questionCard).not.toBeNull();
		const guidanceOptions = within(questionCard!).getAllByTestId('creation-guidance-option');
		expect(guidanceOptions).toHaveLength(3);
		expect(guidanceOptions.every(option => Boolean(option.getAttribute('data-option-id'))))
			.toBe(true);
		const guidanceAnswer = within(questionCard!).getByTestId('creation-guidance-answer');
		expect(guidanceAnswer).toHaveAttribute('name', 'creation-guidance-answer');
		const confirmGuidance = within(questionCard!).getByTestId('creation-guidance-confirm');
		expect(confirmGuidance).toBeDisabled();
		const selectedGuidance = within(questionCard!).getByRole('button', { name: /最后的记忆/ });
		expect(selectedGuidance).toHaveAttribute('data-testid', 'creation-guidance-option');
		expect(selectedGuidance).toHaveAttribute('data-option-id');
		await user.click(selectedGuidance);
		expect(confirmGuidance).toBeEnabled();
		await user.click(confirmGuidance);
		await waitFor(() => expect(question).not.toBeInTheDocument());
		await waitForJourneySave();
		expect(aiSpy).toHaveBeenCalledTimes(1);
		expect(parseCreationJourneyState(persisted).guidance.answers).toHaveLength(1);

		await user.click(screen.getByRole('button', { name: /故事核心/ }));
		const protagonist = await screen.findByLabelText('主角');
		expect(protagonist).toHaveAttribute('data-testid', 'creation-core-field');
		expect(protagonist).toHaveAttribute('data-field-key', 'protagonist');
		const stakes = await screen.findByLabelText('失败代价');
		expect(stakes).toHaveAttribute('data-testid', 'creation-core-field');
		expect(stakes).toHaveAttribute('data-field-key', 'stakes');
		const stakesLock = screen.getByRole('button', { name: '锁定失败代价' });
		expect(stakesLock).toHaveAttribute('data-testid', 'creation-core-field-lock');
		expect(stakesLock).toHaveAttribute('data-field-key', 'stakes');
		await user.click(stakesLock);
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
		expect(opener).toHaveAttribute('data-testid', 'creation-impact-open');
		const dismiss = screen.getByTestId('creation-impact-dismiss');
		expect(dismiss).toHaveAccessibleName('暂不更新');
		await user.click(dismiss);
		const reopen = screen.getByTestId('creation-impact-reopen');
		expect(reopen).toHaveAccessibleName('11 项影响待处理');
		reopen.focus();
		await user.keyboard('{Enter}');
		const dialog = await screen.findByRole('dialog', { name: '查看上游修改的影响' });
		expect(within(dialog).getByTestId('creation-impact-close')).toHaveFocus();
		expect(within(dialog).getByTestId('creation-impact-done')).toHaveAccessibleName('完成查看');
		const keepActions = within(dialog).getAllByTestId('creation-impact-keep');
		expect(keepActions).toHaveLength(11);
		expect(keepActions.every(action => Boolean(action.getAttribute('data-impact-id'))))
			.toBe(true);

		const keptImpactId = keepActions[0].getAttribute('data-impact-id');
		for (let index = 0; index < 100; index += 1) {
			fireEvent.click(keepActions[0]);
		}
		await waitFor(() => {
			expect(within(dialog).getAllByTestId('creation-impact-keep')).toHaveLength(10);
		});
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(within(dialog).getAllByTestId('creation-impact-keep').map(action => (
			action.getAttribute('data-impact-id')
		))).not.toContain(keptImpactId);
		await waitForJourneySave();
		const regenerateActions = within(dialog).getAllByTestId('creation-impact-regenerate');
		expect(regenerateActions.every(action => Boolean(action.getAttribute('data-impact-id'))))
			.toBe(true);
		for (let index = 0; index < 100; index += 1) {
			fireEvent.click(regenerateActions[0]);
		}
		await waitFor(() => {
			expect(aiSpy).toHaveBeenCalledTimes(2);
			expect(within(dialog).getAllByTestId('creation-impact-keep')).toHaveLength(9);
		});

		await user.keyboard('{Escape}');
		await waitFor(() => expect(dialog).not.toBeInTheDocument());
		expect(reopen).toHaveFocus();
		expect(parseCreationJourneyState(persisted).impacts.filter(
			impact => impact.status === 'pending'
		)).toHaveLength(9);
	}, 20_000);

	it('TC-CREATION-JOURNEY-CONTROLS-001 exposes exact contextual selectors and saves pointer keyboard focus lock reorder delete edits across every manual stage', async () => {
		const user = userEvent.setup();
		const persistence = mockPersistedJourney(journeyAt('chapters'));
		render(<CreationJourneyPage />);
		const stageButton = (label: string) => {
			const button = screen.getAllByTestId('creation-stage-navigation')
				.find(candidate => candidate.textContent?.includes(label));
			if (!button) throw new Error(`missing stage button: ${label}`);
			return button;
		};

		expect(await screen.findByRole('heading', { name: '确认前三章怎样承接总纲' }))
			.toBeInTheDocument();
		const chapterLocks = screen.getAllByTestId('creation-chapter-lock');
		const chapterTitles = screen.getAllByTestId('creation-chapter-title');
		const chapterGoals = screen.getAllByTestId('creation-chapter-goal');
		const chapterSummaries = screen.getAllByTestId('creation-chapter-summary');
		expect(chapterLocks).toHaveLength(3);
		expect(chapterTitles).toHaveLength(3);
		expect(chapterGoals).toHaveLength(3);
		expect(chapterSummaries).toHaveLength(3);
		expect(chapterLocks[0]).toHaveAttribute('data-chapter-id', 'journey-chapter:1');
		expect(chapterTitles[0]).toHaveAttribute('data-chapter-id', 'journey-chapter:1');
		await user.click(chapterLocks[0]);
		expect(chapterTitles[0]).toBeDisabled();
		chapterLocks[0].focus();
		await user.keyboard('{Enter}');
		expect(chapterTitles[0]).toBeEnabled();

		await user.click(stageButton('故事总纲'));
		expect(await screen.findByRole('heading', { name: '调整故事节点的顺序' }))
			.toHaveFocus();
		const outlineLocks = screen.getAllByTestId('creation-outline-lock');
		const outlineTitles = screen.getAllByTestId('creation-outline-title');
		const outlineSummaries = screen.getAllByTestId('creation-outline-summary');
		const outlinePurposes = screen.getAllByTestId('creation-outline-purpose');
		expect(outlineLocks[0]).toHaveAttribute('data-outline-node-id', 'journey-outline:1');
		expect(outlineTitles[0]).toHaveAttribute('data-outline-node-id', 'journey-outline:1');
		expect(outlineSummaries).toHaveLength(5);
		expect(outlinePurposes).toHaveLength(5);
		expect(screen.getByTestId('creation-outline-back')).toBeEnabled();
		expect(screen.getByTestId('creation-outline-split-chapters')).toBeEnabled();
		const firstOutlineTitle = (outlineTitles[0] as HTMLInputElement).value;
		await user.click(screen.getAllByTestId('creation-outline-move-down')[0]);
		expect((screen.getAllByTestId('creation-outline-title')[1] as HTMLInputElement).value)
			.toBe(firstOutlineTitle);
		await user.click(screen.getAllByTestId('creation-outline-move-up')[1]);
		expect((screen.getAllByTestId('creation-outline-title')[0] as HTMLInputElement).value)
			.toBe(firstOutlineTitle);
		await user.click(screen.getAllByTestId('creation-outline-lock')[0]);
		expect(screen.getAllByTestId('creation-outline-title')[0]).toBeDisabled();

		await user.click(stageButton('故事方向'));
		expect(await screen.findByRole('heading', { name: '比较三个真正不同的方向' }))
			.toHaveFocus();
		const directionLocks = screen.getAllByTestId('creation-direction-lock');
		const directionTitles = screen.getAllByTestId('creation-direction-title');
		expect(screen.getAllByTestId('creation-direction-premise')).toHaveLength(3);
		expect(screen.getAllByTestId('creation-direction-conflict')).toHaveLength(3);
		expect(screen.getAllByTestId('creation-direction-ending')).toHaveLength(3);
		expect(screen.getAllByTestId('creation-direction-tone')).toHaveLength(3);
		expect(directionLocks[0]).toHaveAttribute('data-direction-id', 'journey-direction:truth');
		expect(directionTitles[0]).toHaveAttribute('data-direction-id', 'journey-direction:truth');
		expect(screen.getByTestId('creation-directions-back')).toBeEnabled();
		expect(screen.getByTestId('creation-directions-generate-outline')).toBeEnabled();
		await user.click(directionLocks[0]);
		expect(directionTitles[0]).toBeDisabled();

		await user.click(stageButton('故事核心'));
		expect(await screen.findByRole('heading', { name: '把碎片收束成一个故事核心' }))
			.toHaveFocus();
		expect(screen.getByTestId('creation-core-back')).toBeEnabled();
		expect(screen.getByTestId('creation-core-confirm')).toBeEnabled();

		await user.click(stageButton('灵感'));
		expect(await screen.findByRole('heading', { name: '先把脑中的碎片放下来' }))
			.toHaveFocus();
		const elementCategories = screen.getAllByTestId('creation-element-category');
		const elementTexts = screen.getAllByTestId('creation-element-text');
		expect(elementCategories).toHaveLength(3);
		expect(elementTexts).toHaveLength(3);
		expect(elementCategories[0]).toHaveAttribute('data-element-id', 'journey-element:1');
		expect(elementTexts[0]).toHaveAttribute('data-element-id', 'journey-element:1');
		expect(screen.getAllByTestId('creation-element-lock')[0])
			.toHaveAttribute('data-element-id', 'journey-element:1');
		expect(screen.getAllByTestId('creation-element-move-up')).toHaveLength(3);
		expect(screen.getAllByTestId('creation-element-move-down')).toHaveLength(3);
		expect(screen.getAllByTestId('creation-element-delete')).toHaveLength(3);
		expect(screen.getByTestId('creation-element-organize')).toBeEnabled();
		await user.click(screen.getByTestId('creation-element-add'));
		expect(screen.getAllByTestId('creation-element-text')).toHaveLength(4);
		const deleteActions = screen.getAllByTestId('creation-element-delete');
		expect(deleteActions[3]).toHaveAttribute('data-element-id');
		await user.click(deleteActions[3]);
		expect(screen.getAllByTestId('creation-element-text')).toHaveLength(3);
		await user.click(screen.getAllByTestId('creation-element-lock')[0]);
		expect(screen.getAllByTestId('creation-element-text')[0]).toBeDisabled();

		await waitFor(() => expect(persistence.write).toHaveBeenCalled());
		expect(persistence.persisted().stage).toBe('elements');
	}, 20_000);

	it('TC-CREATION-JOURNEY-CONTROLS-002 keeps read-only stages keyboard browsable while every mutation control is disabled and 100 repeated attempts write nothing', async () => {
		const user = userEvent.setup();
		const snapshot = useAppStore.getState().snapshot;
		if (!snapshot) throw new Error('project snapshot missing');
		useAppStore.setState({ snapshot: { ...snapshot, readOnly: true } });
		const persistence = mockPersistedJourney(journeyAt('chapters'));
		render(<CreationJourneyPage />);
		const stageButton = (label: string) => {
			const button = screen.getAllByTestId('creation-stage-navigation')
				.find(candidate => candidate.textContent?.includes(label));
			if (!button) throw new Error(`missing stage button: ${label}`);
			return button;
		};

		expect(await screen.findByRole('heading', { name: '确认前三章怎样承接总纲' }))
			.toBeInTheDocument();
		expect(screen.getAllByTestId('creation-chapter-lock').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-chapter-title').every(control => (
			(control as HTMLInputElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-chapter-goal').every(control => (
			(control as HTMLTextAreaElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-chapter-summary').every(control => (
			(control as HTMLTextAreaElement).disabled
		))).toBe(true);
		expect(screen.getByTestId('creation-create-chapters')).toBeDisabled();
		expect(screen.getByTestId('creation-chapters-back')).toBeEnabled();

		stageButton('故事总纲').focus();
		await user.keyboard('{Enter}');
		expect(await screen.findByRole('heading', { name: '调整故事节点的顺序' }))
			.toHaveFocus();
		expect(screen.getAllByTestId('creation-outline-lock').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-outline-title').every(control => (
			(control as HTMLInputElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-outline-move-down').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-outline-move-up').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getByTestId('creation-outline-split-chapters')).toBeDisabled();
		expect(screen.getByTestId('creation-outline-back')).toBeEnabled();

		await user.click(stageButton('故事方向'));
		expect(await screen.findByRole('heading', { name: '比较三个真正不同的方向' }))
			.toHaveFocus();
		expect(screen.getAllByTestId('creation-direction-select').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-direction-lock').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-direction-title').every(control => (
			(control as HTMLInputElement).disabled
		))).toBe(true);
		expect(screen.getByTestId('creation-directions-back')).toBeEnabled();
		expect(screen.getByTestId('creation-directions-generate-outline')).toBeDisabled();

		await user.click(stageButton('故事核心'));
		expect(await screen.findByRole('heading', { name: '把碎片收束成一个故事核心' }))
			.toHaveFocus();
		expect(screen.getAllByTestId('creation-core-field-lock').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-core-field').every(control => (
			(control as HTMLInputElement | HTMLTextAreaElement).disabled
		))).toBe(true);
		expect(screen.getByTestId('creation-core-back')).toBeEnabled();
		expect(screen.getByTestId('creation-core-confirm')).toBeDisabled();

		await user.click(stageButton('灵感'));
		expect(await screen.findByRole('heading', { name: '先把脑中的碎片放下来' }))
			.toHaveFocus();
		expect(screen.getAllByTestId('creation-element-category').every(control => (
			(control as HTMLSelectElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-element-text').every(control => (
			(control as HTMLTextAreaElement).disabled
		))).toBe(true);
		const firstLock = screen.getAllByTestId('creation-element-lock')[0];
		expect(firstLock).toBeDisabled();
		for (let attempt = 0; attempt < 100; attempt += 1) fireEvent.click(firstLock);
		expect(firstLock).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getAllByTestId('creation-element-move-down').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getAllByTestId('creation-element-delete').every(control => (
			(control as HTMLButtonElement).disabled
		))).toBe(true);
		expect(screen.getByTestId('creation-element-add')).toBeDisabled();
		expect(screen.getByTestId('creation-element-organize')).toBeDisabled();
		expect(persistence.write).not.toHaveBeenCalled();
	}, 20_000);

	it('TC-CREATION-JOURNEY-CONTROLS-003 renders a stable error recovery control after offline AI failure and closes the alert without changing project state', async () => {
		const user = userEvent.setup();
		const persistence = mockPersistedJourney(journeyAt('elements'));
		vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockRejectedValueOnce(new Error('network_unavailable: private detail'));
		render(<CreationJourneyPage />);

		expect(await screen.findByRole('heading', { name: '先把脑中的碎片放下来' }))
			.toBeInTheDocument();
		const guidanceTrigger = screen.getByTestId('creation-guidance-trigger');
		expect(guidanceTrigger).toHaveAccessibleName('让 AI 问一个关键问题');
		await user.click(guidanceTrigger);
		const alert = await screen.findByRole('alert');
		expect(alert).not.toHaveTextContent('private detail');
		const close = within(alert).getByTestId('creation-error-close');
		expect(close).toHaveAccessibleName('关闭错误');
		await user.click(close);
		expect(alert).not.toBeInTheDocument();
		expect(persistence.write).not.toHaveBeenCalled();
	});

	it('TC-CREATION-JOURNEY-CONTROLS-004 opens the exact persisted first chapter by stable keyboard focus without rewriting the completed journey', async () => {
		const user = userEvent.setup();
		const firstChapterId = 'chapter:first';
		const state: CreationJourneyState = {
			...journeyAt('writing'),
			chapters: journeyAt('writing').chapters.map((chapter, index) => ({
				...chapter,
				resourceId: index === 0 ? firstChapterId : `chapter:${index + 1}`
			}))
		};
		const persistence = mockPersistedJourney(state);
		const snapshot = useAppStore.getState().snapshot;
		if (!snapshot) throw new Error('project snapshot missing');
		useAppStore.setState({
			snapshot: {
				...snapshot,
				project: {
					...snapshot.project,
					volumes: [{
						id: 'volume:first',
						title: '第一卷',
						chapters: [{
							id: firstChapterId,
							title: '第一章',
							file: 'chapters/chapter-first.md',
							status: 'draft',
							targetWords: 3_000,
							scene: {
								location: '',
								time: '',
								pov: '',
								characters: [],
								goal: '',
								note: ''
							}
						}]
					}]
				}
			}
		});
		vi.spyOn(desktopBridge, 'readText').mockResolvedValue({
			content: '# 第一章\n',
			hash: 'chapter-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		render(<CreationJourneyPage />);

		expect(await screen.findByRole('heading', { name: '前三章已经准备好' }))
			.toBeInTheDocument();
		const openFirst = screen.getByTestId('creation-open-first-chapter');
		expect(openFirst).toHaveAccessibleName('打开第一章');
		openFirst.focus();
		await user.keyboard('{Enter}');
		await waitFor(
			() => expect(useAppStore.getState().activeResourceId).toBe(firstChapterId),
			{ timeout: 3_000 }
		);
		expect(useAppStore.getState().activeMode).toBe('works');
		expect(persistence.write).not.toHaveBeenCalled();
	});
});
