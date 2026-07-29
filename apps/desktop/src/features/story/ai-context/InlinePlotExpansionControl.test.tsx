import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InlinePlotExpansionSuggestion } from './InlinePlotExpansionService';
import { InlinePlotExpansionControl } from './InlinePlotExpansionControl';

const suggestion: InlinePlotExpansionSuggestion = {
	id: 'inline-plot:one',
	projectId: 'project',
	resourceId: 'chapter:one',
	cursorOffset: 12,
	sourceFingerprint: 'hash',
	sourceContent: '雨落在旧站的玻璃顶上。',
	insertion: '\n\n林墨循着钟声走向站台尽头。',
	title: '追随钟声',
	rationale: '延续当前声音线索并推进人物行动。'
};

describe('InlinePlotExpansionControl', () => {
	it('discloses the bounded automatic flow and exposes keyboard and mouse actions', () => {
		const onToggle = vi.fn();
		const onAccept = vi.fn();
		const onReject = vi.fn();
		render(
			<InlinePlotExpansionControl
				enabled
				status="ready"
				statusMessage="按 Tab 接受 · Esc 忽略"
				suggestion={suggestion}
				readOnly={false}
				onToggle={onToggle}
				onRetry={vi.fn()}
				onAccept={onAccept}
				onReject={onReject}
				onOpenSettings={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByText('Tab 拓展'));
		const dialog = screen.getByRole('dialog', { name: 'Tab 自动情节拓展' });
		expect(screen.getByText(/光标前最多 4,000 字符/u)).toBeInTheDocument();
		expect(screen.getByText('追随钟声')).toBeInTheDocument();
		const shortcuts = within(dialog).getByLabelText('预览快捷键');
		expect(within(shortcuts).getByText('Tab')).toBeInTheDocument();
		expect(within(shortcuts).getByText('Esc')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '接受预览' }));
		fireEvent.click(screen.getByRole('button', { name: '忽略' }));
		expect(onAccept).toHaveBeenCalledOnce();
		expect(onReject).toHaveBeenCalledOnce();
		expect(onToggle).not.toHaveBeenCalled();
	});

	it('shows setup recovery and disables generation in read-only mode', () => {
		const onOpenSettings = vi.fn();
		render(
			<InlinePlotExpansionControl
				enabled
				status="needs-setup"
				statusMessage="需要先配置 DeepSeek"
				readOnly
				onToggle={vi.fn()}
				onRetry={vi.fn()}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onOpenSettings={onOpenSettings}
			/>
		);
		fireEvent.click(screen.getByText('Tab 拓展'));
		const dialog = screen.getByRole('dialog', { name: 'Tab 自动情节拓展' });
		expect(within(dialog).getByRole('status')).toHaveTextContent('需要先配置 DeepSeek');
		expect(screen.getByRole('button', { name: '立即生成' })).toBeDisabled();
		fireEvent.click(screen.getByRole('button', { name: 'AI 设置' }));
		expect(onOpenSettings).toHaveBeenCalledOnce();
	});
});
