import {
	AlertTriangle,
	Check,
	Clock3,
	Sparkles,
	Undo2,
	X
} from 'lucide-react';
import type { ReactNode } from 'react';
import './interaction.css';

export type AiCandidateVisualState =
	| 'pending'
	| 'conflict'
	| 'accepted'
	| 'rejected'
	| 'stale';

const stateLabels: Readonly<Record<AiCandidateVisualState, string>> = {
	pending: '待确认',
	conflict: '需处理',
	accepted: '已写入',
	rejected: '已拒绝',
	stale: '来源已变化'
};

function StateIcon({ state }: { readonly state: AiCandidateVisualState }): React.JSX.Element {
	if (state === 'conflict') return <AlertTriangle size={16} aria-hidden="true" />;
	if (state === 'accepted') return <Check size={16} aria-hidden="true" />;
	if (state === 'rejected') return <X size={16} aria-hidden="true" />;
	if (state === 'stale') return <Undo2 size={16} aria-hidden="true" />;
	if (state === 'pending') return <Clock3 size={16} aria-hidden="true" />;
	return <Sparkles size={16} aria-hidden="true" />;
}

export function AiCandidateFrame({
	state,
	children,
	className = ''
}: {
	readonly state: AiCandidateVisualState;
	readonly children: ReactNode;
	readonly className?: string;
}): React.JSX.Element {
	return (
		<article
			className={`interaction-ai-candidate ${className}`.trim()}
			data-ai-state={state}
		>
			<span className="interaction-ai-candidate-accent" aria-hidden="true" />
			{children}
		</article>
	);
}

export function AiCandidateStatus({
	state
}: {
	readonly state: AiCandidateVisualState;
}): React.JSX.Element {
	return (
		<span className="interaction-ai-candidate-status" data-ai-state={state}>
			<StateIcon state={state} />
			{stateLabels[state]}
		</span>
	);
}
