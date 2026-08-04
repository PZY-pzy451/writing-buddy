import { Check, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	canUndoCommittedDraft,
	noticeBelongsToTarget,
	type InlineDraftCommitNotice,
	type InlineDraftCommitTarget
} from './InlineDraftCommitNoticeModel';

export function InlineDraftCommitNoticeBanner({
	notice,
	target,
	onUndo,
	onDismiss
}: {
	readonly notice: InlineDraftCommitNotice;
	readonly target: InlineDraftCommitTarget;
	readonly onUndo: () => Promise<void>;
	readonly onDismiss: () => void;
}): React.JSX.Element {
	const actionInFlightRef = useRef(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const available = canUndoCommittedDraft(notice, target);
	const targetProjectId = target.projectId;
	const targetResourceId = target.resourceId;
	const targetModelUri = target.modelUri;

	useEffect(() => {
		if (!noticeBelongsToTarget(notice, {
			projectId: targetProjectId,
			resourceId: targetResourceId,
			modelUri: targetModelUri
		})) {
			onDismiss();
		}
	}, [
		notice,
		onDismiss,
		targetModelUri,
		targetProjectId,
		targetResourceId
	]);

	const undo = async (): Promise<void> => {
		if (!available || actionInFlightRef.current) return;
		actionInFlightRef.current = true;
		setBusy(true);
		setError(undefined);
		try {
			await onUndo();
		} catch {
			setError('撤销未完成，请重试。');
		} finally {
			actionInFlightRef.current = false;
			setBusy(false);
		}
	};

	return (
		<div className="inline-draft-commit-notice" role="status" aria-busy={busy}>
			<Check size={18} />
			<span>{notice.message}</span>
			<button
				type="button"
				aria-label="撤销 AI 正文写入"
				disabled={busy || !available}
				title={available
					? '一次撤销完整 AI 写入'
					: '正文已继续编辑，请使用编辑器原生撤销'}
				onClick={() => void undo()}
			>
				<RotateCcw size={18} />{busy ? '正在撤销…' : '撤销'}
			</button>
			{error ? <span role="alert">{error}</span> : null}
			<button
				className="icon-button"
				type="button"
				aria-label="关闭 AI 写入提示"
				disabled={busy}
				onClick={onDismiss}
			>
				<X size={18} />
			</button>
		</div>
	);
}
