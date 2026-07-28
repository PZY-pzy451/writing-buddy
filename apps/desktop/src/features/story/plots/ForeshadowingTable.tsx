import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Foreshadowing } from '@writing-buddy/story-kernel';

const statusLabels = {
	planted: '已埋设',
	reminded: '已提醒',
	resolved: '已回收',
	overdue: '已逾期',
	abandoned: '已放弃'
} as const;

export function ForeshadowingTable({
	items,
	currentOrder,
	onSelect
}: {
	readonly items: readonly Foreshadowing[];
	readonly currentOrder: number;
	readonly onSelect: (item: Foreshadowing) => void;
}): React.JSX.Element {
	return (
		<div className="foreshadowing-table-scroll">
			<table className="foreshadowing-table" aria-label="伏笔生命周期表">
				<thead><tr><th>伏笔</th><th>状态</th><th>埋设</th><th>提醒</th><th>计划回收</th><th>实际回收</th><th>读者可见</th></tr></thead>
				<tbody>
					{items.map(item => {
						const overdue = !['resolved', 'abandoned'].includes(item.status)
							&& Boolean(item.plannedPayoffAt && item.plannedPayoffAt.narrativeOrder < currentOrder);
						const early = Boolean(
							item.actualPayoffAt
							&& item.plannedPayoffAt
							&& item.actualPayoffAt.narrativeOrder
								< item.plannedPayoffAt.narrativeOrder
						);
						return (
							<tr key={item.id} className={overdue || early ? 'is-overdue' : ''}>
								<td><button type="button" onClick={() => onSelect(item)}>{item.title}</button></td>
								<td><span>{overdue || early ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}{overdue ? '逾期' : early ? '提前回收' : statusLabels[item.status]}</span></td>
								<td>{item.plantedAt?.narrativeOrder ?? '—'}</td>
								<td>{item.reminderPositions.length}</td>
								<td>{item.plannedPayoffAt?.narrativeOrder ?? '—'}</td>
								<td>{item.actualPayoffAt?.narrativeOrder ?? '—'}</td>
								<td>{Math.round(item.readerVisibility * 100)}%</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
