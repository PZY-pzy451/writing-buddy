import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
	ContinuityCandidate,
	ContinuityIssue
} from '@writing-buddy/story-kernel';
import { ContinuityReviewPage } from './ContinuityReviewPage';

const candidates: readonly ContinuityCandidate[] = [{
	sourceId: 'kernel-overlap',
	layer: 'story-kernel',
	ruleId: 'timeline.impossible-overlap',
	severity: 'error',
	title: '人物同时出现在两个地点',
	message: '林越在同一时间出现在车站和港口。',
	evidence: [{
		id: 'one',
		resourceId: 'chapter:one',
		chapterId: 'chapter:one',
		quote: '林越站在车站。',
		label: '车站场景'
	}, {
		id: 'two',
		resourceId: 'chapter:two',
		chapterId: 'chapter:two',
		quote: '林越抵达港口。',
		label: '港口场景'
	}]
}, {
	sourceId: 'ai-secret',
	layer: 'ai',
	ruleId: 'ai-continuity',
	severity: 'error',
	title: 'AI 推测冲突',
	message: '需要作者确认。',
	evidence: [{
		id: 'three',
		resourceId: 'chapter:three',
		label: 'AI 证据'
	}]
}];

describe('ContinuityReviewPage', () => {
	it('shows severity, source layers, two evidence links and resolution state', async () => {
		const onOpenEvidence = vi.fn();
		const persist = vi.fn((issues: readonly ContinuityIssue[]) => Promise.resolve(issues));
		render(
			<ContinuityReviewPage
				projectRoot="D:\\novel"
				loadCandidates={() => Promise.resolve(candidates)}
				loadPrevious={() => Promise.resolve([])}
				persist={persist}
				onOpenEvidence={onOpenEvidence}
			/>
		);
		await waitFor(() => expect(screen.getAllByText('人物同时出现在两个地点')).toHaveLength(2));
		expect(screen.getByText('Story Kernel')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /打开.*场景/u })).toHaveLength(2);
		fireEvent.click(screen.getByRole('button', { name: '打开港口场景' }));
		expect(onOpenEvidence).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 'chapter:two' }));
		fireEvent.click(screen.getByRole('button', { name: '标记已解决' }));
		await waitFor(() => expect(screen.getAllByText('resolved')).toHaveLength(2));
		expect(persist).toHaveBeenCalled();
	});

	it('caps AI errors at warning in the visible issue list', async () => {
		render(
			<ContinuityReviewPage
				projectRoot="D:\\novel"
				loadCandidates={() => Promise.resolve(candidates.slice(1))}
				loadPrevious={() => Promise.resolve([])}
				persist={issues => Promise.resolve(issues)}
			/>
		);
		await waitFor(() => expect(screen.getAllByText('AI 推测冲突')).toHaveLength(2));
		expect(screen.getAllByText('警告').length).toBeGreaterThan(0);
		expect(document.querySelectorAll('.severity-dot[data-severity="error"]')).toHaveLength(0);
	});
});
