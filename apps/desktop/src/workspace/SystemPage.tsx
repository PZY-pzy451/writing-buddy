import { Archive, FileSearch, History, ListChecks, Search } from 'lucide-react';
import type { VersionSummary } from '@writing-buddy/platform-ports';
import { useEffect, useState } from 'react';
import { useAppStore } from '../app/store';
import { desktopBridge } from '../platform/bridge';
import { SettingsPage } from '../settings/SettingsPage';

export function SystemPage(): React.JSX.Element | null {
	const mode = useAppStore(state => state.activeMode);
	const snapshot = useAppStore(state => state.snapshot);
	const issues = useAppStore(state => state.issues);
	const search = useAppStore(state => state.search);
	const openResource = useAppStore(state => state.openResource);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const reloadProject = useAppStore(state => state.reloadProject);
	const [versions, setVersions] = useState<readonly VersionSummary[]>([]);
	const [selectedVersion, setSelectedVersion] = useState<string>();
	const [versionText, setVersionText] = useState<string>();
	const [versionMessage, setVersionMessage] = useState('');

	useEffect(() => {
		if (mode === 'versions' && snapshot) {
			void desktopBridge.listVersions(snapshot.root).then(result => {
				setVersions(result);
				setSelectedVersion(current => current && result.some(version => version.id === current)
					? current
					: result[0]?.id);
			});
		}
	}, [mode, snapshot]);

	useEffect(() => {
		if (!snapshot || !selectedVersion || !activeResource?.path) {
			return;
		}
		void desktopBridge
			.readVersionText(snapshot.root, selectedVersion, activeResource.path)
			.then(result => setVersionText(result.content))
			.catch(() => setVersionText(undefined));
	}, [activeResource, selectedVersion, snapshot]);

	if (mode === 'settings') {
		return <SettingsPage />;
	}
	if (mode === 'works' || mode === 'references') {
		return null;
	}

	if (mode === 'search') {
		const chapters = snapshot?.project.volumes.flatMap(volume => volume.chapters) ?? [];
		const resources = snapshot?.resources ?? [];
		const normalized = search.trim().toLocaleLowerCase();
		const results = [
			...chapters.filter(chapter => !normalized || chapter.title.toLocaleLowerCase().includes(normalized)).map(chapter => ({
				id: chapter.id,
				type: 'chapter' as const,
				title: chapter.title,
				path: chapter.file
			})),
			...resources.filter(resource => !normalized || resource.title.toLocaleLowerCase().includes(normalized))
		];
		return (
			<div className="system-page search-page">
				<header><span className="eyebrow">Project Search</span><h1>搜索当前作品</h1><p>搜索章节标题和写作资料，不扫描项目外文件。</p></header>
				<div className="search-result-list">
					{results.map(result => (
						<button type="button" key={`${result.type}:${result.id}`} onClick={() => snapshot && void openResource({ ...result, projectId: snapshot.project.projectId })}>
							<FileSearch size={18} /><span><strong>{result.title}</strong><small>{result.path}</small></span>
						</button>
					))}
					{results.length === 0 && <div className="system-empty"><Search size={28} />没有找到匹配内容</div>}
				</div>
			</div>
		);
	}

	if (mode === 'review') {
		return (
			<div className="system-page">
				<header><span className="eyebrow">Local Review</span><h1>全书审校</h1><p>当前阶段只运行本地规则，正文不会离开设备。</p></header>
				<div className="metric-grid">
					<div><ListChecks size={22} /><strong>{issues.length}</strong><span>当前问题</span></div>
					<div><Archive size={22} /><strong>{issues.filter(issue => issue.status === 'accepted').length}</strong><span>已接受</span></div>
				</div>
			</div>
		);
	}

	const createSnapshot = async () => {
		if (!snapshot) {
			return;
		}
		await desktopBridge.createSnapshot(snapshot.root, 'manual', '手动快照');
		setVersionMessage('安全快照已创建。');
		const result = await desktopBridge.listVersions(snapshot.root);
		setVersions(result);
		setSelectedVersion(result[0]?.id);
	};

	const restoreSelected = async () => {
		if (!snapshot || !selectedVersion
			|| !window.confirm('恢复版本会替换当前项目副本中的受管资源。系统会先自动创建 .wbbackup。确定继续吗？')) {
			return;
		}
		const restored = await desktopBridge.restoreVersion(snapshot.root, selectedVersion);
		setVersionMessage(`已恢复 ${restored} 个受管资源。`);
		await reloadProject();
	};

	return (
		<div className="system-page versions-page">
			<header>
				<span className="eyebrow">Versions</span>
				<h1>版本与恢复</h1>
				<p>快照保存内容寻址副本；恢复前自动创建兼容的 .wbbackup。</p>
				<div className="page-actions">
					<button className="primary-button" type="button" onClick={() => void createSnapshot()} disabled={!snapshot || snapshot.readOnly}>创建安全快照</button>
					<button className="secondary-button" type="button" onClick={() => void restoreSelected()} disabled={!selectedVersion || snapshot?.readOnly}>恢复所选版本</button>
				</div>
				{versionMessage && <span className="success-message">{versionMessage}</span>}
			</header>
			{versions.length === 0 ? (
				<div className="system-empty"><History size={30} />创建第一个安全快照后，历史版本会显示在这里。</div>
			) : (
				<div className="version-workspace">
					<div className="version-list">
						{versions.map(version => (
							<button
								key={version.id}
								type="button"
								className={selectedVersion === version.id ? 'is-active' : ''}
								onClick={() => setSelectedVersion(version.id)}
							>
								<History size={17} />
								<span><strong>{version.label || '未命名快照'}</strong><small>{new Date(version.createdAt).toLocaleString()}</small></span>
							</button>
						))}
					</div>
					<div className="version-diff">
						<div><span>所选快照</span><pre>{versionText ?? '该快照不包含当前资源。'}</pre></div>
						<div><span>当前内容</span><pre>{session?.content ?? '请先打开一个章节或笔记进行对比。'}</pre></div>
					</div>
				</div>
			)}
		</div>
	);
}
