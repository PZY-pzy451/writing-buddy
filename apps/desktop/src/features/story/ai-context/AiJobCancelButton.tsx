import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import { describeAiFailure } from '../../ai/errors/AiErrorPresentation';

const missingJobMessage = '没有找到正在生成的任务，请稍候后重试取消。';
const unknownCancellationMessage = '取消请求未完成，请检查 AI 连接状态后重试。';

function cancellationFailureMessage(reason: unknown): string {
	const failure = describeAiFailure(reason);
	return failure.code === 'unknown' ? unknownCancellationMessage : failure.message;
}

export interface AiJobCancelButtonProps {
	readonly jobId: string;
	readonly className?: string;
	readonly label?: string;
	readonly pendingLabel?: string;
	readonly showIcon?: boolean;
	readonly onBeforeCancel?: () => void;
	readonly onErrorChange?: (message?: string) => void;
}

export function AiJobCancelButton(
	props: AiJobCancelButtonProps
): React.JSX.Element {
	const [requestedJobId, setRequestedJobId] = useState<string>();
	const guardedJobIdRef = useRef<string | undefined>(undefined);
	const requestVersionRef = useRef(0);
	const mountedRef = useRef(true);
	const currentJobIdRef = useRef(props.jobId);
	const cancelRequested = requestedJobId === props.jobId;

	useEffect(() => {
		currentJobIdRef.current = props.jobId;
	}, [props.jobId]);

	useEffect(() => () => {
		mountedRef.current = false;
	}, []);

	const release = (version: number, message?: string) => {
		if (
			!mountedRef.current
			|| requestVersionRef.current !== version
			|| currentJobIdRef.current !== props.jobId
		) return;
		guardedJobIdRef.current = undefined;
		setRequestedJobId(undefined);
		if (message) props.onErrorChange?.(message);
	};

	const cancel = async () => {
		if (guardedJobIdRef.current === props.jobId) return;
		guardedJobIdRef.current = props.jobId;
		setRequestedJobId(props.jobId);
		props.onBeforeCancel?.();
		props.onErrorChange?.(undefined);
		const version = requestVersionRef.current + 1;
		requestVersionRef.current = version;
		try {
			const accepted = await desktopBridge.cancelAiJob(props.jobId);
			if (!accepted) release(version, missingJobMessage);
		} catch (reason) {
			release(version, cancellationFailureMessage(reason));
		}
	};

	const label = props.label ?? '取消';
	const pendingLabel = props.pendingLabel ?? '正在取消';
	return (
		<button
			type="button"
			className={props.className}
			data-testid="ai-job-cancel"
			disabled={cancelRequested}
			onClick={() => void cancel()}
		>
			{props.showIcon
				? cancelRequested
					? <LoaderCircle className="spin" size={16} />
					: <X size={16} />
				: null}
			{cancelRequested ? pendingLabel : label}
		</button>
	);
}
