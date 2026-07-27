import {
	AlertTriangle,
	BookOpen,
	Check,
	LoaderCircle,
	PackagePlus,
	Sparkles,
	WandSparkles,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	buildItemAnalysisMessages,
	parseItemAnalysisResponse,
	type AiJobState,
	type ItemAnalysisActionType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type Character,
	type ItemState,
	type Location,
	type StoryItem
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import {
	ItemAiReviewService,
	ItemStateFileStore,
	stageItemReviewBatch,
	type ItemReviewBatch,
	type ItemReviewFieldKey
} from './ItemAiReviewService';
import '../ai-context/AiReviewDrawer.css';

const actions: readonly {
	readonly id: ItemAnalysisActionType;
	readonly label: string;
	readonly selectedRequired: boolean;
	readonly instruction: string;
}[] = [{
	id: 'generate-item',
	label: '生成物品卡',
	selectedRequired: false,
	instruction: '生成具有明确外观、用途、限制、来源和叙事作用的完整物品候选。'
}, {
	id: 'generate-item-history',
	label: '生成历史',
	selectedRequired: true,
	instruction: '为当前物品生成可分别确认的获得、转移、使用、丢失或销毁事件。'
}, {
	id: 'extract-items',
	label: '从正文提取',
	selectedRequired: false,
	instruction: '只提取本章明确出现的物品、持有人、地点与流转，不推断未写出的事实。'
}];

const fieldLabels: Readonly<Record<ItemReviewFieldKey, string>> = {
	aliases: '别名',
	itemType: '物品类型',
	unique: '是否唯一',
	quantityUnit: '数量单位',
	description: '外观 / 来源 / 用途',
	restrictions: '限制',
	plotFunction: '叙事作用'
};

const stateLabels = {
	acquired: '获得',
	transferred: '转移',
	used: '使用',
	lost: '丢失',
	destroyed: '销毁',
	adjusted: '调整'
} as const;

function displayValue(value: unknown): string {
	if (Array.isArray(value)) return value.length ? value.join('、') : '无';
	if (value === null) return '不设置';
	if (typeof value === 'boolean') return value ? '唯一物品' : '可有多个';
	if (typeof value === 'string' || typeof value === 'number') return String(value);
	return JSON.stringify(value) ?? '';
}

function initialFieldSelection(batch: ItemReviewBatch): Readonly<Record<string, readonly string[]>> {
	return Object.fromEntries(batch.candidates.map(candidate => [
		candidate.id,
		candidate.fields.filter(field => field.selectedByDefault).map(field => field.id)
	]));
}

function initialStateSelection(batch: ItemReviewBatch): Readonly<Record<string, readonly string[]>> {
	return Object.fromEntries(batch.candidates.map(candidate => [
		candidate.id,
		candidate.states.filter(state => state.selectedByDefault).map(state => state.id)
	]));
}

export function ItemAiPanel(props: {
	readonly projectRoot: string;
	readonly chapters: readonly AiChapterSource[];
	readonly items: readonly StoryItem[];
	readonly states: readonly ItemState[];
	readonly characters: readonly Character[];
	readonly locations: readonly Location[];
	readonly selectedItem?: StoryItem;
	readonly readOnly?: boolean;
	readonly onClose: () => void;
	readonly onAccepted: (item: StoryItem, states: readonly ItemState[]) => void;
	readonly onOpenEvidence?: OpenAiEvidence;
}): React.JSX.Element {
	const [actionType, setActionType] = useState<ItemAnalysisActionType>(
		props.items.length ? 'extract-items' : 'generate-item'
	);
	const [chapterResourceId, setChapterResourceId] = useState(props.chapters[0]?.resourceId ?? '');
	const [instruction, setInstruction] = useState(
		actions.find(action => action.id === actionType)?.instruction ?? ''
	);
	const [batch, setBatch] = useState<ItemReviewBatch>();
	const [selectedFields, setSelectedFields] = useState<Readonly<Record<string, readonly string[]>>>({});
	const [selectedStates, setSelectedStates] = useState<Readonly<Record<string, readonly string[]>>>({});
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [activeJobId, setActiveJobId] = useState<string>();
	const [streamedLength, setStreamedLength] = useState(0);
	const [applyingId, setApplyingId] = useState<string>();
	const [notice, setNotice] = useState<string>();
	const [error, setError] = useState<string>();
	const action = actions.find(candidate => candidate.id === actionType)!;
	const chapter = props.chapters.find(source => source.resourceId === chapterResourceId);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const disabledReason = useMemo(() => {
		if (props.readOnly) return '项目当前为只读。';
		if (!chapter) return '请先在作品中创建至少一个章节。';
		if (action.selectedRequired && !props.selectedItem) return '请先选择一个物品。';
		if (!instruction.trim()) return '请输入作者指令。';
		return undefined;
	}, [action.selectedRequired, chapter, instruction, props.readOnly, props.selectedItem]);

	const selectAction = (next: ItemAnalysisActionType) => {
		setActionType(next);
		setInstruction(actions.find(candidate => candidate.id === next)?.instruction ?? '');
		setBatch(undefined);
		setNotice(undefined);
		setError(undefined);
	};

	const generate = async () => {
		if (!chapter || disabledReason || generating) return;
		setBatch(undefined);
		setError(undefined);
		setNotice(undefined);
		setStreamedLength(0);
		setJobState('created');
		try {
			const source = await desktopBridge.readText(props.projectRoot, chapter.path);
			const messages = buildItemAnalysisMessages({
				actionType,
				instruction,
				content: source.content,
				resourceId: chapter.resourceId,
				sourceRevision: source.hash,
				narrativeOrder: chapter.narrativeOrder,
				...(action.selectedRequired && props.selectedItem
					? { selectedItemId: props.selectedItem.id }
					: {}),
				existingItems: props.items.map(item => ({
					id: item.id,
					title: item.title,
					aliases: item.aliases,
					unique: item.unique,
					revision: item.revision
				})),
				characters: props.characters.map(character => ({
					id: character.id,
					title: character.title,
					revision: character.revision
				})),
				locations: props.locations.map(location => ({
					id: location.id,
					title: location.title,
					revision: location.revision
				}))
			});
			const result = await runGroundedJsonJob({
				jobType: 'item-analysis',
				messages,
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const next = stageItemReviewBatch({
				actionType,
				sourceResourceId: chapter.resourceId,
				sourceRevision: source.hash,
				sourceContent: source.content,
				narrativeOrder: chapter.narrativeOrder,
				items: props.items,
				states: props.states,
				characters: props.characters,
				locations: props.locations,
				responses: parseItemAnalysisResponse(
					result.output,
					actionType,
					new Set(props.characters.map(character => character.id)),
					new Set(props.locations.map(location => location.id))
				)
			});
			setBatch(next);
			setSelectedFields(initialFieldSelection(next));
			setSelectedStates(initialStateSelection(next));
			setJobState('completed');
			if (next.candidates.length === 0) setNotice('本章没有找到可确认的物品信息。');
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '物品候选生成失败。');
		}
	};

	const toggleSelection = (
		setter: typeof setSelectedFields,
		candidateId: string,
		id: string
	) => {
		setter(current => {
			const ids = current[candidateId] ?? [];
			return {
				...current,
				[candidateId]: ids.includes(id)
					? ids.filter(candidate => candidate !== id)
					: [...ids, id]
			};
		});
	};

	const apply = async (candidateId: string) => {
		if (!batch || !chapter || props.readOnly) return;
		setApplyingId(candidateId);
		setError(undefined);
		setNotice(undefined);
		try {
			const source = await desktopBridge.readText(props.projectRoot, chapter.path);
			const service = new ItemAiReviewService(
				new DesktopStoryRepository(props.projectRoot, desktopBridge),
				new ItemStateFileStore(props.projectRoot, desktopBridge),
				label => desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-item-review',
					label
				)
			);
			const result = await service.apply({
				batch,
				candidateId,
				selectedFieldIds: selectedFields[candidateId] ?? [],
				selectedStateIds: selectedStates[candidateId] ?? [],
				currentSourceRevision: source.hash,
				currentSourceContent: source.content
			});
			setBatch({
				...batch,
				candidates: batch.candidates.map(candidate => (
					candidate.id === candidateId ? result.candidate : candidate
				))
			});
			props.onAccepted(result.item, result.states);
			setNotice(`已创建安全快照，并保存“${result.item.title}”及所选流转事件。`);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '物品候选写入失败。');
		} finally {
			setApplyingId(undefined);
		}
	};

	return (
		<aside className="ai-review-drawer" aria-label="AI 物品助手">
			<header className="ai-review-drawer-header">
				<div>
					<span className="eyebrow">OWNERSHIP & NARRATIVE ASSET</span>
					<h2><PackagePlus size={20} />AI 物品助手</h2>
					<p>物品卡与流转事件分别确认；唯一物品冲突会阻止写入。</p>
				</div>
				<button type="button" className="ai-review-close" onClick={props.onClose} aria-label="关闭 AI 物品助手"><X size={18} /></button>
			</header>
			<div className="ai-review-scroll">
				<div className="ai-review-action-grid" role="tablist" aria-label="物品 AI 动作">
					{actions.map(candidate => (
						<button type="button" role="tab" aria-selected={candidate.id === actionType} className={candidate.id === actionType ? 'is-active' : ''} key={candidate.id} onClick={() => selectAction(candidate.id)}>{candidate.label}</button>
					))}
				</div>
				<section className="ai-review-source-card">
					<div><BookOpen size={17} /><strong>章节范围</strong></div>
					<select aria-label="选择物品分析章节" value={chapterResourceId} onChange={event => setChapterResourceId(event.target.value)}>
						{props.chapters.length === 0 ? <option value="">没有可用章节</option> : null}
						{props.chapters.map(source => <option key={source.resourceId} value={source.resourceId}>{source.title}</option>)}
					</select>
					<small>仅发送这一章；提取的卡片和事件都必须有精确证据。</small>
				</section>
				<label className="ai-review-instruction">
					<span>作者指令</span>
					<textarea value={instruction} maxLength={2_000} onChange={event => setInstruction(event.target.value)} />
				</label>
				{disabledReason ? <p className="ai-review-hint">{disabledReason}</p> : null}
				<div className="ai-review-run-row">
					<button type="button" className="ai-review-primary" disabled={Boolean(disabledReason) || generating} onClick={() => void generate()}>
						{generating ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}
						{generating ? `正在分析 · ${streamedLength} 字符` : '生成物品候选'}
					</button>
					{generating && activeJobId ? <button type="button" className="ai-review-secondary" onClick={() => void desktopBridge.cancelAiJob(activeJobId)}>取消</button> : null}
				</div>
				{error ? <p className="ai-review-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
				{notice ? <p className="ai-review-notice" role="status"><Check size={16} />{notice}</p> : null}
				{batch?.candidates.map((candidate, index) => (
					<article className={`ai-review-candidate is-${candidate.status}`} key={candidate.id}>
						<header>
							<div><span>物品候选 {index + 1}</span><h3>{candidate.title}</h3></div>
							<strong>{Math.round(candidate.confidence * 100)}%</strong>
						</header>
						<p>{candidate.rationale}</p>
						{candidate.matchedItemId ? <div className="ai-review-merge-note"><AlertTriangle size={15} />同名物品已存在，只合并勾选字段和事件。</div> : null}
						{candidate.duplicateCount ? <small>已合并 {candidate.duplicateCount} 个重复候选。</small> : null}
						<div className="ai-review-field-list">
							{candidate.fields.map(field => (
								<label className={`ai-review-field ${field.conflict ? 'has-conflict' : ''}`} key={field.id}>
									<input type="checkbox" disabled={field.blocking || candidate.status !== 'candidate'} checked={(selectedFields[candidate.id] ?? []).includes(field.id)} onChange={() => toggleSelection(setSelectedFields, candidate.id, field.id)} />
									<span><strong>{fieldLabels[field.key]}</strong><em>{displayValue(field.value)}</em>{field.conflict ? <small>{field.conflict}</small> : null}</span>
									{field.evidence && props.onOpenEvidence ? <button type="button" onClick={event => { event.preventDefault(); props.onOpenEvidence?.(field.evidence!); }}><BookOpen size={14} />证据</button> : null}
								</label>
							))}
						</div>
						{candidate.states.length ? <h4 className="ai-review-subtitle">流转与状态候选</h4> : null}
						<div className="ai-review-field-list">
							{candidate.states.map(state => (
								<label className={`ai-review-field ${state.conflict ? 'has-conflict' : ''}`} key={state.id}>
									<input type="checkbox" disabled={state.blocking || candidate.status !== 'candidate'} checked={(selectedStates[candidate.id] ?? []).includes(state.id)} onChange={() => toggleSelection(setSelectedStates, candidate.id, state.id)} />
									<span>
										<strong>{stateLabels[state.action]} · {state.quantity}</strong>
										<em>{state.holderTitle ?? '无持有人'} · {state.locationTitle ?? '未指定地点'}{state.condition ? ` · ${state.condition}` : ''}</em>
										{state.conflict ? <small>{state.conflict}</small> : null}
									</span>
									{state.evidence && props.onOpenEvidence ? <button type="button" onClick={event => { event.preventDefault(); props.onOpenEvidence?.(state.evidence!); }}><BookOpen size={14} />证据</button> : null}
								</label>
							))}
						</div>
						<button type="button" className="ai-review-accept" disabled={candidate.status !== 'candidate' || applyingId === candidate.id || ((selectedFields[candidate.id] ?? []).length === 0 && (selectedStates[candidate.id] ?? []).length === 0)} onClick={() => void apply(candidate.id)}>
							{applyingId === candidate.id ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
							{candidate.matchedItemId ? '确认合并所选字段与事件' : '创建物品并写入所选内容'}
						</button>
					</article>
				))}
			</div>
		</aside>
	);
}
