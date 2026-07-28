import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseStoryId } from '@writing-buddy/story-kernel';
import { KernelCandidateCard } from './StoryKernelGeneratorPanel';
import type { StoryKernelGenerationCandidate } from './StoryKernelGenerationService';

const candidate: StoryKernelGenerationCandidate = {
	id: parseStoryId('generation-candidate:signal'),
	operation: 'create',
	resourceType: 'foreshadowing',
	resourceId: parseStoryId('foreshadowing:signal-tower-message'),
	title: '信号塔的无声警告',
	rawResource: {
		id: 'foreshadowing:signal-tower-message',
		type: 'foreshadowing',
		title: '信号塔的无声警告',
		aliases: [],
		tags: ['信号塔'],
		evidenceIds: [],
		status: 'planted',
		reminderPositions: [],
		readerVisibility: 'hidden',
		plotThreadIds: []
	},
	confidence: 0.65,
	rationale: '基于源文本内容，但需要作者确认。',
	evidence: {
		id: parseStoryId('evidence:signal'),
		origin: 'ai-extracted',
		resourceId: parseStoryId('chapter:one'),
		range: { start: 0, end: 1 },
		revisionId: '7',
		quotePreview: '是',
		confirmedByAuthor: false
	},
	conflicts: [{
		code: 'invalid-schema',
		message: '字段结构不符合 Story Kernel，修正前无法确认写入。',
		blocking: true,
		details: [{
			path: 'readerVisibility',
			message: '读者可见度不能使用“hidden”等文字；请改为 0（完全隐藏）到 1（完全可见）之间的数字。',
			expected: '0–1 之间的数字',
			actual: '"hidden"'
		}]
	}],
	status: 'pending',
	createdAt: '2026-07-28T00:00:00.000Z',
	updatedAt: '2026-07-28T00:00:00.000Z'
};

describe('KernelCandidateCard diagnostics', () => {
	it('explains the exact invalid field before exposing raw JSON', () => {
		render(
			<KernelCandidateCard
				candidate={candidate}
				selected={false}
				busy={false}
				onToggle={vi.fn()}
				onReject={vi.fn()}
			/>
		);

		expect(screen.getByText('需处理')).toBeInTheDocument();
		expect(screen.getByText('正文证据')).toBeInTheDocument();
		expect(screen.getByText('1 字')).toBeInTheDocument();
		expect(screen.getByText('readerVisibility')).toBeInTheDocument();
		expect(screen.getByText(/不能使用“hidden”/)).toBeInTheDocument();
		expect(screen.queryByLabelText('候选原始结构')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: '查看结构' }));
		expect(screen.getByLabelText('候选原始结构')).toBeInTheDocument();
		expect(screen.getByText(/实际写入仍以 Schema 校验为准/)).toBeInTheDocument();
	});
});
