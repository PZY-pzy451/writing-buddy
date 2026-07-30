import {
	ArrowDown,
	ArrowUp,
	Check,
	ChevronRight,
	CircleDot,
	FilePlus2,
	GripVertical,
	LockKeyhole,
	LockKeyholeOpen,
	RotateCcw,
	Save,
	Trash2
} from 'lucide-react';
import { useRef, useState } from 'react';
import {
	addStoryOutlineNode,
	moveStoryOutlineNode,
	removeStoryOutlineNode,
	restoreStructuredOutlineSnapshot,
	toggleJourneyLock,
	updateStoryOutlineNode,
	updateStoryOutlineRoot,
	type CreationJourneyState,
	type StoryOutlineNode,
	type StoryOutlineRootPatch
} from './CreationJourneyModel';

interface StructuredOutlineWorkspaceProps {
	readonly state: CreationJourneyState;
	readonly readOnly: boolean;
	readonly status: string;
	readonly onChange: (state: CreationJourneyState, immediate?: boolean) => void;
	readonly onSave: () => void | Promise<void>;
}

const rootFields: readonly {
	readonly key: keyof Pick<
		NonNullable<CreationJourneyState['storyOutline']>,
		| 'title'
		| 'genre'
		| 'premise'
		| 'themePromise'
		| 'protagonistGoal'
		| 'centralConflict'
		| 'stakes'
		| 'mysteryQuestion'
		| 'endingDirection'
	>;
	readonly label: string;
	readonly multiline?: boolean;
	readonly required?: boolean;
}[] = [
	{ key: 'title', label: '故事标题' },
	{ key: 'genre', label: '题材', required: true },
	{ key: 'premise', label: '故事前提', multiline: true },
	{ key: 'themePromise', label: '主题承诺', multiline: true },
	{ key: 'protagonistGoal', label: '主角目标', multiline: true },
	{ key: 'centralConflict', label: '核心冲突', multiline: true },
	{ key: 'stakes', label: '失败代价', multiline: true },
	{ key: 'mysteryQuestion', label: '悬念问题', multiline: true },
	{ key: 'endingDirection', label: '结局方向', multiline: true }
];

const nodeFields: readonly {
	readonly key: keyof Pick<
		StoryOutlineNode,
		'title' | 'summary' | 'goal' | 'conflict' | 'outcome' | 'hook' | 'povHint'
	>;
	readonly label: string;
	readonly maxLength: number;
	readonly multiline?: boolean;
}[] = [
	{ key: 'title', label: '节点标题', maxLength: 120 },
	{ key: 'summary', label: '一句话概要', maxLength: 3_000, multiline: true },
	{ key: 'goal', label: '节点目标', maxLength: 1_000, multiline: true },
	{ key: 'conflict', label: '核心冲突', maxLength: 2_000, multiline: true },
	{ key: 'outcome', label: '节点结果', maxLength: 2_000, multiline: true },
	{ key: 'hook', label: '结尾钩子', maxLength: 2_000, multiline: true },
	{ key: 'povHint', label: 'POV', maxLength: 500 }
];

function statusLabel(status: StoryOutlineNode['status']): string {
	const labels: Readonly<Record<NonNullable<StoryOutlineNode['status']>, string>> = {
		planned: '计划中',
		ready_to_write: '可开始写作',
		drafting: '写作中',
		drafted: '初稿完成',
		revising: '修订中',
		complete: '已完成'
	};
	return labels[status ?? 'planned'];
}

function outlineErrorCopy(reason: unknown): string {
	const code = reason instanceof Error ? reason.message : '';
	const messages: Readonly<Record<string, string>> = {
		creationJourneyTargetLocked: '这个节点已锁定。请先解除锁定，再修改顺序或内容。',
		creationJourneyOutlineMinimum: '故事大纲至少保留 5 个节点。',
		creationJourneyOutlineLimit: '故事大纲最多包含 8 个节点。',
		creationJourneyOutlineInUse: '这个节点已经被章节引用，不能在此阶段删除。',
		creationJourneyOutlineInvalid: '当前输入不符合大纲字段限制，请检查后再试。',
		creationJourneyOutlineUndoInvalid: '当前大纲已发生不兼容变化，无法撤销这一步。'
	};
	return messages[code] ?? '暂时无法完成这个大纲操作。';
}

export function StructuredOutlineWorkspace({
	state,
	readOnly,
	status,
	onChange,
	onSave
}: StructuredOutlineWorkspaceProps): React.JSX.Element {
	const root = state.storyOutline;
	const [selectedId, setSelectedId] = useState<string>();
	const [draggedId, setDraggedId] = useState<string>();
	const [history, setHistory] = useState<readonly CreationJourneyState[]>([]);
	const [localError, setLocalError] = useState<string>();
	const editSnapshotRef = useRef<{
		readonly key: string;
		readonly state: CreationJourneyState;
	} | undefined>(undefined);
	const selectedNode = state.outline.find(node => node.id === selectedId);

	if (!root) {
		return <div className="structured-outline-missing">尚未生成结构化大纲。</div>;
	}

	const remember = (snapshot: CreationJourneyState) => {
		setHistory(previous => [...previous.slice(-29), snapshot]);
	};

	const apply = (
		createNext: () => CreationJourneyState,
		options: { readonly immediate?: boolean; readonly remember?: boolean } = {}
	): CreationJourneyState | undefined => {
		try {
			const next = createNext();
			if (options.remember !== false) remember(state);
			onChange(next, options.immediate);
			setLocalError(undefined);
			return next;
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
			return undefined;
		}
	};

	const beginFieldEdit = (key: string) => {
		if (editSnapshotRef.current?.key === key) return;
		editSnapshotRef.current = { key, state };
	};

	const endFieldEdit = () => {
		const snapshot = editSnapshotRef.current;
		editSnapshotRef.current = undefined;
		if (snapshot && snapshot.state.revision !== state.revision) {
			remember(snapshot.state);
		}
	};

	const applyField = (key: string, createNext: () => CreationJourneyState) => {
		if (!editSnapshotRef.current) {
			editSnapshotRef.current = { key, state };
		}
		apply(createNext, { remember: false });
	};

	const moveNode = (nodeId: string, toIndex: number) => {
		const fromIndex = state.outline.findIndex(node => node.id === nodeId);
		if (fromIndex < 0 || fromIndex === toIndex) return;
		apply(
			() => moveStoryOutlineNode(state, fromIndex, toIndex),
			{ immediate: true }
		);
	};

	const undo = () => {
		const previous = history.at(-1);
		if (!previous) return;
		try {
			const restored = restoreStructuredOutlineSnapshot(state, previous);
			setHistory(items => items.slice(0, -1));
			onChange(restored, true);
			setLocalError(undefined);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		}
	};

	const lockedIds = new Set(state.locks.outlineNodeIds);

	return (
		<section className="structured-outline-workspace" aria-label="结构化大纲工作区">
			<header className="structured-outline-toolbar">
				<div>
					<span className="eyebrow">STRUCTURED OUTLINE</span>
					<h2 id="creation-journey-heading">{root.title ?? '未命名故事大纲'}</h2>
				</div>
				<div className="structured-outline-toolbar-actions">
					<button
						type="button"
						disabled={readOnly || state.outline.length >= 8}
						onClick={() => {
							const next = apply(
								() => addStoryOutlineNode(state),
								{ immediate: true }
							);
							const created = next?.outline.at(-1);
							if (created) setSelectedId(created.id);
						}}
					>
						<FilePlus2 size={18} />新增节点
					</button>
					<button
						type="button"
						aria-label="撤销大纲改动"
						disabled={readOnly || history.length === 0}
						onClick={undo}
					>
						<RotateCcw size={18} />撤销
					</button>
					<button
						type="button"
						className="primary-button"
						disabled={readOnly}
						onClick={() => void onSave()}
					>
						<Save size={18} />保存大纲
					</button>
				</div>
			</header>

			{localError && <div className="structured-outline-error" role="alert">{localError}</div>}

			<div className="structured-outline-grid">
				<nav className="structured-outline-tree" aria-label="故事结构树">
					<header>
						<strong>故事结构</strong>
						<small>{state.outline.length} 个故事节点</small>
					</header>
					<button
						type="button"
						className={!selectedNode ? 'is-selected' : ''}
						aria-label="选择故事总纲"
						onClick={() => setSelectedId(undefined)}
					>
						<CircleDot size={18} />
						<span>
							<strong>{root.title ?? '故事总纲'}</strong>
							<small>{root.genre}</small>
						</span>
						<ChevronRight size={16} />
					</button>
					<ol>
						{state.outline.map((node, index) => {
							const locked = lockedIds.has(node.id);
							return (
								<li key={node.id}>
									<button
										type="button"
										className={selectedId === node.id ? 'is-selected' : ''}
										aria-label={`选择${node.title || `未命名节点 ${index + 1}`}`}
										draggable={!readOnly && !locked}
										onClick={() => setSelectedId(node.id)}
										onDragStart={() => setDraggedId(node.id)}
										onDragEnd={() => setDraggedId(undefined)}
										onDragOver={event => event.preventDefault()}
										onDrop={() => {
											if (draggedId) moveNode(draggedId, index);
											setDraggedId(undefined);
										}}
									>
										<span className="structured-outline-tree-index">{index + 1}</span>
										<span>
											<strong>{node.title || '未命名节点'}</strong>
											<small>{statusLabel(node.status)}</small>
										</span>
										{locked
											? <LockKeyhole size={16} aria-label="已锁定" />
											: <GripVertical size={16} aria-hidden="true" />}
									</button>
								</li>
							);
						})}
					</ol>
				</nav>

				<main className="structured-outline-cards" aria-label="大纲卡片">
					<header>
						<div>
							<strong>故事节点</strong>
							<small>拖动卡片或使用方向按钮调整叙事顺序</small>
						</div>
						<span>{root.status === 'confirmed' ? <Check size={16} /> : <CircleDot size={16} />}{root.status === 'confirmed' ? '已确认' : '草稿'}</span>
					</header>
					<div className="structured-outline-card-list">
						{state.outline.map((node, index) => {
							const locked = lockedIds.has(node.id);
							const previousLocked = index > 0 && lockedIds.has(state.outline[index - 1].id);
							const nextLocked = (
								index < state.outline.length - 1
								&& lockedIds.has(state.outline[index + 1].id)
							);
							return (
								<article
									key={node.id}
									aria-label={`大纲卡片 ${index + 1} ${node.title || '未命名节点'}`}
									className={[
										'structured-outline-card',
										selectedId === node.id ? 'is-selected' : '',
										locked ? 'is-locked' : '',
										draggedId === node.id ? 'is-dragging' : ''
									].filter(Boolean).join(' ')}
									draggable={!readOnly && !locked}
									onClick={() => setSelectedId(node.id)}
									onDragStart={() => setDraggedId(node.id)}
									onDragEnd={() => setDraggedId(undefined)}
									onDragOver={event => event.preventDefault()}
									onDrop={() => {
										if (draggedId) moveNode(draggedId, index);
										setDraggedId(undefined);
									}}
								>
									<div className="structured-outline-card-order">
										<GripVertical size={18} aria-hidden="true" />
										<span>{index + 1}</span>
									</div>
									<div className="structured-outline-card-copy">
										<header>
											<strong data-testid="outline-card-title">
												{node.title || '未命名节点'}
											</strong>
											<span>{statusLabel(node.status)}</span>
											{locked && <LockKeyhole size={16} aria-label="已锁定" />}
										</header>
										<p>{node.summary || '尚未填写一句话概要。'}</p>
										<dl>
											<div><dt>目标</dt><dd>{node.goal || node.purpose || '待补充'}</dd></div>
											<div><dt>冲突</dt><dd>{node.conflict || '待补充'}</dd></div>
											<div><dt>结果</dt><dd>{node.outcome || '待补充'}</dd></div>
										</dl>
										{node.povHint && <small>POV · {node.povHint}</small>}
									</div>
									<div className="structured-outline-card-move">
										<button
											type="button"
											aria-label={`上移故事节点 ${index + 1}`}
											disabled={readOnly || locked || previousLocked || index === 0}
											onClick={event => {
												event.stopPropagation();
												moveNode(node.id, index - 1);
											}}
										>
											<ArrowUp size={18} />
										</button>
										<button
											type="button"
											aria-label={`下移故事节点 ${index + 1}`}
											disabled={
												readOnly
												|| locked
												|| nextLocked
												|| index === state.outline.length - 1
											}
											onClick={event => {
												event.stopPropagation();
												moveNode(node.id, index + 1);
											}}
										>
											<ArrowDown size={18} />
										</button>
									</div>
								</article>
							);
						})}
					</div>
				</main>

				<aside className="structured-outline-inspector" aria-label="当前节点详情">
					{!selectedNode ? (
						<>
							<header>
								<div>
									<span className="eyebrow">STORY ROOT</span>
									<strong>故事总纲</strong>
								</div>
								<span>版本 {root.revision}</span>
							</header>
							<div className="structured-outline-inspector-fields">
								{rootFields.map(field => {
									const value = root[field.key] ?? '';
									const common = {
										'aria-label': field.label,
										value,
										disabled: readOnly,
										maxLength: field.key === 'title' ? 160 : field.key === 'genre' ? 240 : 2_000,
										onFocus: () => beginFieldEdit(`root:${field.key}`),
										onBlur: endFieldEdit,
										onChange: (
											event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
										) => {
											const nextValue = event.target.value;
											const patch = {
												[field.key]: (
													field.required || nextValue.trim()
														? nextValue
														: undefined
												)
											} as StoryOutlineRootPatch;
											applyField(
												`root:${field.key}`,
												() => updateStoryOutlineRoot(state, patch)
											);
										}
									};
									return (
										<label key={field.key}>
											<span>{field.label}{field.required && <em>必填</em>}</span>
											{field.multiline
												? <textarea {...common} rows={3} />
												: <input {...common} />}
										</label>
									);
								})}
							</div>
						</>
					) : (
						<>
							<header>
								<div>
									<span className="eyebrow">STORY BEAT {selectedNode.order! + 1}</span>
									<strong>{selectedNode.title || '未命名节点'}</strong>
								</div>
								<span>版本 {selectedNode.revision ?? 1}</span>
							</header>
							<div className="structured-outline-inspector-actions">
								<button
									type="button"
									disabled={readOnly}
									onClick={() => apply(
										() => toggleJourneyLock(state, {
											kind: 'outline',
											id: selectedNode.id
										}, !lockedIds.has(selectedNode.id)),
										{ immediate: true }
									)}
								>
									{lockedIds.has(selectedNode.id)
										? <LockKeyholeOpen size={18} />
										: <LockKeyhole size={18} />}
									{lockedIds.has(selectedNode.id)
										? '解除节点锁定'
										: '锁定此节点'}
								</button>
								<button
									type="button"
									disabled={
										readOnly
										|| lockedIds.has(selectedNode.id)
										|| state.outline.length <= 5
									}
									onClick={() => {
										const removed = apply(
											() => removeStoryOutlineNode(state, selectedNode.id),
											{ immediate: true }
										);
										if (removed) setSelectedId(undefined);
									}}
								>
									<Trash2 size={18} />删除节点
								</button>
							</div>
							<div className="structured-outline-inspector-fields">
								{nodeFields.map(field => {
									const value = selectedNode[field.key] ?? '';
									const common = {
										'aria-label': field.label,
										value,
										disabled: readOnly || lockedIds.has(selectedNode.id),
										maxLength: field.maxLength,
										onFocus: () => beginFieldEdit(`node:${selectedNode.id}:${field.key}`),
										onBlur: endFieldEdit,
										onChange: (
											event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
										) => {
											const nextValue = event.target.value;
											const patch: Partial<Omit<StoryOutlineNode, 'id'>> = {
												[field.key]: nextValue,
												...(field.key === 'goal' && !selectedNode.purpose
													? { purpose: nextValue }
													: {})
											};
											applyField(
												`node:${selectedNode.id}:${field.key}`,
												() => updateStoryOutlineNode(
													state,
													selectedNode.id,
													patch
												)
											);
										}
									};
									return (
										<label key={field.key}>
											<span>{field.label}</span>
											{field.multiline
												? <textarea {...common} rows={3} />
												: <input {...common} />}
										</label>
									);
								})}
								<label>
									<span>状态</span>
									<select
										aria-label="节点状态"
										value={selectedNode.status ?? 'planned'}
										disabled={readOnly || lockedIds.has(selectedNode.id)}
										onChange={event => apply(
											() => updateStoryOutlineNode(state, selectedNode.id, {
												status: event.target.value as NonNullable<StoryOutlineNode['status']>
											}),
											{ immediate: true }
										)}
									>
										<option value="planned">计划中</option>
										<option value="ready_to_write">可开始写作</option>
										<option value="drafting">写作中</option>
										<option value="drafted">初稿完成</option>
										<option value="revising">修订中</option>
										<option value="complete">已完成</option>
									</select>
								</label>
							</div>
							<div className="structured-outline-associations">
								<strong>关联资料</strong>
								<p>人物、地点、剧情线与伏笔将在作者明确选择后显示；本阶段不会自动创建资料。</p>
								<div>
									<span>人物 {selectedNode.characterIds?.length ?? 0}</span>
									<span>剧情线 {selectedNode.plotThreadIds?.length ?? 0}</span>
									<span>伏笔 {selectedNode.foreshadowingIds?.length ?? 0}</span>
								</div>
							</div>
						</>
					)}
				</aside>
			</div>

			<footer className="structured-outline-status">
				<span>{status}</span>
				<span>{state.outline.length}/8 个节点 · 所有改动保存在当前项目</span>
			</footer>
		</section>
	);
}
