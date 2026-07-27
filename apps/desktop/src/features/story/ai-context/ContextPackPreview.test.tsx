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
		render(<ContextPackPreview pack={pack} onChange={onChange} />);
		expect(screen.getByLabelText('AI Context Pack 预览')).toBeInTheDocument();
		expect(screen.getByText('路径与密钥未包含')).toBeInTheDocument();
		const checkbox = screen.getByRole('checkbox', { name: /事故真相/u });
		expect(checkbox).not.toBeChecked();
		fireEvent.click(checkbox);
		expect(onChange.mock.calls[0]?.[0].items.find(item => item.id === 'context:secret')?.included).toBe(true);
	});
});
