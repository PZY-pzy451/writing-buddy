import {
	Eye,
	Highlighter,
	MapPin,
	Package,
	UserRound
} from 'lucide-react';
import type { MentionLink } from '@writing-buddy/story-kernel';
import {
	manuscriptHighlightKinds,
	mentionHighlightKind,
	type ManuscriptHighlightKind
} from './EntityHighlightPreferences';

const highlightLabels: Readonly<Record<ManuscriptHighlightKind, string>> = {
	character: '人物',
	location: '地点',
	item: '物品',
	foreshadowing: '伏笔'
};

function HighlightIcon({
	kind
}: {
	readonly kind: ManuscriptHighlightKind;
}): React.JSX.Element {
	if (kind === 'character') return <UserRound size={16} aria-hidden="true" />;
	if (kind === 'location') return <MapPin size={16} aria-hidden="true" />;
	if (kind === 'item') return <Package size={16} aria-hidden="true" />;
	return <Eye size={16} aria-hidden="true" />;
}

export function EntityHighlightControls({
	mentions,
	enabledKinds,
	onToggle
}: {
	readonly mentions: readonly MentionLink[];
	readonly enabledKinds: ReadonlySet<ManuscriptHighlightKind>;
	readonly onToggle: (kind: ManuscriptHighlightKind, enabled: boolean) => void;
}): React.JSX.Element {
	const counts = new Map<ManuscriptHighlightKind, number>(
		manuscriptHighlightKinds.map(kind => [kind, 0])
	);
	for (const mention of mentions) {
		if (mention.status !== 'active') continue;
		const kind = mentionHighlightKind(mention.resourceId);
		if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}
	const enabledCount = manuscriptHighlightKinds.filter(kind => enabledKinds.has(kind)).length;

	return (
		<details className="entity-highlight-controls">
			<summary>
				<Highlighter size={16} aria-hidden="true" />
				<span>资料高亮</span>
				<small>{enabledCount}/{manuscriptHighlightKinds.length}</small>
			</summary>
			<div aria-label="正文资料高亮">
				<header>
					<strong>正文资料高亮</strong>
					<small>默认关闭，仅标记已建立资料链接的文字。</small>
				</header>
				{manuscriptHighlightKinds.map(kind => (
					<label key={kind} data-kind={kind}>
						<input
							type="checkbox"
							checked={enabledKinds.has(kind)}
							onChange={event => onToggle(kind, event.target.checked)}
						/>
						<span className="entity-highlight-kind-icon">
							<HighlightIcon kind={kind} />
						</span>
						<span>
							<strong>{highlightLabels[kind]}</strong>
							<small>{counts.get(kind) ?? 0} 处链接</small>
						</span>
					</label>
				))}
			</div>
		</details>
	);
}
