import { fireEvent, render, screen } from '@testing-library/react';
import { createTextAnchor, type ReviewIssue } from '@writing-buddy/review';
import { describe, expect, it, vi } from 'vitest';
import { InlineLanguageCheckControl } from './InlineLanguageCheckControl';

const issue: ReviewIssue = {
	id: 'inline-1',
	projectId: 'project',
	resourceId: 'chapter',
	ruleId: 'ai-inline-language-check',
	severity: 'warning',
	status: 'open',
	title: '英文拼写错误',
	message: '“somthing” 应拼写为 “something”。',
	anchor: createTextAnchor('somthing', 0, 8),
	replacement: 'something',
	createdAt: '2026-07-29T00:00:00.000Z',
	updatedAt: '2026-07-29T00:00:00.000Z',
	origin: 'ai'
};

describe('InlineLanguageCheckControl', () => {
	it('discloses slice behavior and applies only an explicit replacement', () => {
		const onToggle = vi.fn();
		const onApply = vi.fn();
		render(
			<InlineLanguageCheckControl
				enabled
				status="ready"
				statusMessage="发现 1 处明确问题"
				issues={[issue]}
				readOnly={false}
				onToggle={onToggle}
				onRetry={vi.fn()}
				onOpenSettings={vi.fn()}
				onApply={onApply}
			/>
		);
		const trigger = screen.getByTestId('inline-language-check-trigger');
		fireEvent.click(trigger);
		expect(screen.getByTestId('inline-language-check-toggle')).toBeChecked();
		expect(screen.getByText(/只发送变化段落/u)).toBeInTheDocument();
		expect(screen.getByText('英文拼写错误')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '替换为“something”' }));
		expect(onApply).toHaveBeenCalledWith(issue);
		expect(onToggle).not.toHaveBeenCalled();
	});

	it('shows a non-color setup recovery action and blocks read-only fixes', () => {
		const onOpenSettings = vi.fn();
		render(
			<InlineLanguageCheckControl
				enabled
				status="needs-setup"
				statusMessage="需要先配置 DeepSeek"
				issues={[issue]}
				readOnly
				onToggle={vi.fn()}
				onRetry={vi.fn()}
				onOpenSettings={onOpenSettings}
				onApply={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByTestId('inline-language-check-trigger'));
		expect(screen.getByTestId('inline-language-check-toggle')).toBeChecked();
		expect(screen.getByText('需要先配置 DeepSeek')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /替换为/u })).toBeDisabled();
		fireEvent.click(screen.getByRole('button', { name: 'AI 设置' }));
		expect(onOpenSettings).toHaveBeenCalledOnce();
	});
});
