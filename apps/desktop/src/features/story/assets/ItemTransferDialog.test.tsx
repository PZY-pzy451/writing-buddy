import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseItemState, parseStoryItem } from '@writing-buddy/story-kernel';
import { ItemTransferDialog } from './ItemTransferDialog';

const timestamp = '2026-07-27T00:00:00.000Z';
const item = parseStoryItem({
	id: 'item:notebook', type: 'item', title: '笔记本', aliases: [], tags: [],
	schemaVersion: 1, createdAt: timestamp, updatedAt: timestamp, revision: 0,
	unique: true, restrictions: [], evidenceIds: []
});
const current = parseItemState({
	id: 'item-state:current', itemId: item.id, action: 'acquired', quantity: 1,
	holderCharacterId: 'character:lin', locationId: 'location:station',
	effectiveFrom: { chapterId: 'chapter:chapter-001', narrativeOrder: 1 },
	evidenceIds: [], confirmation: 'confirmed', revision: 0
});

describe('ItemTransferDialog', () => {
	it('previews and commits a pending transfer without replacing history', async () => {
		const user = userEvent.setup();
		const onCommit = vi.fn(() => Promise.resolve());
		render(<ItemTransferDialog item={item} current={current} onCancel={() => undefined} onCommit={onCommit} />);
		await user.clear(screen.getByRole('textbox', { name: '新持有人 ID' }));
		await user.type(screen.getByRole('textbox', { name: '新持有人 ID' }), 'character:shen');
		expect(screen.getByText(/character:lin → character:shen/)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /确认转移/ }));
		expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({
			action: 'transferred',
			holderCharacterId: 'character:shen',
			confirmation: 'pending'
		}));
	});
});
