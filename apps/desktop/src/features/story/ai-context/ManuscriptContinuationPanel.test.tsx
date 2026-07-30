import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildContextPack, type ContextPack } from '@writing-buddy/story-kernel';
import { describe, expect, it, vi } from 'vitest';
import { ManuscriptContinuationPanel } from './ManuscriptContinuationPanel';

const original = '雨落在站台。';

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

	it('blocks insertion when the safety snapshot fails', async () => {
		const props = {
			...baseProps(),
			onBeforeApply: vi.fn(() => Promise.reject(new Error('无法创建安全快照。'))),
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
	});
});
