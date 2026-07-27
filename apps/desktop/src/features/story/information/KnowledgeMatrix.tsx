import { useMemo, useState } from 'react';
import {
	getKnowledgeAt,
	type Character,
	type KnowledgeState,
	type KnowledgeStatus,
	type StoryInformation
} from '@writing-buddy/story-kernel';

const statusLabels: Readonly<Record<KnowledgeStatus, string>> = {
	knows: '已知',
	'believes-true': '误以为真',
	'believes-false': '误以为假',
	unknown: '未知'
};

const rowHeight = 52;
const viewportHeight = 364;

export function KnowledgeMatrix({
	information,
	characters,
	states,
	narrativeOrder
}: {
	readonly information: StoryInformation;
	readonly characters: readonly Character[];
	readonly states: readonly KnowledgeState[];
	readonly narrativeOrder: number;
}): React.JSX.Element {
	const [scrollTop, setScrollTop] = useState(0);
	const subjects = useMemo(() => [
		{ id: 'reader', title: '读者', role: '读者视角' },
		...characters.map(character => ({ id: character.id, title: character.title, role: character.role ?? '人物' }))
	], [characters]);
	const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
	const visible = subjects.slice(start, start + Math.ceil(viewportHeight / rowHeight) + 4);

	return (
		<div className="knowledge-matrix" role="table" aria-label="信息权限矩阵" aria-rowcount={subjects.length + 1}>
			<div className="knowledge-matrix-heading" role="row">
				<span role="columnheader">主体</span><span role="columnheader">当前认知</span>
				<span role="columnheader">生效章节</span><span role="columnheader">依据</span>
			</div>
			<div className="knowledge-matrix-viewport" style={{ height: viewportHeight }} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
				<div style={{ height: start * rowHeight }} aria-hidden="true" />
				{visible.map((subject, index) => {
					const state = getKnowledgeAt(states, information.id, subject.id, narrativeOrder);
					const status = state?.status ?? 'unknown';
					return (
						<div className="knowledge-matrix-row" role="row" aria-rowindex={start + index + 2} key={subject.id}>
							<span role="cell"><strong>{subject.title}</strong><small>{subject.role}</small></span>
							<span role="cell"><em data-status={status}>{statusLabels[status]}</em></span>
							<span role="cell">{state ? `#${state.effectiveFrom.narrativeOrder}` : '—'}</span>
							<span role="cell">{state?.evidenceIds.length ? `${state.evidenceIds.length} 条证据` : '未标注'}</span>
						</div>
					);
				})}
				<div style={{ height: Math.max(0, subjects.length - start - visible.length) * rowHeight }} aria-hidden="true" />
			</div>
		</div>
	);
}
