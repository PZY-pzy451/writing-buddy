import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getStoryResourceRegistration } from '../application/StoryResourceRegistry';
import type { StoryOpenResult } from '../application/StoryResourceOpenService';
import { StoryResourceView } from './StoryResourceView';

const reference = {
	type: 'character' as const,
	id: 'character:lin-mo'
};

function result(status: 'missing' | 'unavailable'): StoryOpenResult {
	const base = {
		reference,
		registration: getStoryResourceRegistration(reference.type),
		tab: {
			id: 'story:character:character:lin-mo',
			type: 'story' as const,
			title: status === 'missing' ? '资源不存在' : '资料暂不可用',
			projectId: 'project-story',
			storyType: reference.type,
			storyId: reference.id,
			route: 'story/character/character%3Alin-mo'
		}
	};
	return status === 'missing'
		? { ...base, status }
		: { ...base, status, errorCode: 'storyResourceReadFailed' };
}

describe('StoryResourceView', () => {
	it('keeps a missing resource explicitly recoverable and recheckable', () => {
		const onRestore = vi.fn();
		const onRetry = vi.fn();
		render(
			<StoryResourceView
				result={result('missing')}
				onRestore={onRestore}
				onRetry={onRetry}
			/>
		);

		expect(screen.getByRole('alert')).toHaveTextContent('资源不存在');
		fireEvent.click(screen.getByRole('button', { name: '从回收区恢复' }));
		fireEvent.click(screen.getByRole('button', { name: '重新检查' }));

		expect(onRestore).toHaveBeenCalledOnce();
		expect(onRetry).toHaveBeenCalledWith(reference);
	});

	it('presents a transient read failure as retry-only without a destructive recovery guess', () => {
		const onRestore = vi.fn();
		const onRetry = vi.fn();
		render(
			<StoryResourceView
				result={result('unavailable')}
				onRestore={onRestore}
				onRetry={onRetry}
			/>
		);

		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('资料暂时无法读取');
		expect(alert).toHaveTextContent('项目仍可继续使用');
		expect(screen.queryByRole('button', { name: '从回收区恢复' })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '重新检查' }));

		expect(onRetry).toHaveBeenCalledWith(reference);
		expect(onRestore).not.toHaveBeenCalled();
	});
});
