import { ArrowRight, PackageCheck, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
	createStoryId,
	parseItemState,
	type ItemState,
	type StoryItem
} from '@writing-buddy/story-kernel';
import { useModalFocus } from '../../../accessibility/useModalFocus';

export function ItemTransferDialog({
	item,
	current,
	onCancel,
	onCommit
}: {
	readonly item: StoryItem;
	readonly current?: ItemState;
	readonly onCancel: () => void;
	readonly onCommit: (state: ItemState) => Promise<void>;
}): React.JSX.Element {
	const [holderId, setHolderId] = useState(current?.holderCharacterId ?? '');
	const [locationId, setLocationId] = useState(current?.locationId ?? '');
	const [quantity, setQuantity] = useState(current?.quantity ?? 1);
	const [order, setOrder] = useState((current?.effectiveFrom.narrativeOrder ?? 0) + 1);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const commitInFlightRef = useRef(false);
	const closeAndRestore = () => {
		if (saving || commitInFlightRef.current) return;
		onCancel();
	};
	const dialogRef = useModalFocus(closeAndRestore);
	const preview = useMemo(() => (
		`${current?.holderCharacterId ?? '无持有人'} → ${holderId || '无持有人'}；`
		+ `数量 ${current?.quantity ?? 0} → ${quantity}；位置 ${locationId || '未指定'}`
	), [current, holderId, locationId, quantity]);
	const commitTransfer = async () => {
		if (saving || commitInFlightRef.current) return;
		commitInFlightRef.current = true;
		setSaving(true);
		setError('');
		try {
			const state = parseItemState({
				id: createStoryId('item-state'),
				itemId: item.id,
				action: 'transferred',
				quantity,
				holderCharacterId: holderId,
				...(locationId ? { locationId } : {}),
				effectiveFrom: {
					chapterId: current?.effectiveFrom.chapterId ?? 'chapter:unassigned',
					narrativeOrder: order
				},
				evidenceIds: [],
				confirmation: 'pending',
				revision: 0
			});
			await onCommit(state);
		} catch {
			setError('转移保存失败，请重试。');
		} finally {
			commitInFlightRef.current = false;
			setSaving(false);
		}
	};

	return (
		<div className="item-transfer-backdrop">
			<section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="item-transfer-title" aria-busy={saving} className="item-transfer-dialog">
				<header>
					<div><span className="eyebrow">TRANSFER TRANSACTION</span><h2 id="item-transfer-title">转移「{item.title}」</h2></div>
					<button type="button" data-testid="item-transfer-close" aria-label="关闭转移对话框" disabled={saving} onClick={closeAndRestore}><X size={18} /></button>
				</header>
				<div className="item-transfer-grid">
					<label><span>新持有人 ID</span><input data-testid="item-transfer-holder" aria-label="新持有人 ID" value={holderId} disabled={saving} onChange={event => setHolderId(event.target.value)} placeholder="character:..." /></label>
					<label><span>新地点 ID</span><input data-testid="item-transfer-location" aria-label="新地点 ID" value={locationId} disabled={saving} onChange={event => setLocationId(event.target.value)} placeholder="location:..." /></label>
					<label><span>数量</span><input data-testid="item-transfer-quantity" aria-label="转移数量" type="number" min={0} value={quantity} disabled={saving} onChange={event => setQuantity(Number(event.target.value))} /></label>
					<label><span>叙事位置</span><input data-testid="item-transfer-order" aria-label="转移叙事位置" type="number" min={0} value={order} disabled={saving} onChange={event => setOrder(Number(event.target.value))} /></label>
				</div>
				<div className="item-transfer-preview">
					<PackageCheck size={20} />
					<div><strong>影响预览</strong><p>{preview}</p><small>提交后新增状态记录，不覆盖已有历史。</small></div>
				</div>
				{error ? <p className="item-transfer-error" role="alert">{error}</p> : null}
				<button
					type="button"
					className="item-transfer-commit"
					data-testid="item-transfer-commit"
					disabled={saving || quantity < 0 || !holderId.startsWith('character:')}
					onClick={() => void commitTransfer()}
				>
					{saving ? '提交中…' : <><span>确认转移</span><ArrowRight size={18} /></>}
				</button>
			</section>
		</div>
	);
}
