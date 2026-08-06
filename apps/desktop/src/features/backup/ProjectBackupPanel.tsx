import { Archive, CheckCircle2, FolderOpen, RotateCcw, ShieldCheck } from 'lucide-react';
import type { BackupInspection, BackupResult } from '@writing-buddy/platform-ports';
import { useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';

interface ProjectBackupPanelProps {
	readonly density?: 'card' | 'compact';
}

type BackupAction = 'create' | 'choose' | 'restore';

export function ProjectBackupPanel({
	density = 'card'
}: ProjectBackupPanelProps): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const reloadProject = useAppStore(state => state.reloadProject);
	const [busyAction, setBusyAction] = useState<BackupAction>();
	const [message, setMessage] = useState('');
	const [lastBackup, setLastBackup] = useState<BackupResult>();
	const [inspection, setInspection] = useState<BackupInspection>();
	const actionGuardRef = useRef(false);

	const createBackup = async () => {
		if (!snapshot || busyAction || actionGuardRef.current) return;
		actionGuardRef.current = true;
		setBusyAction('create');
		setMessage('');
		try {
			const result = await desktopBridge.createBackup(snapshot.root);
			const checked = await desktopBridge.inspectBackup(result.path);
			setLastBackup(result);
			setInspection(checked);
			setMessage(`备份已创建并校验：${result.entryCount} 个文件，${Math.max(1, Math.round(result.byteLength / 1024))} KB。`);
		} catch {
			setInspection(undefined);
			setMessage('备份创建失败，项目内容未受影响。请检查目标位置后重试。');
		} finally {
			actionGuardRef.current = false;
			setBusyAction(undefined);
		}
	};

	const chooseBackup = async () => {
		if (busyAction || actionGuardRef.current) return;
		actionGuardRef.current = true;
		setBusyAction('choose');
		setMessage('');
		try {
			const path = await desktopBridge.chooseBackup();
			if (!path) return;
			const checked = await desktopBridge.inspectBackup(path);
			setLastBackup({
				path,
				hash: '',
				byteLength: 0,
				entryCount: checked.entryCount
			});
			setInspection(checked);
			setMessage(checked.valid
				? '所选备份已通过完整性检查，可以安全恢复。'
				: '所选备份未通过完整性检查，已禁止恢复。');
		} catch {
			setInspection(undefined);
			setMessage('无法读取所选备份，请重新选择有效的 .wbbackup 文件。');
		} finally {
			actionGuardRef.current = false;
			setBusyAction(undefined);
		}
	};

	const restoreBackup = async () => {
		if (
			!snapshot
		|| !lastBackup
			|| !inspection?.valid
			|| busyAction
			|| actionGuardRef.current
			|| !window.confirm('恢复备份会替换当前项目副本中的文件。系统会先创建恢复前快照。确定继续吗？')
		) return;
		actionGuardRef.current = true;
		setBusyAction('restore');
		setMessage('');
		try {
			const restored = await desktopBridge.restoreBackup(
				lastBackup.path,
				snapshot.root,
				true
			);
			setMessage(`已从校验通过的备份恢复 ${restored} 个文件。`);
			await reloadProject();
		} catch {
			setMessage('备份恢复失败，恢复前快照仍然保留。请检查文件权限后重试。');
		} finally {
			actionGuardRef.current = false;
			setBusyAction(undefined);
		}
	};

	const isBusy = Boolean(busyAction);
	return (
		<div className={`project-backup-panel is-${density}`}>
			<div className="project-backup-heading">
				<span className="history-card-icon"><Archive size={22} /></span>
				<div>
					{density === 'card' && <span className="eyebrow">Portable backup</span>}
					<h2>项目便携备份</h2>
					<p>创建可校验的 .wbbackup；恢复前会再次检查，并保留恢复前快照。</p>
				</div>
			</div>
			<div className="project-backup-actions">
				<button
					className="secondary-button"
					type="button"
					data-testid="project-backup-action"
					data-backup-action="create"
					disabled={!snapshot || snapshot.readOnly || isBusy}
					onClick={() => void createBackup()}
				>
					<ShieldCheck size={18} />
					{busyAction === 'create' ? '正在创建…' : '创建备份'}
				</button>
				<button
					className="secondary-button"
					type="button"
					data-testid="project-backup-action"
					data-backup-action="choose"
					disabled={!snapshot || isBusy}
					onClick={() => void chooseBackup()}
				>
					<FolderOpen size={18} />
					{busyAction === 'choose' ? '正在检查…' : '选择已有备份'}
				</button>
				<button
					className="secondary-button"
					type="button"
					data-testid="project-backup-action"
					data-backup-action="restore"
					disabled={!snapshot || snapshot.readOnly || !inspection?.valid || isBusy}
					onClick={() => void restoreBackup()}
				>
					<RotateCcw size={18} />
					{busyAction === 'restore' ? '正在恢复…' : '恢复所选备份'}
				</button>
			</div>
			<div className="project-backup-status" aria-live="polite">
				{lastBackup && <code title={lastBackup.path}>{lastBackup.path}</code>}
				{message && <p className={inspection && !inspection.valid ? 'error-message' : ''}>{message}</p>}
				{inspection && (
					<span className={inspection.valid ? 'is-valid' : 'is-invalid'}>
						{inspection.valid ? <CheckCircle2 size={16} /> : <Archive size={16} />}
						{inspection.valid
							? `格式 v${inspection.formatVersion} · ${inspection.entryCount} 个文件 · 校验通过`
							: `备份不可用：${inspection.issues.join('、')}`}
					</span>
				)}
			</div>
		</div>
	);
}
