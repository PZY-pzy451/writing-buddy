import { ArrowUpRight, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MentionLink } from '@writing-buddy/story-kernel';
import type { MentionService } from '../manuscript/MentionService';

interface BacklinksPanelProps {
	readonly service: MentionService;
	readonly resourceId: string;
	readonly onOpenBacklink: (mention: MentionLink) => void;
}

export function BacklinksPanel({
	service,
	resourceId,
	onOpenBacklink
}: BacklinksPanelProps): React.JSX.Element {
	const [backlinks, setBacklinks] = useState<readonly MentionLink[]>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		let cancelled = false;
		void service.listBacklinks(resourceId)
			.then(result => {
				if (!cancelled) {
					setBacklinks(result);
					setError(undefined);
				}
			})
			.catch(reason => {
				if (!cancelled) {
					setError(reason instanceof Error ? reason.message : 'mentionReadFailed');
				}
			});
		return () => {
			cancelled = true;
		};
	}, [resourceId, service]);

	return (
		<section className="backlinks-panel" aria-labelledby="backlinks-heading">
			<div className="backlinks-heading">
				<Link2 size={16} />
				<h3 id="backlinks-heading">正文反向链接</h3>
				<span>{backlinks?.length ?? '—'}</span>
			</div>
			{error ? <p className="backlinks-error">反向链接暂时无法读取。</p> : backlinks ? (
				backlinks.length ? (
					<ul>
						{backlinks.map(mention => (
							<li key={mention.id}>
								<button type="button" onClick={() => onOpenBacklink(mention)}>
									<span>
										<strong>{mention.displayText}</strong>
										<small>{mention.chapterId} · 位置 {mention.anchor.start}</small>
									</span>
									{mention.status === 'stale' && <em>需重定位</em>}
									<ArrowUpRight size={16} />
								</button>
							</li>
						))}
					</ul>
				) : <p>正文中还没有链接到该资源。</p>
			) : <p>正在读取正文链接…</p>}
		</section>
	);
}
