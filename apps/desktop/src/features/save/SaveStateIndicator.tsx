import {
	AlertTriangle,
	Check,
	CircleAlert,
	HardDriveDownload,
	LoaderCircle
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { saveStatePresentation } from './SaveStateModel';

export interface SaveStateIndicatorProps {
	readonly className?: string;
	readonly compact?: boolean;
}

export function SaveStateIndicator({
	className = '',
	compact = false
}: SaveStateIndicatorProps): React.JSX.Element | null {
	const session = useAppStore(state => state.session);
	const saveState = useAppStore(state => state.saveState);
	if (!session) return null;
	const presentation = saveStatePresentation(saveState);
	const Icon = saveState.type === 'clean'
		? Check
		: saveState.type === 'saving'
			? LoaderCircle
			: saveState.type === 'offline'
				? HardDriveDownload
				: saveState.type === 'external_conflict'
					? AlertTriangle
					: CircleAlert;
	return (
		<span
			className={[
				'save-state-indicator',
				`is-${presentation.tone}`,
				compact ? 'is-compact' : '',
				className
			].filter(Boolean).join(' ')}
			role="status"
			aria-live={presentation.tone === 'danger' ? 'assertive' : 'polite'}
			title={presentation.detail}
		>
			<Icon
				size={16}
				className={saveState.type === 'saving' ? 'spin' : undefined}
				aria-hidden="true"
			/>
			<span>{presentation.label}</span>
		</span>
	);
}
