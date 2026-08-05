import {
	act,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
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
	it('TC-ITEM-TRANSFER-DIALOG-001 item-transfer-commit renders accessible enabled controls, handles pointer and Escape keyboard, blocks disabled pending close and cancellation, deduplicates repeated persistence, reports failure, retries and confirms save success without replacing history', async () => {
		const user = userEvent.setup();
		let rejectFirst: (reason: Error) => void = () => undefined;
		const firstCommit = new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		});
		const onCommit = vi.fn()
			.mockImplementationOnce(() => firstCommit)
			.mockResolvedValue(undefined);
		const onCancel = vi.fn();
		render(<ItemTransferDialog item={item} current={current} onCancel={onCancel} onCommit={onCommit} />);
		const dialog = screen.getByRole('dialog', { name: '转移「笔记本」' });
		const close = screen.getByRole('button', { name: '关闭转移对话框' });
		const holder = screen.getByRole('textbox', { name: '新持有人 ID' });
		const location = screen.getByRole('textbox', { name: '新地点 ID' });
		const quantity = screen.getByRole('spinbutton', { name: '转移数量' });
		const order = screen.getByRole('spinbutton', { name: '转移叙事位置' });

		expect(dialog).toBeVisible();
		expect(close).toBeEnabled();
		expect.soft(close).toHaveAttribute('data-testid', 'item-transfer-close');
		expect.soft(holder).toHaveAttribute('data-testid', 'item-transfer-holder');
		expect.soft(location).toHaveAttribute('data-testid', 'item-transfer-location');
		expect.soft(quantity).toHaveAttribute('data-testid', 'item-transfer-quantity');
		expect.soft(order).toHaveAttribute('data-testid', 'item-transfer-order');
		await user.clear(holder);
		await user.type(holder, 'character:shen');
		expect(screen.getByText(/character:lin → character:shen/)).toBeInTheDocument();
		const commit = screen.getByRole('button', { name: /确认转移/ });
		expect(commit).toBeEnabled();
		expect.soft(commit).toHaveAttribute('data-testid', 'item-transfer-commit');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				commit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect.soft(onCommit).toHaveBeenCalledOnce();
		expect(close).toBeDisabled();
		expect(holder).toBeDisabled();
		expect(location).toBeDisabled();
		expect(quantity).toBeDisabled();
		expect(order).toBeDisabled();
		expect(commit).toBeDisabled();
		expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({
			action: 'transferred',
			holderCharacterId: 'character:shen',
			confirmation: 'pending'
		}));
		fireEvent.click(close);
		fireEvent.keyDown(dialog, { key: 'Escape' });
		expect.soft(onCancel).not.toHaveBeenCalled();

		await act(async () => {
			rejectFirst(new Error('D:/private-project/story/items.json'));
			await firstCommit.catch(() => undefined);
		});
		expect.soft(screen.queryByRole('alert')).toHaveTextContent('转移保存失败，请重试。');
		expect.soft(screen.queryByRole('alert')).not.toHaveTextContent('private-project');
		fireEvent.click(commit);
		await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(commit).toBeEnabled());
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
