import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
	parseMentionLink,
	parseStoryId,
	StorySchemaRegistry
} from '@writing-buddy/story-kernel';
import { EntityPeekCard } from './EntityPeekCard';

const characterMention = parseMentionLink({
	id: 'mention:lin-yue',
	resourceId: 'character:lin-yue',
	chapterId: 'chapter:chapter-001',
	anchor: {
		start: 2,
		end: 4,
		revision: 1,
		quote: '林越',
		before: '夜里',
		after: '走进车站'
	},
	displayText: '林越',
	status: 'active',
	revision: 1,
	createdAt: '2026-07-29T00:00:00.000Z',
	updatedAt: '2026-07-29T00:00:00.000Z'
});

describe('EntityPeekCard', () => {
	it('requires an explicit choice when exact links overlap', async () => {
		const onSelect = vi.fn();
		render(
			<EntityPeekCard
				x={120}
				y={180}
				candidates={[
					characterMention,
					{
						...characterMention,
						id: parseStoryId('mention:station'),
						resourceId: parseStoryId('location:station')
					}
				]}
				onSelect={onSelect}
				onClose={() => undefined}
				onOpenFull={() => undefined}
				onJumpBacklink={() => undefined}
			/>
		);

		expect(screen.getByText('这里有 2 个精确引用')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('option', { name: /character:lin-yue/ }));
		expect(onSelect).toHaveBeenCalledWith(characterMention);
	});

	it('shows a compact on-demand summary and supports Enter/Escape', () => {
		const onOpenFull = vi.fn();
		const onClose = vi.fn();
		const resource = StorySchemaRegistry.parse('character', {
			id: 'character:lin-yue',
			type: 'character',
			title: '林越',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: '2026-07-29T00:00:00.000Z',
			updatedAt: '2026-07-29T00:00:00.000Z',
			revision: 1,
			role: 'protagonist',
			factionIds: [],
			goals: ['找到失踪的姐姐'],
			desires: [],
			fears: [],
			values: [],
			secrets: [],
			evidenceIds: []
		});
		render(
			<EntityPeekCard
				x={120}
				y={180}
				candidates={[characterMention]}
				result={{
					mention: characterMention,
					resource,
					summary: {
						kindLabel: '人物',
						lines: ['身份：主角', '目标：找到失踪的姐姐']
					},
					backlinks: [characterMention]
				}}
				onSelect={() => undefined}
				onClose={onClose}
				onOpenFull={onOpenFull}
				onJumpBacklink={() => undefined}
			/>
		);

		expect(screen.getByRole('dialog', { name: '林越资料速览' })).toHaveTextContent('目标：找到失踪的姐姐');
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
		expect(onOpenFull).toHaveBeenCalledOnce();
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
	});
});
