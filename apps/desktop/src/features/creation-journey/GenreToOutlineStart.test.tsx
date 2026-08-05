import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
	createCreationJourneyState,
	updateGenreToOutlineInput,
	type CreationJourneyState,
	type GenreToOutlineInput
} from './CreationJourneyModel';
import { GenreToOutlineStart } from './GenreToOutlineStart';

function Harness(props: {
	readonly busy?: boolean;
	readonly status?: string;
	readonly onGenerate?: () => void;
	readonly onCancel?: () => void;
}): React.JSX.Element {
	const [state, setState] = useState<CreationJourneyState>(() => (
		createCreationJourneyState('novel-genre', {
			startRoute: 'genre',
			now: () => '2026-07-30T03:04:05.000Z'
		})
	));
	return (
		<GenreToOutlineStart
			input={state.genreInput as GenreToOutlineInput}
			readOnly={false}
			busy={props.busy ?? false}
			status={props.status ?? '草稿已保存到项目'}
			onChange={patch => setState(current => (
				updateGenreToOutlineInput(current, patch)
			))}
			onGenerate={props.onGenerate ?? (() => undefined)}
			onCancel={props.onCancel ?? (() => undefined)}
		/>
	);
}

describe('GenreToOutlineStart', () => {
	it('keeps quick mode focused, accepts custom combined genres, and persists deep controls', async () => {
		const user = userEvent.setup();
		render(<Harness />);

		expect(screen.getByRole('heading', { name: '创建你的故事' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '生成小说大纲' })).toBeDisabled();
		expect(screen.queryByLabelText('目标读者')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('选择题材'), '都市悬疑 + 科幻');
		await user.type(
			screen.getByLabelText('用一句话描述你的故事（可选）'),
			'一个能看到死亡日期的人遇到一个没有日期的人。'
		);
		expect(screen.getByRole('button', { name: '生成小说大纲' })).toBeEnabled();

		const more = screen.getByTestId('genre-outline-more-toggle');
		expect(more).toHaveAttribute('aria-expanded', 'false');
		await user.click(more);
		expect(screen.getByLabelText('目标读者')).toBeInTheDocument();
		const longForm = screen.getByRole('button', { name: '长篇' });
		expect(longForm).toHaveAttribute('data-testid', 'genre-outline-choice-option');
		expect(longForm).toHaveAttribute('data-choice-kind', 'scale');
		expect(longForm).toHaveAttribute('data-choice-value', 'novel');
		expect(screen.getAllByTestId('genre-outline-choice-option').some(control => (
			control.getAttribute('data-choice-kind') === 'tone'
		))).toBe(true);
		await user.click(longForm);
		await user.type(screen.getByLabelText('主角提示'), '调查记者, 无日期者');

		expect(screen.getByRole('button', { name: '收起更多控制' }))
			.toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('button', { name: '长篇' }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('discloses exact included fields and explicit exclusions before confirmation', async () => {
		const user = userEvent.setup();
		const onGenerate = vi.fn();
		render(<Harness onGenerate={onGenerate} />);

		await user.type(screen.getByLabelText('选择题材'), '都市悬疑');
		await user.type(
			screen.getByLabelText('用一句话描述你的故事（可选）'),
			'记者追查一座会重置记忆的车站。'
		);
		await user.click(screen.getByRole('button', { name: '查看生成依据' }));

		const dialog = screen.getByRole('dialog', { name: '生成依据' });
		expect(within(dialog).getByText('都市悬疑')).toBeInTheDocument();
		expect(within(dialog).getByText('记者追查一座会重置记忆的车站。'))
			.toBeInTheDocument();
		expect(within(dialog).getByText('全部正文')).toBeInTheDocument();
		expect(within(dialog).getByText('API Key 与账户秘密')).toBeInTheDocument();
		expect(within(dialog).getByText('绝对路径与其他项目内容')).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: '确认并生成' }));
		expect(onGenerate).toHaveBeenCalledTimes(1);
	});

	it('shows meaningful generation progress and cancellation without replacing the draft', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		render(
			<Harness
				busy
				status="正在生成结构节点"
				onCancel={onCancel}
			/>
		);

		expect(screen.getByLabelText('选择题材')).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent('正在生成结构节点');
		expect(screen.getByText('正在整理题材')).toBeInTheDocument();
		expect(screen.getByText('正在构建故事核心')).toBeInTheDocument();
		expect(screen.getByText('正在校验大纲')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '停止生成' }));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
