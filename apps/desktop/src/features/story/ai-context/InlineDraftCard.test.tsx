import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	createPendingDraftCandidate,
	type PendingDraftCandidate
} from './InlineDraftCandidateModel';
import { InlineDraftCard } from './InlineDraftCard';

function candidate(): PendingDraftCandidate {
	return createPendingDraftCandidate({
		id: 'draft:one',
		actionId: 'manuscript-continuation',
		projectRoot: 'D:\\Projects\\project-one',
		projectId: 'project:one',
		chapterId: 'chapter:one',
		resourceId: 'chapter:one',
		resourcePath: 'manuscripts/chapter-one.md',
		modelUri: 'writing-buddy://chapter%3Aone/manuscripts/chapter-one.md',
		mode: 'insert_at_cursor',
		start: 4,
		end: 4,
		baseDocumentRevision: 2,
		currentContent: '雨停了。',
		content: '\n\n林墨抬起头。',
		targetSummary: '第一章 / 当前光标之后',
		contextSummary: '依据当前正文与场景目标'
	});
}

describe('InlineDraftCard', () => {
	it('edits, writes and discards only through explicit author actions', () => {
		const onChange = vi.fn();
		const onCommit = vi.fn();
		const onDiscard = vi.fn();
		render(
			<InlineDraftCard
				candidate={candidate()}
				stale={false}
				onChange={onChange}
				onCommit={onCommit}
				onDiscard={onDiscard}
			/>
		);

		expect(screen.getByRole('region', { name: 'AI 临时草稿' }))
			.toHaveTextContent('第一章 / 当前光标之后');
		expect(screen.getByText('尚未写入，不计入正文字数')).toBeInTheDocument();
		fireEvent.change(screen.getByRole('textbox', { name: '编辑 AI 临时草稿' }), {
			target: { value: '作者修改后的内容' }
		});
		expect(onChange).toHaveBeenCalledWith('作者修改后的内容');

		fireEvent.click(screen.getByRole('button', { name: '写入正文' }));
		fireEvent.click(screen.getByRole('button', { name: '丢弃临时草稿' }));
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onDiscard).toHaveBeenCalledTimes(1);
	});

	it('blocks writing when stale or empty while keeping discard available', () => {
		const onDiscard = vi.fn();
		const { rerender } = render(
			<InlineDraftCard
				candidate={candidate()}
				stale
				onChange={vi.fn()}
				onCommit={vi.fn()}
				onDiscard={onDiscard}
			/>
		);
		expect(screen.getByRole('alert')).toHaveTextContent('正文已在生成后发生变化');
		expect(screen.getByRole('button', { name: '写入正文' })).toBeDisabled();
		expect(screen.getByRole('button', { name: '丢弃临时草稿' })).toBeEnabled();

		rerender(
			<InlineDraftCard
				candidate={{ ...candidate(), content: '   ', status: 'edited' }}
				stale={false}
				onChange={vi.fn()}
				onCommit={vi.fn()}
				onDiscard={onDiscard}
			/>
		);
		expect(screen.getByRole('button', { name: '写入正文' })).toBeDisabled();
	});
});
