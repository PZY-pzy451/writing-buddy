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
	it('requires an explicit pointer or Arrow keyboard choice when exact links overlap', async () => {
		const onSelect = vi.fn();
		const stationMention = {
			...characterMention,
			id: parseStoryId('mention:station'),
			resourceId: parseStoryId('location:station')
		};
		render(
			<EntityPeekCard
				x={120}
				y={180}
				candidates={[
					characterMention,
					stationMention
				]}
				onSelect={onSelect}
				onClose={() => undefined}
				onOpenFull={() => undefined}
				onJumpBacklink={() => undefined}
			/>
		);

		expect(screen.getByText('这里有 2 个精确引用')).toBeInTheDocument();
		const candidates = screen.getAllByTestId('entity-peek-candidate');
		await userEvent.click(candidates[0]);
		expect(onSelect).toHaveBeenNthCalledWith(1, characterMention);

		candidates[0].focus();
		fireEvent.keyDown(candidates[0], { key: 'ArrowDown' });
		expect(candidates[1]).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		expect(onSelect).toHaveBeenNthCalledWith(2, stationMention);
	});

	it('shows a visible compact summary, jumps to a backlink and opens or closes with Enter/Escape', () => {
		const onOpenFull = vi.fn();
		const onClose = vi.fn();
		const onJumpBacklink = vi.fn();
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
				onJumpBacklink={onJumpBacklink}
			/>
		);

		const dialog = screen.getByTestId('entity-peek-dialog');
		expect(dialog).toHaveFocus();
		expect(dialog).toHaveTextContent('目标：找到失踪的姐姐');
		fireEvent.click(screen.getByText('正文中出现 1 次'));
		fireEvent.click(screen.getByTestId('entity-peek-backlink'));
		expect(onJumpBacklink).toHaveBeenCalledWith(characterMention);
		fireEvent.keyDown(dialog, { key: 'Enter' });
		expect(onOpenFull).toHaveBeenCalledOnce();
		fireEvent.keyDown(dialog, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
	});
});
