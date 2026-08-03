import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildContextPack, type ContextPack } from '@writing-buddy/story-kernel';
import { describe, expect, it, vi } from 'vitest';
import { ManuscriptContinuationPanel } from './ManuscriptContinuationPanel';

const original = '雨落在站台。';
const scaffold = [
	'# 第一章 · 迟到的声音',
	'',
	'## 场景 1 · 零点来电',
	'',
	'<!-- writing-buddy-scene:scene:one -->',
	''
].join('\n');

function pack(guidance = ''): ContextPack {
	return buildContextPack({
		actionType: 'continue-paragraph',
		instruction: guidance
			? `沿当前段落继续。\n作者明确要求：${guidance}`
			: '沿当前段落自由继续。',
		sourceKind: 'manuscript-excerpt',
		sourceTitle: '光标前文',
		selection: {
			text: original,
			resourceId: 'chapter:one',
			revision: 4,
			start: 0,
			end: original.length
		},
		candidates: [{
			id: 'context:scene:one',
			priority: 'P2',
			kind: 'scene',
			title: '雨夜站台',
			content: '目标：找到失踪站长。'
		}, {
			id: 'context:character:lin',
			priority: 'P3',
			kind: 'character',
			title: '林越',
			content: '当前目标：追查钟声。'
		}, {
			id: 'context:secret',
			priority: 'P5',
			kind: 'information',
			title: '结局秘密',
			content: '站长就是未来的林越。',
			authorSecret: true
		}],
		budgetTokens: 1_024
	});
}

function continuationOutput(count = 1): string {
	const candidates = [{
		title: '追随钟声',
		content: '林越抬起头，循着钟声走向雾里的站台尽头。',
		rationale: '延续当前声音线索，并推进人物行动。'
	}, {
		title: '留在原地',
		content: '林越关掉手电，让黑暗替自己分辨铁轨下的脚步。',
		rationale: '减慢动作速度，以观察积累悬念。'
	}, {
		title: '质问同伴',
		content: '林越按住徐青的肩，追问她为何知道钟声会在此刻响起。',
		rationale: '用人物选择把外部谜团转为关系冲突。'
	}];
	return JSON.stringify({ candidates: candidates.slice(0, count) });
}

function openingPack(): ContextPack {
	return buildContextPack({
		actionType: 'continue-paragraph',
		instruction: '当前章节尚无正文。依据已确认的首个场景结构起草开篇。',
		sourceKind: 'manuscript-excerpt',
		sourceTitle: '章节与场景结构（尚无正文）',
		selection: {
			text: scaffold,
			resourceId: 'chapter:one',
			revision: 4,
			start: 0,
			end: scaffold.length
		},
		candidates: [{
			id: 'context:scene:one',
			priority: 'P2',
			kind: 'scene',
			title: '零点来电',
			content: '顾言在法证室听见一通迟到的电话。'
		}],
		budgetTokens: 1_024
	});
}

function baseProps() {
	return {
		projectRoot: 'D:\\fixture',
		resourceId: 'chapter:one',
		sourceRevision: 4,
		content: original,
		cursorOffset: original.length,
		mode: 'continue-paragraph' as const,
		readOnly: false,
		theme: 'vs' as const,
		onApply: vi.fn(),
		onReplaceDocument: vi.fn(),
		onBeforeApply: vi.fn(() => Promise.resolve()),
		loadPack: (guidance: string) => Promise.resolve(pack(guidance))
	};
}

describe('ManuscriptContinuationPanel', () => {
	it('shows a calm next step instead of a red failure for an unplanned empty chapter', async () => {
		const props = {
			...baseProps(),
			content: '# 第一章',
			cursorOffset: 0,
			loadPack: () => Promise.reject(new Error(
				'当前光标前还没有正文。请先输入一句开头，或创建场景后让 AI 起草。'
			))
		};
		render(<ManuscriptContinuationPanel {...props} />);

		const panel = screen.getByRole('region', { name: '作者确认续写' });
		expect(await within(panel).findByRole('status')).toHaveTextContent(
			'请先输入一句开头，或创建场景后让 AI 起草'
		);
		expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
		expect(within(panel).queryByText('正在构建续写上下文…')).not.toBeInTheDocument();
	});

	it('turns a scaffold-only chapter into an author-confirmed opening draft', async () => {
		const props = {
			...baseProps(),
			content: scaffold,
			cursorOffset: 0,
			loadPack: () => Promise.resolve(openingPack()),
			onPendingDraft: vi.fn(),
			runContinuation: () => Promise.resolve({ output: continuationOutput() })
		};
		render(<ManuscriptContinuationPanel {...props} />);

		expect(await screen.findByText('将从首个场景开始起草')).toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		const generate = screen.getByRole('button', {
			name: '确认资料并生成开篇'
		});
		await waitFor(() => expect(generate).toBeEnabled());
		fireEvent.click(generate);

		await waitFor(() => expect(props.onPendingDraft).toHaveBeenCalledTimes(1));
		expect(props.onPendingDraft).toHaveBeenCalledWith(
			expect.objectContaining({ title: '追随钟声' }),
			expect.objectContaining({
				cursorOffset: scaffold.length,
				sourceRevision: 4
			}),
			expect.stringContaining('林越抬起头')
		);
		expect(props.onApply).not.toHaveBeenCalled();
		expect(props.onBeforeApply).not.toHaveBeenCalled();
	});

	it('hands a standard continuation to the inline draft surface without applying text', async () => {
		const props = {
			...baseProps(),
			onPendingDraft: vi.fn(),
			runContinuation: () => Promise.resolve({ output: continuationOutput() })
		};
		render(<ManuscriptContinuationPanel {...props} />);

		fireEvent.click(await screen.findByRole('button', {
			name: '确认资料并生成候选'
		}));

		await waitFor(() => expect(props.onPendingDraft).toHaveBeenCalledTimes(1));
		expect(props.onPendingDraft).toHaveBeenCalledWith(
			expect.objectContaining({ title: '追随钟声' }),
			expect.objectContaining({
				cursorOffset: original.length,
				sourceRevision: 4
			}),
			expect.stringContaining('林越抬起头')
		);
		expect(screen.getByRole('status')).toHaveTextContent('临时草稿已放到正文');
		expect(screen.queryByRole('article', { name: '候选：追随钟声' })).not.toBeInTheDocument();
		expect(props.onApply).not.toHaveBeenCalled();
		expect(props.onBeforeApply).not.toHaveBeenCalled();
	});

	it('repairs an equivalent wrapped response before handing off the inline draft', async () => {
		const props = {
			...baseProps(),
			onPendingDraft: vi.fn(),
			runContinuation: () => Promise.resolve({
				output: [
					'```json',
					JSON.stringify({
						result: {
							candidate: {
								direction: '打开站台门',
								text: '林越推开站台尽头的铁门。',
								reason: '延续当前动作。'
							}
						}
					}),
					'```'
				].join('\n')
			})
		};
		render(<ManuscriptContinuationPanel {...props} />);

		fireEvent.click(await screen.findByRole('button', {
			name: '确认资料并生成候选'
		}));

		await waitFor(() => expect(props.onPendingDraft).toHaveBeenCalledTimes(1));
		expect(props.onPendingDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				title: '打开站台门',
				content: '林越推开站台尽头的铁门。',
				rationale: '延续当前动作。'
			}),
			expect.any(Object),
			expect.stringContaining('林越推开站台尽头的铁门。')
		);
		expect(props.onApply).not.toHaveBeenCalled();
		expect(props.onBeforeApply).not.toHaveBeenCalled();
	});

	it('keeps malformed generated data out of the manuscript with localized guidance', async () => {
		const props = {
			...baseProps(),
			onPendingDraft: vi.fn(),
			runContinuation: () => Promise.resolve({
				output: JSON.stringify({
					candidates: [{ content: { tokens: [1, 2, 3] } }]
				})
			})
		};
		render(<ManuscriptContinuationPanel {...props} />);

		fireEvent.click(await screen.findByRole('button', {
			name: '确认资料并生成候选'
		}));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'AI 返回的正文候选结构不完整，未写入正文'
		);
		expect(screen.queryByText(/invalidManuscriptContinuationResponse/u))
			.not.toBeInTheDocument();
		expect(props.onPendingDraft).not.toHaveBeenCalled();
		expect(props.onApply).not.toHaveBeenCalled();
		expect(props.onBeforeApply).not.toHaveBeenCalled();
	});

	it('keeps author guidance, blocks duplicate requests and shows grounded review before insert', async () => {
		const order: string[] = [];
		let release: ((value: { output: string }) => void) | undefined;
		const runContinuation = vi.fn(() => new Promise<{ output: string }>(resolve => {
			release = resolve;
		}));
		const props = {
			...baseProps(),
			onBeforeApply: vi.fn(() => {
				order.push('snapshot');
				return Promise.resolve();
			}),
			onApply: vi.fn(() => {
				order.push('insert');
			}),
			runContinuation
		};
		render(<ManuscriptContinuationPanel {...props} />);

		const guidance = await screen.findByRole('textbox', {
			name: '告诉 AI 接下来发生什么'
		});
		fireEvent.change(guidance, {
			target: { value: '让林越先发现一枚蓝色车票。' }
		});
		await waitFor(() => expect(screen.getByText(/作者明确要求/u)).toBeInTheDocument());

		const generate = screen.getByRole('button', { name: '确认资料并生成候选' });
		fireEvent.click(generate);
		fireEvent.click(generate);
		expect(runContinuation).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', { name: 'AI 生成中 · 0 字符' })).toBeDisabled();
		release?.({ output: continuationOutput() });

		const candidate = await screen.findByRole('article', { name: '候选：追随钟声' });
		expect(within(candidate).getByText(/插入位置：第 1 行/u)).toBeInTheDocument();
		expect(within(candidate).getByText(/雨夜站台/u)).toBeInTheDocument();
		expect(within(candidate).getByText(/依据：.*林越/u)).toBeInTheDocument();
		expect(within(candidate).getByText('未使用作者秘密')).toBeInTheDocument();
		expect(props.onApply).not.toHaveBeenCalled();

		fireEvent.click(within(candidate).getByRole('button', { name: '查看差异' }));
		expect(await screen.findByLabelText('原文与建议修改对比')).toBeInTheDocument();
		fireEvent.click(within(candidate).getByRole('button', { name: '插入' }));
		await waitFor(() => expect(props.onApply).toHaveBeenCalled());
		expect(order).toEqual(['snapshot', 'insert']);
	});

	it('creates only one snapshot and insertion when accept is clicked 100 times in one event batch', async () => {
		let releaseSnapshot: (() => void) | undefined;
		const props = {
			...baseProps(),
			onBeforeApply: vi.fn(() => new Promise<void>(resolve => {
				releaseSnapshot = resolve;
			})),
			runContinuation: () => Promise.resolve({ output: continuationOutput() })
		};
		render(<ManuscriptContinuationPanel {...props} />);

		fireEvent.click(await screen.findByRole('button', {
			name: /确认.*生成/u
		}));
		const candidate = await screen.findByRole('article', { name: /^候选：/u });
		const insertButton = within(candidate).getByRole('button', { name: /插入/u });
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				insertButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(props.onBeforeApply).toHaveBeenCalledOnce();
		expect(props.onApply).not.toHaveBeenCalled();
		expect(insertButton).toBeDisabled();
		releaseSnapshot?.();
		await waitFor(() => expect(props.onApply).toHaveBeenCalledOnce());
	});

	it('keeps an accepted insertion successful after the host updates the manuscript', async () => {
		const props = {
			...baseProps(),
			runContinuation: () => Promise.resolve({ output: continuationOutput() })
		};
		const view = render(<ManuscriptContinuationPanel {...props} />);

		fireEvent.click(await screen.findByRole('button', {
			name: '确认资料并生成候选'
		}));
		const candidate = await screen.findByRole('article', { name: '候选：追随钟声' });
		fireEvent.click(within(candidate).getByRole('button', { name: '插入' }));

		expect(await screen.findByRole('status')).toHaveTextContent('安全快照已创建');
		view.rerender(<ManuscriptContinuationPanel
			{...props}
			content={`${original}\n\n候选已经写入正文。`}
			sourceRevision={5}
		/>);

		expect(screen.getByRole('status')).toHaveTextContent('安全快照已创建');
		expect(screen.queryByText('正文或光标锚点已变化，请重新生成候选。'))
			.not.toBeInTheDocument();
	});

	it('shows exactly three directions and rejects one without mutating the manuscript', async () => {
		const props = {
			...baseProps(),
			mode: 'three-directions' as const,
			loadPack: () => Promise.resolve({
				...pack(),
				actionType: 'three-directions' as const
			}),
			runContinuation: () => Promise.resolve({ output: continuationOutput(3) })
		};
		render(<ManuscriptContinuationPanel {...props} />);

		fireEvent.click(await screen.findByRole('button', {
			name: '确认资料并生成候选'
		}));
		expect(await screen.findAllByRole('article', { name: /^候选：/u }))
			.toHaveLength(3);
		const first = screen.getByRole('article', { name: '候选：追随钟声' });
		fireEvent.click(within(first).getByRole('button', { name: '拒绝' }));

		expect(within(first).getByText('已拒绝')).toBeInTheDocument();
		expect(props.onApply).not.toHaveBeenCalled();
		expect(props.onBeforeApply).not.toHaveBeenCalled();
	});

	it('blocks insertion when the safety snapshot fails and allows a safe retry', async () => {
		const onBeforeApply = vi.fn()
			.mockRejectedValueOnce(new Error('无法创建安全快照。'))
			.mockResolvedValueOnce(undefined);
		const props = {
			...baseProps(),
			onBeforeApply,
			runContinuation: () => Promise.resolve({ output: continuationOutput() })
		};
		render(<ManuscriptContinuationPanel {...props} />);

		fireEvent.click(await screen.findByRole('button', {
			name: '确认资料并生成候选'
		}));
		const candidate = await screen.findByRole('article', { name: '候选：追随钟声' });
		fireEvent.click(within(candidate).getByRole('button', { name: '插入' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('无法创建安全快照');
		expect(props.onApply).not.toHaveBeenCalled();
		fireEvent.click(within(candidate).getByRole('button', { name: /插入/u }));
		await waitFor(() => expect(props.onApply).toHaveBeenCalledOnce());
		expect(onBeforeApply).toHaveBeenCalledTimes(2);
	});
});
