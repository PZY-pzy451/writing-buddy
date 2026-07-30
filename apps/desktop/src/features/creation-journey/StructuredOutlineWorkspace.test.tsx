import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import {
	createCreationJourneyState,
	setGeneratedGenreOutline,
	updateGenreToOutlineInput,
	type CreationJourneyState
} from './CreationJourneyModel';
import {
	analyzeOutlineCandidateImpact,
	createOutlineCandidatePreview
} from './OutlineAuthorControlModel';
import {
	applyHierarchyExpansionPreview,
	buildHierarchyExpansionPreview,
	type HierarchyExpansionPreview
} from './OutlineHierarchyExpansionModel';
import { StructuredOutlineWorkspace } from './StructuredOutlineWorkspace';

function generatedState(): CreationJourneyState {
	let id = 0;
	const initial = updateGenreToOutlineInput(
		createCreationJourneyState('workspace-ui', { startRoute: 'genre' }),
		{ genre: '都市悬疑' }
	);
	return setGeneratedGenreOutline(initial, {
		outline: {
			title: '雨夜旧站',
			genre: '都市悬疑',
			premise: '记者追查只在雨夜出现的旧车站。'
		},
		storyBeats: Array.from({ length: 5 }, (_, index) => ({
			title: `故事节点 ${index + 1}`,
			summary: `推进调查 ${index + 1}`,
			goal: `取得线索 ${index + 1}`,
			conflict: `遭遇阻碍 ${index + 1}`,
			outcome: `留下变化 ${index + 1}`
		})),
		suggestedCharacters: [],
		suggestedWorldRules: [],
		warnings: []
	}, {
		id: prefix => `${prefix}:ui-${++id}`
	});
}

function writableHierarchyState(): CreationJourneyState {
	let state = generatedState();
	state = applyHierarchyExpansionPreview(
		state,
		buildHierarchyExpansionPreview(
			state,
			{ kind: 'story' },
			[{ title: '第一卷', summary: '调查开始。' }],
			() => 'journey-outline:volume-ui'
		)
	);
	state = applyHierarchyExpansionPreview(
		state,
		buildHierarchyExpansionPreview(
			state,
			{ kind: 'volume', id: 'journey-outline:volume-ui' },
			[{ title: '第一章', summary: '记者进入旧站。' }],
			() => 'journey-outline:chapter-ui'
		)
	);
	return applyHierarchyExpansionPreview(
		state,
		buildHierarchyExpansionPreview(
			state,
			{ kind: 'chapter', id: 'journey-outline:chapter-ui' },
			[{ title: '进入候车厅', summary: '记者发现失踪者名单。' }],
			() => 'journey-outline:scene-ui'
		)
	);
}

describe('StructuredOutlineWorkspace', () => {
	it('provides tree, cards, inspector, lock, reorder, undo, and explicit save', async () => {
		const user = userEvent.setup();
		const save = vi.fn();

		function Harness() {
			const [state, setState] = useState(generatedState);
			return (
				<StructuredOutlineWorkspace
					state={state}
					readOnly={false}
					status="已保存到项目"
					onChange={setState}
					onSave={save}
				/>
			);
		}

		render(<Harness />);

		expect(screen.getByRole('navigation', { name: '故事结构树' })).toBeInTheDocument();
		expect(screen.getByRole('main', { name: '大纲卡片' })).toBeInTheDocument();
		const inspector = screen.getByRole('complementary', { name: '当前节点详情' });
		expect(inspector).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /选择故事节点 2/ }));
		const title = within(inspector).getByLabelText('节点标题');
		await user.clear(title);
		await user.type(title, '第二次雨夜');
		expect(title).toHaveValue('第二次雨夜');

		await user.click(within(inspector).getByRole('button', { name: '锁定此节点' }));
		expect(title).toBeDisabled();
		await user.click(within(inspector).getByRole('button', { name: '解除节点锁定' }));

		await user.click(screen.getByRole('button', { name: '上移故事节点 2' }));
		expect(screen.getAllByTestId('outline-card-title').slice(0, 2).map(node => node.textContent))
			.toEqual(['第二次雨夜', '故事节点 1']);
		await user.click(screen.getByRole('button', { name: '撤销大纲改动' }));
		expect(screen.getAllByTestId('outline-card-title').slice(0, 2).map(node => node.textContent))
			.toEqual(['故事节点 1', '第二次雨夜']);

		const firstCard = screen.getByRole('article', { name: /大纲卡片 1/ });
		const thirdCard = screen.getByRole('article', { name: /大纲卡片 3/ });
		fireEvent.dragStart(firstCard);
		fireEvent.dragOver(thirdCard);
		fireEvent.drop(thirdCard);
		expect(screen.getAllByTestId('outline-card-title').slice(0, 3).map(node => node.textContent))
			.toEqual(['第二次雨夜', '故事节点 3', '故事节点 1']);

		await user.click(screen.getByRole('button', { name: '保存大纲' }));
		expect(save).toHaveBeenCalledTimes(1);
		expect(screen.queryByText(/创建章节|生成场景/)).not.toBeInTheDocument();
	});

	it('reviews Current/A/B/C field diffs, partially adopts, reports impact, and undoes', async () => {
		const user = userEvent.setup();
		const generate = vi.fn((nodeId: string) => {
			const state = generatedState();
			const target = state.outline.find(node => node.id === nodeId)!;
			return Promise.resolve(createOutlineCandidatePreview(state, target.id, [
				{
					label: '冲突升级',
					rationale: '让线索带来直接代价。',
					replacement: {
						title: target.title,
						summary: '记者拿到名单，却发现自己的名字也在其中。',
						purpose: target.purpose,
						goal: target.goal ?? '',
						conflict: '公开名单会抹去最后的私人记忆。',
						outcome: target.outcome ?? '',
						hook: '名单末尾出现明天的日期。',
						povHint: target.povHint ?? ''
					}
				},
				{
					label: '人物驱动',
					rationale: '让主角主动选择。',
					replacement: {
						title: target.title,
						summary: '记者必须在搭档与名单之间做出选择。',
						purpose: target.purpose,
						goal: target.goal ?? '',
						conflict: '搭档拒绝继续调查。',
						outcome: target.outcome ?? '',
						hook: target.hook ?? '',
						povHint: target.povHint ?? ''
					}
				},
				{
					label: '节奏收紧',
					rationale: '提前转折。',
					replacement: {
						title: '名单反噬',
						summary: target.summary,
						purpose: target.purpose,
						goal: target.goal ?? '',
						conflict: target.conflict ?? '',
						outcome: '记者失去关键记忆。',
						hook: target.hook ?? '',
						povHint: target.povHint ?? ''
					}
				}
			]));
		});
		const apply = vi.fn((
			preview: ReturnType<typeof createOutlineCandidatePreview>,
			_index: number,
			fields: readonly string[]
		) => Promise.resolve(analyzeOutlineCandidateImpact(
			generatedState(),
			preview.targetId,
			fields as never
		)));
		const undo = vi.fn(() => Promise.resolve());

		render(
			<StructuredOutlineWorkspace
				state={generatedState()}
				readOnly={false}
				status="已保存到项目"
				onChange={vi.fn()}
				onSave={vi.fn()}
				onGenerateAlternatives={generate}
				onApplyAlternative={apply}
				onUndoAlternativeApply={undo}
				canUndoAlternativeApply={true}
			/>
		);

		await user.click(screen.getByRole('button', { name: /选择故事节点 2/ }));
		await user.selectOptions(screen.getByLabelText('局部生成策略'), 'strengthen-conflict');
		await user.click(screen.getByRole('button', { name: '生成 3 个局部候选' }));

		const review = await screen.findByRole('region', { name: '局部候选审核' });
		expect(within(review).getByText('Current')).toBeInTheDocument();
		expect(within(review).getByRole('tab', { name: /A · 冲突升级/ })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(within(review).getByRole('tab', { name: /B · 人物驱动/ })).toBeInTheDocument();
		expect(within(review).getByRole('tab', { name: /C · 节奏收紧/ })).toBeInTheDocument();
		expect(within(review).getByText('公开名单会抹去最后的私人记忆。'))
			.toBeInTheDocument();

		await user.click(within(review).getByRole('checkbox', { name: '采用 一句话概要' }));
		await user.click(within(review).getByRole('button', { name: '采用已选 2 个字段' }));
		expect(apply).toHaveBeenCalledTimes(1);
		const [appliedPreview, appliedIndex, appliedFields] = apply.mock.calls[0];
		expect(appliedPreview.targetId).toContain('journey-outline:');
		expect(appliedIndex).toBe(0);
		expect(appliedFields).toEqual(['conflict', 'hook']);

		const impact = await screen.findByRole('region', { name: '影响报告' });
		expect(within(impact).getByText(/只报告，不会自动重写/)).toBeInTheDocument();
		expect(within(impact).getByText(/当前没有物化章节、场景或正文锚点/))
			.toBeInTheDocument();
		await user.click(within(impact).getByRole('button', { name: '撤销本次 AI 采用' }));
		expect(undo).toHaveBeenCalledTimes(1);
	});

	it('previews a split, reports preservation and conflicts, and mutates only on confirmation', async () => {
		const user = userEvent.setup();
		const generate = vi.fn((target: { readonly kind: 'story' }) => (
			Promise.resolve(buildHierarchyExpansionPreview(
				generatedState(),
				target,
				[{
					title: '第一卷 雨夜来客',
					summary: '记者发现旧车站与失踪案有关。',
					goal: '建立谜团',
					conflict: '记忆开始消退',
					outcome: '记者决定进入旧站',
					hook: '玻璃顶出现第二组雨痕'
				}],
				() => 'journey-outline:volume-ui'
			))
		));
		const confirm = vi.fn();

		function Harness() {
			const [state, setState] = useState(generatedState);
			const confirmPreview = (preview: HierarchyExpansionPreview) => {
				confirm(preview);
				setState(current => applyHierarchyExpansionPreview(current, preview));
				return Promise.resolve();
			};
			return (
				<StructuredOutlineWorkspace
					state={state}
					readOnly={false}
					status="已保存到项目"
					onChange={setState}
					onSave={vi.fn()}
					onGenerateHierarchy={generate as never}
					onConfirmHierarchy={confirmPreview}
					onMaterializeHierarchy={() => Promise.resolve(true)}
				/>
			);
		}

		render(<Harness />);
		expect(document.querySelectorAll('.primary-button:not(:disabled)')).toHaveLength(1);
		expect(screen.getAllByRole('button', { name: '拆分为卷' })).toHaveLength(1);
		await user.click(screen.getByRole('button', { name: '拆分为卷' }));

		const preview = await screen.findByRole('region', { name: '拆分预览' });
		expect(within(preview).getByText('预计创建 1 个卷')).toBeInTheDocument();
		expect(within(preview).getByText('保留锁定 0 个')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /选择第一卷 雨夜来客/ }))
			.not.toBeInTheDocument();
		expect(document.querySelectorAll('.primary-button:not(:disabled)')).toHaveLength(1);

		await user.click(within(preview).getByRole('button', { name: '确认拆分' }));
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(await screen.findByRole('button', { name: '选择第一卷 雨夜来客' }))
			.toBeInTheDocument();
		expect(screen.getAllByTestId('outline-card-title')).toHaveLength(5);
	});

	it('keeps exactly one enabled primary action in the atomic apply dialog', async () => {
		const user = userEvent.setup();
		const materialize = vi.fn(() => Promise.resolve(true));

		render(
			<StructuredOutlineWorkspace
				state={writableHierarchyState()}
				readOnly={false}
				status="已保存到项目"
				onChange={vi.fn()}
				onSave={vi.fn()}
				onMaterializeHierarchy={materialize}
			/>
		);

		await user.click(screen.getByRole('button', { name: '选择进入候车厅' }));
		await user.click(screen.getByRole('button', { name: '开始写作' }));

		expect(screen.getByRole('dialog', { name: '创建可写卷、章节和场景' }))
			.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '开始写作' })).toBeDisabled();
		expect(document.querySelectorAll('.primary-button:not(:disabled)')).toHaveLength(1);

		await user.click(screen.getByRole('button', { name: '确认创建并开始写作' }));
		expect(materialize).toHaveBeenCalledTimes(1);
	});
});
