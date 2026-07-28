import {
	AlertTriangle,
	BookOpen,
	Check,
	Globe2,
	LoaderCircle,
	Sparkles,
	WandSparkles,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	buildWorldAnalysisMessages,
	parseWorldAnalysisResponse,
	type AiJobState,
	type WorldAnalysisActionType,
	type WorldAnalysisTargetType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type Faction,
	type Location,
	type WorldRule
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import {
	WorldAiReviewService,
	stageWorldReviewBatch,
	type WorldReviewBatch,
	type WorldReviewFieldKey,
	type WorldReviewResource
} from './WorldAiReviewService';
import '../ai-context/AiReviewDrawer.css';

const targetTypes: readonly {
	readonly id: WorldAnalysisTargetType;
	readonly label: string;
}[] = [
	{ id: 'location', label: '地点' },
	{ id: 'faction', label: '势力' },
	{ id: 'culture', label: '文化' },
	{ id: 'religion', label: '宗教' },
	{ id: 'technology', label: '科技' },
	{ id: 'magic', label: '魔法' },
	{ id: 'law', label: '法律' },
	{ id: 'world-rule', label: '通用规则' }
];

const fieldLabels: Readonly<Record<WorldReviewFieldKey, string>> = {
	aliases: '别名',
	summary: '摘要',
	locationType: '地点类型',
	parentLocationId: '上级地点',
	rules: '地点规则',
	ideology: '理念 / 纲领',
	goals: '当前目标',
	territoryLocationIds: '领地',
	category: '规则分类',
	statement: '规则陈述',
	scope: '适用范围',
	exceptions: '例外',
	consequences: '后果'
};

const kindLabels = {
	location: '地点',
	faction: '势力',
	worldRule: '世界规则'
} as const;

function displayValue(value: unknown): string {
	if (Array.isArray(value)) return value.length ? value.join('、') : '无';
	if (value === null) return '不设置';
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return JSON.stringify(value) ?? '';
}

function initialSelection(batch: WorldReviewBatch): Readonly<Record<string, readonly string[]>> {
	return Object.fromEntries(batch.candidates.map(candidate => [
		candidate.id,
		candidate.fields.filter(field => field.selectedByDefault).map(field => field.id)
	]));
}

export function WorldAiPanel(props: {
	readonly projectRoot: string;
	readonly chapters: readonly AiChapterSource[];
	readonly locations: readonly Location[];
	readonly factions: readonly Faction[];
	readonly rules: readonly WorldRule[];
	readonly readOnly?: boolean;
	readonly onClose: () => void;
	readonly onAccepted: (resource: WorldReviewResource) => void;
	readonly onOpenEvidence?: OpenAiEvidence;
}): React.JSX.Element {
	const [actionType, setActionType] = useState<WorldAnalysisActionType>('generate-world-entry');
	const [targetType, setTargetType] = useState<WorldAnalysisTargetType>('location');
	const [chapterResourceId, setChapterResourceId] = useState(props.chapters[0]?.resourceId ?? '');
	const [instruction, setInstruction] = useState('生成与当前作品气质一致、可长期维护的结构化世界资料。');
	const [batch, setBatch] = useState<WorldReviewBatch>();
	const [selectedFields, setSelectedFields] = useState<Readonly<Record<string, readonly string[]>>>({});
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [activeJobId, setActiveJobId] = useState<string>();
	const [streamedLength, setStreamedLength] = useState(0);
	const [applyingId, setApplyingId] = useState<string>();
	const [notice, setNotice] = useState<string>();
	const [error, setError] = useState<string>();
	const chapter = props.chapters.find(source => source.resourceId === chapterResourceId);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const disabledReason = useMemo(() => {
		if (props.readOnly) return '项目当前为只读。';
		if (!chapter) return '请先在作品中创建至少一个章节。';
		if (!instruction.trim()) return '请输入作者指令。';
		return undefined;
	}, [chapter, instruction, props.readOnly]);

	const selectAction = (action: WorldAnalysisActionType) => {
		setActionType(action);
		setInstruction(action === 'extract-worldbuilding'
			? '只提取本章明确出现的地点、组织、术语和规则，并拆成独立候选。'
			: '生成与当前作品气质一致、可长期维护的结构化世界资料。');
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
			const existingResources = [
				...props.locations.map(location => ({
					id: location.id,
					type: 'location' as const,
					title: location.title,
					aliases: location.aliases,
					revision: location.revision
				})),
				...props.factions.map(faction => ({
					id: faction.id,
					type: 'faction' as const,
					title: faction.title,
					aliases: faction.aliases,
					revision: faction.revision
				})),
				...props.rules.map(rule => ({
					id: rule.id,
					type: 'worldRule' as const,
					title: rule.title,
					aliases: rule.aliases,
					revision: rule.revision,
					category: rule.category,
					statement: rule.statement,
					...(rule.scope ? { scope: rule.scope } : {})
				}))
			];
			const messages = buildWorldAnalysisMessages({
				actionType,
				...(actionType === 'generate-world-entry' ? { targetType } : {}),
				instruction,
				content: source.content,
				resourceId: chapter.resourceId,
				sourceRevision: source.hash,
				narrativeOrder: chapter.narrativeOrder,
				existingResources
			});
			const result = await runGroundedJsonJob({
				jobType: 'world-analysis',
				messages,
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const next = stageWorldReviewBatch({
				actionType,
				sourceResourceId: chapter.resourceId,
				sourceRevision: source.hash,
				sourceContent: source.content,
				narrativeOrder: chapter.narrativeOrder,
				locations: props.locations,
				factions: props.factions,
				rules: props.rules,
				responses: parseWorldAnalysisResponse(
					result.output,
					actionType,
					actionType === 'generate-world-entry' ? targetType : undefined,
					new Set(existingResources.map(resource => resource.id))
				)
			});
			setBatch(next);
			setSelectedFields(initialSelection(next));
			setJobState('completed');
			if (next.candidates.length === 0) setNotice('本章没有找到可确认的世界资料。');
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '世界观候选生成失败。');
		}
	};

	const toggleField = (candidateId: string, fieldId: string) => {
		setSelectedFields(current => {
			const ids = current[candidateId] ?? [];
			return {
				...current,
				[candidateId]: ids.includes(fieldId)
					? ids.filter(id => id !== fieldId)
					: [...ids, fieldId]
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
			const service = new WorldAiReviewService(
				new DesktopStoryRepository(props.projectRoot, desktopBridge),
				label => desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-world-review',
					label
				)
			);
			const result = await service.apply({
				batch,
				candidateId,
				selectedFieldIds: selectedFields[candidateId] ?? [],
				currentSourceRevision: source.hash,
				currentSourceContent: source.content
			});
			setBatch({
				...batch,
				candidates: batch.candidates.map(candidate => (
					candidate.id === candidateId ? result.candidate : candidate
				))
			});
			props.onAccepted(result.resource);
			setNotice(`已创建安全快照，并保存“${result.resource.title}”的所选字段。`);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '世界观字段写入失败。');
		} finally {
			setApplyingId(undefined);
		}
	};

	return (
		<aside className="ai-review-drawer" aria-label="AI 世界观助手">
			<header className="ai-review-drawer-header">
				<div>
					<span className="eyebrow">STRUCTURED WORLD BIBLE</span>
					<h2><Globe2 size={20} />AI 世界观助手</h2>
					<p>类型决定字段结构；重复、冲突和规则例外都需作者确认。</p>
				</div>
				<button type="button" className="ai-review-close" onClick={props.onClose} aria-label="关闭 AI 世界观助手">
					<X size={18} />
				</button>
			</header>
			<div className="ai-review-scroll">
				<div className="ai-review-action-grid" role="tablist" aria-label="世界观 AI 动作">
					<button type="button" role="tab" aria-selected={actionType === 'generate-world-entry'} className={actionType === 'generate-world-entry' ? 'is-active' : ''} onClick={() => selectAction('generate-world-entry')}>快速创建</button>
					<button type="button" role="tab" aria-selected={actionType === 'extract-worldbuilding'} className={actionType === 'extract-worldbuilding' ? 'is-active' : ''} onClick={() => selectAction('extract-worldbuilding')}>从正文提取</button>
				</div>
				{actionType === 'generate-world-entry' ? (
					<label className="ai-review-option">
						<span>目标类型</span>
						<select aria-label="世界观目标类型" value={targetType} onChange={event => setTargetType(event.target.value as WorldAnalysisTargetType)}>
							{targetTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
						</select>
					</label>
				) : null}
				<section className="ai-review-source-card">
					<div><BookOpen size={18} /><strong>章节范围</strong></div>
					<select aria-label="选择世界观分析章节" value={chapterResourceId} onChange={event => setChapterResourceId(event.target.value)}>
						{props.chapters.length === 0 ? <option value="">没有可用章节</option> : null}
						{props.chapters.map(source => <option key={source.resourceId} value={source.resourceId}>{source.title}</option>)}
					</select>
					<small>仅发送这一章；正文提取要求每个条目都有精确证据。</small>
				</section>
				<label className="ai-review-instruction">
					<span>作者指令</span>
					<textarea value={instruction} maxLength={2_000} onChange={event => setInstruction(event.target.value)} />
				</label>
				{disabledReason ? <p className="ai-review-hint">{disabledReason}</p> : null}
				<div className="ai-review-run-row">
					<button type="button" className="ai-review-primary" disabled={Boolean(disabledReason) || generating} onClick={() => void generate()}>
						{generating ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}
						{generating ? `正在分析 · ${streamedLength} 字符` : '生成结构化候选'}
					</button>
					{generating && activeJobId ? <button type="button" className="ai-review-secondary" onClick={() => void desktopBridge.cancelAiJob(activeJobId)}>取消</button> : null}
				</div>
				{error ? <p className="ai-review-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
				{notice ? <p className="ai-review-notice" role="status"><Check size={16} />{notice}</p> : null}
				{batch?.candidates.map((candidate, index) => (
					<article className={`ai-review-candidate is-${candidate.status}`} key={candidate.id}>
						<header>
							<div><span>{kindLabels[candidate.kind]} · 候选 {index + 1}</span><h3>{candidate.title}</h3></div>
							<strong>{Math.round(candidate.confidence * 100)}%</strong>
						</header>
						<p>{candidate.rationale}</p>
						{candidate.matchedResourceId ? <div className="ai-review-merge-note"><AlertTriangle size={16} />同名资料已存在，只合并勾选字段。</div> : null}
						{candidate.conflicts.map(conflict => <div className="ai-review-merge-note" key={conflict}><AlertTriangle size={16} />{conflict}</div>)}
						{candidate.duplicateCount ? <small>已合并 {candidate.duplicateCount} 个重复候选。</small> : null}
						<div className="ai-review-field-list">
							{candidate.fields.map(field => (
								<label className={`ai-review-field ${field.conflict ? 'has-conflict' : ''}`} key={field.id}>
									<input type="checkbox" disabled={field.blocking || candidate.status !== 'candidate'} checked={(selectedFields[candidate.id] ?? []).includes(field.id)} onChange={() => toggleField(candidate.id, field.id)} />
									<span><strong>{fieldLabels[field.key]}</strong><em>{displayValue(field.value)}</em>{field.conflict ? <small>{field.conflict}</small> : null}</span>
									{field.evidence && props.onOpenEvidence ? <button type="button" onClick={event => { event.preventDefault(); props.onOpenEvidence?.(field.evidence!); }}><BookOpen size={16} />证据</button> : null}
								</label>
							))}
						</div>
						<button type="button" className="ai-review-accept" disabled={candidate.status !== 'candidate' || applyingId === candidate.id || (selectedFields[candidate.id] ?? []).length === 0} onClick={() => void apply(candidate.id)}>
							{applyingId === candidate.id ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
							{candidate.matchedResourceId ? '确认合并所选字段' : '创建资料并写入所选字段'}
						</button>
					</article>
				))}
			</div>
		</aside>
	);
}
