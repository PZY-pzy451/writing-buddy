import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildContextPack } from '@writing-buddy/story-kernel';
import { SelectionRewritePanel } from './SelectionRewritePanel';

function pack() {
	return buildContextPack({
		actionType: 'polish',
		instruction: '保持语气，只润色。',
		selection: { text: '非常非常安静', resourceId: 'chapter:one', revision: 4, start: 2, end: 8 },
		candidates: [],
		budgetTokens: 512
	});
}

describe('SelectionRewritePanel', () => {
	it('hands the generated rewrite to the inline draft surface without replacing the selection', async () => {
		const onApply = vi.fn();
		const onPendingDraft = vi.fn();
		render(
			<SelectionRewritePanel
				projectRoot="D:\fixture"
				resourceId="chapter:one"
				sourceRevision={4}
				content="夜里非常非常安静。"
				selection={{ start: 2, end: 8, text: '非常非常安静' }}
				theme="vs"
				actionType="polish"
				onApply={onApply}
				onReplaceDocument={vi.fn()}
				onPendingDraft={onPendingDraft}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={() => Promise.resolve({
					output: JSON.stringify({
						suggestion: '格外安静',
						rationale: '删除重复表达。',
						potentialImpact: '不改变情节。'
					})
				})}
			/>
		);

		fireEvent.click(await screen.findByRole('button', {
			name: '确认 Context Pack 并生成'
		}));

		await waitFor(() => expect(onPendingDraft).toHaveBeenCalledTimes(1));
		expect(onPendingDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				range: { start: 2, end: 8 },
				suggestion: '格外安静'
			})
		);
		expect(screen.getByRole('status')).toHaveTextContent('临时草稿已放到正文');
		expect(screen.queryByLabelText('修改对比')).not.toBeInTheDocument();
		expect(onApply).not.toHaveBeenCalled();
	});

	it('streams a candidate, shows a diff and applies only after author confirmation', async () => {
		const onApply = vi.fn();
		render(
			<SelectionRewritePanel
				projectRoot="D:\\fixture"
				resourceId="chapter:one"
				sourceRevision={4}
				content="夜里非常非常安静。"
				selection={{ start: 2, end: 8, text: '非常非常安静' }}
				theme="vs"
				actionType="polish"
				onApply={onApply}
				onReplaceDocument={vi.fn()}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={(_pack, onProgress) => {
					const output = JSON.stringify({
						suggestion: '格外安静',
						rationale: '删除重复表达。',
						potentialImpact: '不改变情节。'
					});
					onProgress(output, 'streaming', { totalTokens: 42 });
					return Promise.resolve({ output, usage: { totalTokens: 42 } });
				}}
			/>
		);
		await waitFor(() => expect(screen.getByRole('button', { name: '确认 Context Pack 并生成' })).toBeEnabled());
		expect(onApply).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: '确认 Context Pack 并生成' }));
		await waitFor(() => expect(screen.getByLabelText('修改对比')).toBeInTheDocument());
		expect(onApply).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: '全部接受' }));
		expect(onApply).toHaveBeenCalledWith(2, 8, '格外安静');
	});

	it('disables acceptance when the source revision changed', async () => {
		render(
			<SelectionRewritePanel
				projectRoot="D:\\fixture"
				resourceId="chapter:one"
				sourceRevision={5}
				content="夜里非常非常安静。"
				selection={{ start: 2, end: 8, text: '非常非常安静' }}
				theme="vs"
				actionType="polish"
				onApply={vi.fn()}
				onReplaceDocument={vi.fn()}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={() => Promise.resolve({
					output: JSON.stringify({ suggestion: '格外安静', rationale: '精简', potentialImpact: '' })
				})}
			/>
		);
		await waitFor(() => expect(screen.getByRole('button', { name: '确认 Context Pack 并生成' })).toBeEnabled());
		fireEvent.click(screen.getByRole('button', { name: '确认 Context Pack 并生成' }));
		await waitFor(() => expect(screen.getByText('正文已变化，此候选不可接受。')).toBeInTheDocument());
		expect(screen.getByRole('button', { name: '全部接受' })).toBeDisabled();
	});

	it('does not replace the selection when the safety snapshot fails', async () => {
		const onApply = vi.fn();
		render(
			<SelectionRewritePanel
				projectRoot="D:\\fixture"
				resourceId="chapter:one"
				sourceRevision={4}
				content="夜里非常非常安静。"
				selection={{ start: 2, end: 8, text: '非常非常安静' }}
				theme="vs"
				actionType="polish"
				onApply={onApply}
				onReplaceDocument={vi.fn()}
				onBeforeApply={() => Promise.reject(new Error('无法创建安全快照。'))}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={() => Promise.resolve({
					output: JSON.stringify({
						suggestion: '格外安静',
						rationale: '精简',
						potentialImpact: ''
					})
				})}
			/>
		);
		fireEvent.click(await screen.findByRole('button', {
			name: '确认 Context Pack 并生成'
		}));
		fireEvent.click(await screen.findByRole('button', { name: '全部接受' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('无法创建安全快照');
		expect(onApply).not.toHaveBeenCalled();
	});
});
