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
});
