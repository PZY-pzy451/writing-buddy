import { render, screen } from '@testing-library/react';
import { BookOpenText } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { AppEmptyState } from './AppEmptyState';

describe('AppEmptyState', () => {
	it('renders a full empty state with semantic copy and actions', () => {
		render(
			<AppEmptyState
				icon={BookOpenText}
				title="选择一个章节"
				description="从作品大纲打开章节后即可继续写作。"
				density="full"
				role="status"
				actions={<button type="button">打开作品</button>}
			/>
		);

		expect(screen.getByRole('status')).toHaveClass('is-full');
		expect(screen.getByText('选择一个章节')).toBeVisible();
		expect(screen.getByText('从作品大纲打开章节后即可继续写作。')).toBeVisible();
		expect(screen.getByRole('button', { name: '打开作品' })).toBeEnabled();
	});

	it('supports compact positive states without requiring a description', () => {
		render(
			<AppEmptyState
				icon={BookOpenText}
				title="当前没有待处理问题"
				density="compact"
				tone="positive"
			/>
		);

		expect(screen.getByText('当前没有待处理问题').closest('.app-empty-state'))
			.toHaveClass('is-compact', 'is-positive');
	});
});
