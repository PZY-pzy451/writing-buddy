import { ExternalLink, FileText, GitCompareArrows } from 'lucide-react';
import type {
	ContinuityEvidence,
	ContinuityIssue
} from '@writing-buddy/story-kernel';

export function IssueEvidenceView(props: {
	readonly issue: ContinuityIssue;
	readonly onOpenEvidence: (evidence: ContinuityEvidence) => void;
}): React.JSX.Element {
	return (
		<section className="continuity-evidence" aria-label="问题证据">
			<header>
				<div>
					{props.issue.evidence.length > 1 ? <GitCompareArrows size={18} /> : <FileText size={18} />}
					<h3>{props.issue.evidence.length > 1 ? '多处证据对照' : '正文证据'}</h3>
				</div>
				<span>{props.issue.evidence.length} 处</span>
			</header>
			<div className="continuity-evidence-list">
				{props.issue.evidence.map((evidence, index) => (
					<article key={evidence.id}>
						<div>
							<strong>{evidence.label}</strong>
							<span>{evidence.chapterId ?? evidence.resourceId}</span>
						</div>
						{evidence.storyTime ? <small>故事时间：{evidence.storyTime}</small> : null}
						{evidence.quote ? <blockquote>{evidence.quote}</blockquote> : null}
						<button type="button" onClick={() => props.onOpenEvidence(evidence)}>
							打开证据 {index + 1}<ExternalLink size={14} />
						</button>
					</article>
				))}
			</div>
		</section>
	);
}
