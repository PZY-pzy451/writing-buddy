import type { Character, Relationship } from '@writing-buddy/story-kernel';

interface RelationshipMatrixProps {
	readonly characters: readonly Character[];
	readonly relationships: readonly Relationship[];
	readonly selectedId?: string;
	readonly onSelect: (relationship: Relationship) => void;
}

export function RelationshipMatrix({
	characters,
	relationships,
	selectedId,
	onSelect
}: RelationshipMatrixProps): React.JSX.Element {
	const byPair = new Map<string, readonly Relationship[]>();
	for (const relationship of relationships) {
		const key = `${relationship.sourceCharacterId}→${relationship.targetCharacterId}`;
		byPair.set(key, [...(byPair.get(key) ?? []), relationship]);
	}

	return (
		<div className="relationship-matrix-scroll">
			<table className="relationship-matrix" aria-label="人物有向关系矩阵">
				<thead>
					<tr>
						<th scope="col">发起者 ↓ / 目标 →</th>
						{characters.map(character => <th scope="col" key={character.id}>{character.title}</th>)}
					</tr>
				</thead>
				<tbody>
					{characters.map(source => (
						<tr key={source.id}>
							<th scope="row">{source.title}</th>
							{characters.map(target => {
								const cell = byPair.get(`${source.id}→${target.id}`) ?? [];
								return (
									<td key={target.id} className={source.id === target.id ? 'is-self' : ''}>
										{cell.map(relationship => (
											<button
												type="button"
												key={relationship.id}
												className={selectedId === relationship.id ? 'is-active' : ''}
												onClick={() => onSelect(relationship)}
												aria-label={`${source.title} 到 ${target.title}：${relationship.relationshipType}，强度 ${Math.round((relationship.strength ?? 0.5) * 100)}%`}
											>
												<strong>{relationship.relationshipType}</strong>
												<span>{Math.round((relationship.strength ?? 0.5) * 100)}%</span>
											</button>
										))}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
