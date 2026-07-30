import {
	AlertTriangle,
	Check,
	LoaderCircle,
	Sparkles,
	Trash2
} from 'lucide-react';
import type { PendingDraftCandidate } from './InlineDraftCandidateModel';

export interface InlineDraftCardProps {
	readonly candidate: PendingDraftCandidate;
	readonly stale: boolean;
	readonly onChange: (content: string) => void;
	readonly onCommit: () => void;
	readonly onDiscard: () => void;
}

export function InlineDraftCard(props: InlineDraftCardProps): React.JSX.Element {
	const applying = props.candidate.status === 'applying';
	const failed = props.candidate.status === 'failed';
	const writeDisabled = props.stale
		|| applying
		|| !props.candidate.content.trim()
		|| !['ready', 'edited', 'failed'].includes(props.candidate.status);

	return (
		<section
			className={`inline-draft-card ${props.stale ? 'is-stale' : ''}`}
			aria-label="AI 临时草稿"
			role="region"
		>
			<header className="inline-draft-heading">
				<div className="inline-draft-title">
					<span className="inline-draft-mark" aria-hidden="true">
						<Sparkles size={18} />
					</span>
					<div>
						<strong>AI 临时草稿</strong>
						<span>{props.candidate.status === 'edited' ? '作者已编辑' : '等待确认'}</span>
					</div>
				</div>
				<span className="inline-draft-safety">尚未写入，不计入正文字数</span>
			</header>

			<div className="inline-draft-context">
				<p><strong>写入位置</strong><span>{props.candidate.targetSummary}</span></p>
				<p><strong>使用上下文</strong><span>{props.candidate.contextSummary}</span></p>
			</div>

			{props.stale ? (
				<p className="inline-draft-alert" role="alert">
					<AlertTriangle size={18} />
					正文已在生成后发生变化。为避免写错位置，此草稿不能写入；请丢弃后重新生成。
				</p>
			) : null}
			{failed && props.candidate.error ? (
				<p className="inline-draft-alert" role="alert">
					<AlertTriangle size={18} />{props.candidate.error}
				</p>
			) : null}

			<label className="inline-draft-editor">
				<span>编辑 AI 临时草稿</span>
				<textarea
					value={props.candidate.content}
					disabled={applying || props.stale}
					aria-label="编辑 AI 临时草稿"
					onChange={event => props.onChange(event.target.value)}
				/>
			</label>

			<footer className="inline-draft-actions">
				<button
					className="primary-button"
					type="button"
					disabled={writeDisabled}
					onClick={props.onCommit}
				>
					{applying
						? <LoaderCircle className="spin" size={18} />
						: <Check size={18} />}
					{applying ? '正在安全写入…' : '写入正文'}
				</button>
				<button
					className="secondary-button"
					type="button"
					disabled={applying}
					aria-label="丢弃临时草稿"
					onClick={props.onDiscard}
				>
					<Trash2 size={18} />丢弃
				</button>
			</footer>
		</section>
	);
}
