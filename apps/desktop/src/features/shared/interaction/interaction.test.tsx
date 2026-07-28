import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	AiCandidateFrame,
	AiCandidateStatus,
	DragOverlayCard,
	DropIndicator,
	TreeRow,
	UndoToast
} from '.';

describe('shared interaction components', () => {
	it('keeps selection and drag state independent on a tree row', () => {
		const { container } = render(
			<TreeRow selected state="drop-valid">
				<span>第四章</span>
				<DropIndicator state="valid" placement="after" label="移动到第四章之后" />
			</TreeRow>
		);
		const row = container.querySelector('.interaction-tree-row');
		expect(row).toHaveAttribute('data-selected', 'true');
		expect(row).toHaveAttribute('data-interaction-state', 'drop-valid');
		expect(screen.getByLabelText('移动到第四章之后')).toBeInTheDocument();
	});

	it('uses labeled AI states and a bounded shared drag overlay', () => {
		render(
			<>
				<AiCandidateFrame state="conflict">
					<AiCandidateStatus state="conflict" />
				</AiCandidateFrame>
				<DragOverlayCard
					icon={<span>图</span>}
					kind="章节"
					title="雨夜旧车站"
					hint="移动到第一卷第 4 位"
				/>
			</>
		);
		expect(screen.getByText('需处理')).toBeInTheDocument();
		expect(screen.getByText('移动到第一卷第 4 位')).toBeInTheDocument();
	});

	it('announces a result and exposes explicit undo and dismiss actions', () => {
		const onUndo = vi.fn();
		const onDismiss = vi.fn();
		render(
			<UndoToast
				title="项目结构已更新"
				message="第四章已移动"
				onUndo={onUndo}
				onDismiss={onDismiss}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: '撤销' }));
		fireEvent.click(screen.getByRole('button', { name: '关闭撤销提示' }));
		expect(onUndo).toHaveBeenCalledOnce();
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
