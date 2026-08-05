import {
	DEFAULT_AI_PREFERENCES,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildContextPack } from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import {
	SelectionRewritePanel,
	type SelectionRewritePanelProps
} from './SelectionRewritePanel';

const asyncTimeout = { timeout: 5_000 };

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
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('TC-SELECTION-REWRITE-001 deduplicates one hundred generate and cancel actions and reports cancelled', async () => {
		let emitEvent: (event: AiStreamEvent) => void = () => undefined;
		let activeJobId = '';
		let resolveCancellation: (value: boolean) => void = () => undefined;
		vi.spyOn(desktopBridge, 'getAiPreferences')
			.mockResolvedValue(DEFAULT_AI_PREFERENCES);
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => {
				activeJobId = request.jobId;
				emitEvent = listener;
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
				return Promise.resolve();
			});
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => new Promise<boolean>(resolve => {
				resolveCancellation = resolve;
			}));
		render(
			<SelectionRewritePanel
				projectRoot="D:/fixture"
				resourceId="chapter:one"
				sourceRevision={4}
				content="夜里非常非常安静。"
				selection={{ start: 2, end: 8, text: '非常非常安静' }}
				theme="vs"
				actionType="polish"
				onApply={vi.fn()}
				onReplaceDocument={vi.fn()}
				loadPack={() => Promise.resolve(pack())}
			/>
		);

		const generateButton = await screen.findByTestId(
			'selection-rewrite-generate',
			undefined,
			asyncTimeout
		);
		await waitFor(() => expect(generateButton).toBeEnabled(), asyncTimeout);
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				generateButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});
		expect(startAiGeneration).toHaveBeenCalledOnce();
		const cancelButton = await screen.findByRole('button', { name: '取消' }, asyncTimeout);
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(cancelAiJob).toHaveBeenCalledOnce();
		expect(cancelAiJob).toHaveBeenCalledWith(activeJobId);
		resolveCancellation(true);
		await act(async () => {
			emitEvent({ type: 'cancelled', jobId: activeJobId });
			await Promise.resolve();
		});
		expect(await screen.findByRole('alert', undefined, asyncTimeout))
			.toHaveTextContent('生成已停止');
	});

	it('TC-SELECTION-REWRITE-002 renders one atomic inline draft without replacing the selection', async () => {
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

		const generate = await screen.findByTestId(
			'selection-rewrite-generate',
			undefined,
			asyncTimeout
		);
		await waitFor(() => expect(generate).toBeEnabled(), asyncTimeout);
		fireEvent.click(generate);

		await waitFor(
			() => expect(onPendingDraft).toHaveBeenCalledTimes(1),
			asyncTimeout
		);
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

	it('TC-SELECTION-REWRITE-003 keeps a repaired wrapped candidate available without replacing the selection', async () => {
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
					output: [
						'```json',
						JSON.stringify({
							result: {
								rewrite: '格外安静',
								reason: '删除重复表达。',
								impact: '不改变情节。'
							}
						}),
						'```'
					].join('\n')
				})}
			/>
		);

		const generate = await screen.findByTestId(
			'selection-rewrite-generate',
			undefined,
			asyncTimeout
		);
		await waitFor(() => expect(generate).toBeEnabled(), asyncTimeout);
		fireEvent.click(generate);

		await waitFor(
			() => expect(onPendingDraft).toHaveBeenCalledWith(
				expect.objectContaining({
					suggestion: '格外安静',
					rationale: '删除重复表达。',
					potentialImpact: '不改变情节。'
				})
			),
			asyncTimeout
		);
		expect(generate).toBeEnabled();
		expect(onApply).not.toHaveBeenCalled();
	});

	it('TC-SELECTION-REWRITE-004 hides raw schema details and rejects malformed data with localized failure and zero persistence', async () => {
		const onApply = vi.fn();
		const onPendingDraft = vi.fn();
		const onBeforeApply = vi.fn(() => Promise.resolve());
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
				onBeforeApply={onBeforeApply}
				onPendingDraft={onPendingDraft}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={() => Promise.resolve({
					output: JSON.stringify({ result: { tokens: [1, 2, 3] } })
				})}
			/>
		);

		const generate = await screen.findByTestId(
			'selection-rewrite-generate',
			undefined,
			asyncTimeout
		);
		await waitFor(() => expect(generate).toBeEnabled(), asyncTimeout);
		fireEvent.click(generate);

		expect(await screen.findByRole('alert', undefined, asyncTimeout))
			.toHaveTextContent('AI 返回的改写候选结构不完整，未写入正文');
		expect(screen.queryByText(/invalidSelectionRewriteResponse/u))
			.not.toBeInTheDocument();
		expect(onPendingDraft).not.toHaveBeenCalled();
		expect(onApply).not.toHaveBeenCalled();
		expect(onBeforeApply).not.toHaveBeenCalled();
	});

	it('TC-SELECTION-REWRITE-005 keeps the draft keyboard focusable, saves a note, applies after pointer confirmation and supports undo', async () => {
		const onApply = vi.fn();
		const onReplaceDocument = vi.fn();
		const onSaveNote = vi.fn();
		const runRewriteImplementation: NonNullable<SelectionRewritePanelProps['runRewrite']> = (_pack, onProgress) => {
			const output = JSON.stringify({
				suggestion: '格外安静',
				rationale: '删除重复表达。',
				potentialImpact: '不改变情节。'
			});
			onProgress(output, 'streaming', { totalTokens: 42 });
			return Promise.resolve({ output, usage: { totalTokens: 42 } });
		};
		const runRewrite = vi.fn(runRewriteImplementation);
		const { rerender } = render(
			<SelectionRewritePanel
				projectRoot="D:\\fixture"
				resourceId="chapter:one"
				sourceRevision={4}
				content="夜里非常非常安静。"
				selection={{ start: 2, end: 8, text: '非常非常安静' }}
				theme="vs"
				actionType="polish"
				onApply={onApply}
				onReplaceDocument={onReplaceDocument}
				onSaveNote={onSaveNote}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={runRewrite}
			/>
		);
		const generate = await screen.findByTestId(
			'selection-rewrite-generate',
			undefined,
			asyncTimeout
		);
		await waitFor(() => expect(generate).toBeEnabled(), asyncTimeout);
		expect(onApply).not.toHaveBeenCalled();
		fireEvent.click(generate);
		await waitFor(
			() => expect(screen.getByLabelText('修改对比')).toBeInTheDocument(),
			asyncTimeout
		);
		expect(onApply).not.toHaveBeenCalled();
		const draft = screen.getByTestId('selection-rewrite-draft');
		expect(draft).toBeVisible();
		expect(draft).toBeEnabled();
		draft.focus();
		expect(draft).toHaveFocus();
		fireEvent.change(draft, { target: { value: '静得能听见钟声' } });
		expect(draft).toHaveValue('静得能听见钟声');
		fireEvent.change(draft, { target: { value: '格外安静' } });
		fireEvent.click(screen.getByTestId('selection-rewrite-save-note'));
		expect(onSaveNote).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByTestId('selection-rewrite-accept-all'));
		expect(onApply).toHaveBeenCalledWith(2, 8, '格外安静');
		rerender(
			<SelectionRewritePanel
				projectRoot="D:\\fixture"
				resourceId="chapter:one"
				sourceRevision={5}
				content="夜里格外安静。"
				selection={{ start: 2, end: 6, text: '格外安静' }}
				theme="vs"
				actionType="polish"
				onApply={onApply}
				onReplaceDocument={onReplaceDocument}
				onSaveNote={onSaveNote}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={runRewrite}
			/>
		);
		const undo = screen.getByTestId('selection-rewrite-undo');
		expect(undo).toBeEnabled();
		fireEvent.click(undo);
		expect(onReplaceDocument).toHaveBeenCalledWith('夜里非常非常安静。');
	});

	it('TC-SELECTION-REWRITE-006 disables stale candidate acceptance', async () => {
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
		const generate = await screen.findByTestId(
			'selection-rewrite-generate',
			undefined,
			asyncTimeout
		);
		await waitFor(() => expect(generate).toBeEnabled(), asyncTimeout);
		fireEvent.click(generate);
		await waitFor(
			() => expect(screen.getByText('正文已变化，此候选不可接受。')).toBeInTheDocument(),
			asyncTimeout
		);
		expect(screen.getByTestId('selection-rewrite-accept-all')).toBeDisabled();
	});

	it('TC-SELECTION-REWRITE-007 redacts snapshot failure, preserves the candidate and succeeds on explicit restart without regeneration', async () => {
		const onApply = vi.fn();
		const onBeforeApply = vi.fn()
			.mockRejectedValueOnce(new Error('snapshotFailed:C:\\private\\author\\backups\\rewrite.zip'))
			.mockResolvedValueOnce(undefined);
		const runRewrite = vi.fn(() => Promise.resolve({
			output: JSON.stringify({
				suggestion: '格外安静',
				rationale: '精简',
				potentialImpact: ''
			})
		}));
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
				onBeforeApply={onBeforeApply}
				loadPack={() => Promise.resolve(pack())}
				runRewrite={runRewrite}
			/>
		);
		const generate = await screen.findByTestId(
			'selection-rewrite-generate',
			undefined,
			asyncTimeout
		);
		await waitFor(() => expect(generate).toBeEnabled(), asyncTimeout);
		fireEvent.click(generate);
		const accept = await screen.findByTestId(
			'selection-rewrite-accept-all',
			undefined,
			asyncTimeout
		);
		fireEvent.click(accept);

		const alert = await screen.findByRole('alert', undefined, asyncTimeout);
		expect(alert).toHaveTextContent('无法写入改写候选，正文没有改变，请重试。');
		expect(alert).not.toHaveTextContent('C:\\private');
		expect(onApply).not.toHaveBeenCalled();
		expect(accept).toBeEnabled();
		fireEvent.click(accept);
		await waitFor(
			() => expect(onApply).toHaveBeenCalledWith(2, 8, '格外安静'),
			asyncTimeout
		);
		expect(onBeforeApply).toHaveBeenCalledTimes(2);
		expect(runRewrite).toHaveBeenCalledOnce();
	}, 10_000);
});
