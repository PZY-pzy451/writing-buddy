import { AlertTriangle, CheckCircle2, Clock3, Link2 } from 'lucide-react';
import {
	characterStateKinds,
	getStateAt,
	type CharacterStateKind,
	type StateRecord
} from '@writing-buddy/story-kernel';

const stateKindLabels: Readonly<Record<CharacterStateKind, string>> = {
	location: '当前位置',
	lifeStatus: '生存状态',
	health: '身体 / 伤势',
	emotion: '情绪',
	currentGoal: '当前目标',
	inventory: '持有物品',
	knowledge: '掌握信息',
	misconception: '误解信息',
	ability: '能力变化'
};

interface CharacterStateTimelineProps {
	readonly records: readonly StateRecord[];
	readonly narrativeOrder: number;
	readonly onNarrativeOrderChange: (value: number) => void;
}

function stateValue(value: StateRecord['value']): string {
	return Array.isArray(value) ? value.join('、') : String(value ?? '未设置');
}

export function CharacterStateTimeline({
	records,
	narrativeOrder,
	onNarrativeOrderChange
}: CharacterStateTimelineProps): React.JSX.Element {
	const snapshot = records[0]
		? getStateAt(records, {
			chapterId: records[0].effectiveFrom.chapterId,
			narrativeOrder
		})
		: {};

	return (
		<section className="character-state-panel" aria-label="人物状态时间切片">
			<div className="state-position-control">
				<div>
					<span className="eyebrow">POSITION-AWARE STATE</span>
					<h3>叙事位置 {narrativeOrder}</h3>
				</div>
				<label>
					<span>切换位置</span>
					<input
						type="number"
						min={0}
						value={narrativeOrder}
						onChange={event => onNarrativeOrderChange(Math.max(0, Number(event.target.value)))}
					/>
				</label>
			</div>
			<div className="character-state-grid">
				{characterStateKinds.map(kind => {
					const resolution = snapshot[kind];
					return (
						<article key={kind} className={resolution?.conflicts.length ? 'has-conflict' : ''}>
							<header>
								<span>{stateKindLabels[kind]}</span>
								{resolution?.current.confirmation === 'pending'
									? <span className="state-confirmation is-pending"><Clock3 size={13} />待确认</span>
									: resolution
										? <span className="state-confirmation"><CheckCircle2 size={13} />已确认</span>
										: null}
							</header>
							<strong>{resolution ? stateValue(resolution.current.value) : '未记录'}</strong>
							{resolution?.conflicts.length ? (
								<p className="state-conflict">
									<AlertTriangle size={16} />存在 {resolution.conflicts.length} 条冲突来源
								</p>
							) : null}
							{resolution?.current.evidenceIds.map(evidenceId => (
								<code key={evidenceId}><Link2 size={12} />{evidenceId}</code>
							))}
						</article>
					);
				})}
			</div>
		</section>
	);
}
