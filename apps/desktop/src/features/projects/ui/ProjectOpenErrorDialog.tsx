import {
	AlertTriangle,
	Check,
	Clipboard,
	FolderOpen,
	RefreshCw,
	ShieldCheck,
	Stethoscope,
	Wrench
} from 'lucide-react';
import { useState } from 'react';
import { useModalFocus } from '../../../accessibility/useModalFocus';
import type { PublicProjectOpenError } from '../application/ProjectOpenService';

interface ProjectOpenErrorDialogProps {
	readonly error: PublicProjectOpenError;
	readonly busyAction?: 'retry' | 'read-only' | 'repair' | 'directory';
	readonly onRetry: () => void;
	readonly onOpenReadOnly: () => void;
	readonly onRepair: () => void;
	readonly onOpenDirectory: () => void;
	readonly onClose: () => void;
}

const stageLabels: Record<PublicProjectOpenError['stage'], string> = {
	'select-path': '选择项目路径',
	'read-manifest': '读取项目清单',
	'validate-schema': '校验项目格式',
	'acquire-lock': '获取写入锁',
	'integrity-scan': '检查项目完整性',
	'load-index': '加载项目索引'
};

const errorCopy: Record<string, { readonly title: string; readonly detail: string }> = {
	projectRootUnavailable: {
		title: '项目目录不可用',
		detail: '目录可能已移动、删除，或当前账户没有读取权限。'
	},
	manifestNotFound: {
		title: '没有找到项目清单',
		detail: '所选目录不是可识别的 Writing Buddy 项目。'
	},
	invalidManifest: {
		title: '项目清单无法解析',
		detail: '项目文件存在，但内容不是有效的 Writing Buddy 清单。'
	},
	unsupportedSchema: {
		title: '项目版本暂不受支持',
		detail: '此版本不会静默迁移项目，请先查看诊断信息。'
	},
	projectLocked: {
		title: '作品正在其他窗口中编辑',
		detail: '可以关闭其他窗口后重试，或以只读方式安全查看。'
	},
	staleLockRemoveFailed: {
		title: '旧的项目锁需要修复',
		detail: '应用检测到已失效的锁文件，但无法自动清理。'
	},
	projectOpenFailed: {
		title: '作品暂时无法打开',
		detail: '应用已保留安全诊断编号，可以重试或查看诊断。'
	}
};

export function ProjectOpenErrorDialog({
	error,
	busyAction,
	onRetry,
	onOpenReadOnly,
	onRepair,
	onOpenDirectory,
	onClose
}: ProjectOpenErrorDialogProps): React.JSX.Element {
	const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const copy = errorCopy[error.code] ?? errorCopy.projectOpenFailed;
	const dialogRef = useModalFocus(onClose);

	const copyPath = async () => {
		if (!error.safePath || !navigator.clipboard) {
			return;
		}
		await navigator.clipboard.writeText(error.safePath);
		setCopied(true);
	};

	return (
		<div className="modal-backdrop" role="presentation">
			<section ref={dialogRef} tabIndex={-1} className="project-open-dialog" role="dialog" aria-modal="true" aria-labelledby="project-open-title">
				<header>
					<span className="project-open-icon" aria-hidden="true"><AlertTriangle size={22} /></span>
					<div>
						<span className="eyebrow">PROJECT OPEN</span>
						<h2 id="project-open-title">作品打开失败</h2>
						<p>{copy.title}</p>
					</div>
				</header>

				<div className="project-open-summary">
					<strong>{stageLabels[error.stage]}</strong>
					<p>{copy.detail}</p>
					{error.safePath && (
						<div className="project-safe-path">
							<code>{error.safePath}</code>
							<button type="button" className="icon-button" aria-label="复制安全路径" onClick={() => void copyPath()}>
								{copied ? <Check size={17} /> : <Clipboard size={17} />}
							</button>
						</div>
					)}
				</div>

				{diagnosticsOpen && (
					<dl className="project-open-diagnostics">
						<div><dt>错误码</dt><dd>{error.code}</dd></div>
						<div><dt>失败阶段</dt><dd>{error.stage}</dd></div>
						<div><dt>诊断编号</dt><dd>{error.diagnosticId}</dd></div>
						<div><dt>隐私说明</dt><dd>诊断信息不包含正文、API Key 或完整用户名路径。</dd></div>
					</dl>
				)}

				<div className="project-open-actions">
					<button type="button" className="primary-button" disabled={busyAction !== undefined} onClick={onRetry}>
						<RefreshCw size={17} />{busyAction === 'retry' ? '正在重试…' : '重试'}
					</button>
					{error.canOpenReadOnly && (
						<button type="button" className="secondary-button" disabled={busyAction !== undefined} onClick={onOpenReadOnly}>
							<ShieldCheck size={17} />{busyAction === 'read-only' ? '正在打开…' : '只读打开'}
						</button>
					)}
					{error.canRepair && (
						<button type="button" className="secondary-button" disabled={busyAction !== undefined} onClick={onRepair}>
							<Wrench size={17} />{busyAction === 'repair' ? '正在修复…' : '修复项目'}
						</button>
					)}
					{error.safePath && (
						<button type="button" className="secondary-button" disabled={busyAction !== undefined} onClick={onOpenDirectory}>
							<FolderOpen size={17} />打开目录
						</button>
					)}
					<button type="button" className="secondary-button" aria-expanded={diagnosticsOpen} onClick={() => setDiagnosticsOpen(value => !value)}>
						<Stethoscope size={17} />{diagnosticsOpen ? '收起诊断' : '查看诊断'}
					</button>
					<button type="button" className="text-button" onClick={onClose}>关闭</button>
				</div>
			</section>
		</div>
	);
}
