import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildContextPack, type ContextPack } from '@writing-buddy/story-kernel';
import { ContextPackPreview } from './ContextPackPreview';

describe('ContextPackPreview', () => {
	it('shows budget and lets the author include an initially excluded secret', () => {
		const onChange = vi.fn<(pack: ContextPack) => void>();
		const pack = buildContextPack({
			actionType: 'polish',
			instruction: '润色',
			selection: {
				text: '雨落在站台。',
				resourceId: 'chapter:one',
				revision: 1,
				start: 0,
				end: 6
			},
			budgetTokens: 512,
			candidates: [{
				id: 'context:secret',
				priority: 'P5',
				kind: 'information',
				title: '事故真相',
				content: '秘密内容',
				authorSecret: true
			}]
		});
		const view = render(<ContextPackPreview pack={pack} onChange={onChange} />);
		expect(screen.getByLabelText('AI Context Pack 预览')).toBeInTheDocument();
		expect(screen.getByText('路径与密钥未包含')).toBeInTheDocument();
		const checkbox = screen.getByRole('checkbox', { name: /事故真相/u });
		expect(checkbox).toHaveAttribute('data-testid', 'context-pack-item-toggle');
		expect(checkbox).toHaveAttribute('data-context-item-id', 'context:secret');
		expect(checkbox).toHaveAttribute('data-context-priority', 'P5');
		expect(checkbox).toHaveAttribute('data-required', 'false');
		expect(checkbox).toHaveAttribute('data-author-secret', 'true');
		expect(checkbox).not.toBeChecked();
		const disclosure = screen.getByRole('button', { name: '展开事故真相' });
		expect(disclosure).toHaveAttribute('data-testid', 'context-pack-item-disclosure');
		expect(disclosure).toHaveAttribute('data-context-item-id', 'context:secret');
		expect(disclosure).toHaveAttribute('data-context-priority', 'P5');
		expect(disclosure).toHaveAttribute('aria-expanded', 'false');
		fireEvent.click(disclosure);
		expect(disclosure).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('秘密内容')).toBeInTheDocument();
		fireEvent.click(disclosure);
		expect(disclosure).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByText('秘密内容')).not.toBeInTheDocument();
		fireEvent.click(checkbox);
		expect(onChange.mock.calls[0]?.[0].items.find(item => item.id === 'context:secret')?.included).toBe(true);

		view.rerender(<ContextPackPreview pack={pack} disabled onChange={onChange} />);
		expect(checkbox).toBeDisabled();
	});
});
