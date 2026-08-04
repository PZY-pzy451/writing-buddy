import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import {
	createCreationJourneyState,
	setGeneratedGenreOutline,
	updateGenreToOutlineInput,
	type CreationJourneyState
} from './CreationJourneyModel';
import type { OutlineQualityIssue } from './OutlineQualityCheckModel';
import { StructuredOutlineWorkspace } from './StructuredOutlineWorkspace';

function generatedState(): CreationJourneyState {
	let sequence = 0;
	const initial = updateGenreToOutlineInput(
		createCreationJourneyState('quality-ui', { startRoute: 'genre' }),
		{ genre: '都市悬疑' }
	);
	return setGeneratedGenreOutline(initial, {
		outline: { title: '雨夜旧站', genre: '都市悬疑', premise: '记者追查旧站。' },
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
	}, { id: prefix => `${prefix}:quality-ui-${++sequence}` });
}

function localIssue(state: CreationJourneyState): OutlineQualityIssue {
	const node = state.outline[1];
	return {
		id: 'local:status',
		code: 'chapter-manuscript-status-mismatch',
		source: 'local',
		severity: 'warning',
		title: '章节计划与正文状态不一致',
		message: '正文已有内容，但计划仍显示未开始。',
		nodeIds: [node.id],
		evidence: [{ nodeId: node.id, field: 'status', quote: 'planned' }],
		impact: '进度提示会互相矛盾。',
		suggestedAction: '核对后同步章节状态。'
	};
}

function aiIssue(state: CreationJourneyState): OutlineQualityIssue {
	const node = state.outline[2];
	return {
		id: 'ai:flat-conflict',
		code: 'flat-conflict-escalation',
		source: 'ai',
		severity: 'suggestion',
		title: '冲突升级不明显',
		message: '三个节点的阻碍强度接近。',
		nodeIds: [node.id],
		evidence: [{ nodeId: node.id, field: 'conflict', quote: node.conflict ?? '' }],
		impact: '中段紧张感可能停滞。',
		suggestedAction: '提高人物选择带来的不可逆代价。'
	};
}

describe('StructuredOutlineWorkspace outline quality check', () => {
	it('runs local rules first, separates AI suggestions, locates nodes, and never edits', async () => {
		const user = userEvent.setup();
		const state = generatedState();
		const onChange = vi.fn();
		const runLocal = vi.fn(() => Promise.resolve([localIssue(state)]));
		const runAi = vi.fn(() => Promise.resolve([aiIssue(state)]));

		render(
			<StructuredOutlineWorkspace
				state={state}
				readOnly={false}
				status="已保存到项目"
				onChange={onChange}
				onSave={vi.fn()}
				onRunLocalOutlineCheck={runLocal}
				onRunAiOutlineCheck={runAi}
			/>
		);

		await user.click(screen.getByRole('button', { name: '检查大纲' }));
		expect(runLocal).toHaveBeenCalledTimes(1);
		expect(runAi).not.toHaveBeenCalled();
		const panel = await screen.findByRole('region', { name: '大纲检查结果' });
		expect(within(panel).getByText('本地规则')).toBeInTheDocument();
		expect(within(panel).getByText('AI 建议')).toBeInTheDocument();
		expect(within(panel).getByText(/只有再次明确点击，才会调用 AI/)).toBeInTheDocument();

		const localIssueAction = within(panel).getByRole('button', {
			name: /章节计划与正文状态不一致/
		});
		expect(localIssueAction)
			.toHaveAttribute('data-testid', 'outline-quality-issue-locate');
		await user.click(localIssueAction);
		expect(screen.getByLabelText('节点标题')).toHaveValue(state.outline[1].title);

		const aiCheck = within(panel).getByRole('button', { name: 'AI 语义检查' });
		expect(aiCheck).toHaveAttribute('data-testid', 'outline-quality-run-ai');
		await user.click(aiCheck);
		expect(runAi).toHaveBeenCalledTimes(1);
		expect(await within(panel).findByText('冲突升级不明显')).toBeInTheDocument();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('blocks repeat AI clicks while one check is running', async () => {
		const user = userEvent.setup();
		const state = generatedState();
		let resolveAi: ((issues: readonly OutlineQualityIssue[]) => void) | undefined;
		const runAi = vi.fn(() => new Promise<readonly OutlineQualityIssue[]>(resolve => {
			resolveAi = resolve;
		}));

		render(
			<StructuredOutlineWorkspace
				state={state}
				readOnly={false}
				status="已保存到项目"
				onChange={vi.fn()}
				onSave={vi.fn()}
				onRunLocalOutlineCheck={() => Promise.resolve([])}
				onRunAiOutlineCheck={runAi}
			/>
		);

		await user.click(screen.getByRole('button', { name: '检查大纲' }));
		const action = await screen.findByRole('button', { name: 'AI 语义检查' });
		await user.dblClick(action);
		expect(runAi).toHaveBeenCalledTimes(1);
		expect(action).toBeDisabled();
		resolveAi?.([]);
		expect(await screen.findByText('AI 没有发现需要提醒的语义问题。')).toBeInTheDocument();
	});
});
