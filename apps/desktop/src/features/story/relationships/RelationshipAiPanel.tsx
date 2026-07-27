import {
	AlertTriangle,
	ArrowRight,
	BookOpen,
	Check,
	GitBranchPlus,
	LoaderCircle,
	Sparkles,
	WandSparkles,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	buildRelationshipAnalysisMessages,
	parseRelationshipAnalysisResponse,
	type AiJobState,
	type RelationshipAnalysisActionType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type Character,
	type Relationship
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import {
	RelationshipAiReviewService,
	stageRelationshipReviewBatch,
	type RelationshipReviewBatch
} from './RelationshipAiReviewService';
import '../ai-context/AiReviewDrawer.css';

const actionDefinitions: Readonly<Record<RelationshipAnalysisActionType, {
	readonly label: string;
	readonly instruction: string;
}>> = {
	'generate-relationship': {
		label: '生成双向关系',
		instruction: '为所选两个人物生成可不同的双向认知候选，明确各自关系类型、强度与可见性。'
	},
	'extract-relationship-changes': {
		label: '从正文分析变化',
		instruction: '只提取本章明确发生的人物关系变化，每条变化必须带原文证据。'
	}
};

const visibilityLabels: Readonly<Record<Relationship['visibility'], string>> = {
	public: '公开',
	private: '私下',
	secret: '秘密'
};

export interface RelationshipAiPanelProps {
	readonly projectRoot: string;
	readonly chapters: readonly AiChapterSource[];
	readonly characters: readonly Character[];
	readonly relationships: readonly Relationship[];
	readonly readOnly?: boolean;
	readonly selectedCandidateId?: string;
	readonly onClose: () => void;
	readonly onBatchChange: (batch?: RelationshipReviewBatch) => void;
	readonly onAccepted: (relationship: Relationship) => void;
	readonly onOpenEvidence?: OpenAiEvidence;
}

export function RelationshipAiPanel(props: RelationshipAiPanelProps): React.JSX.Element {
	const [actionType, setActionType] = useState<RelationshipAnalysisActionType>(
		'extract-relationship-changes'
	);
	const [chapterResourceId, setChapterResourceId] = useState(
		props.chapters[0]?.resourceId ?? ''
	);
	const [sourceCharacterId, setSourceCharacterId] = useState<string>(
		props.characters[0]?.id ?? ''
	);
	const [targetCharacterId, setTargetCharacterId] = useState<string>(
		props.characters.find(character => character.id !== sourceCharacterId)?.id ?? ''
	);
	const [instruction, setInstruction] = useState(
		actionDefinitions[actionType].instruction
	);
	const [batch, setBatch] = useState<RelationshipReviewBatch>();
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [activeJobId, setActiveJobId] = useState<string>();
	const [streamedLength, setStreamedLength] = useState(0);
	const [applyingId, setApplyingId] = useState<string>();
	const [notice, setNotice] = useState<string>();
	const [error, setError] = useState<string>();
	const chapter = props.chapters.find(
		candidate => candidate.resourceId === chapterResourceId
	);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const disabledReason = useMemo(() => {
		if (props.readOnly) return '项目当前为只读。';
		if (!chapter) return '请先在作品中创建至少一个章节。';
		if (props.characters.length < 2) return '至少需要两个人物才能分析关系。';
		if (
			actionType === 'generate-relationship'
			&& (
				!sourceCharacterId
				|| !targetCharacterId
				|| sourceCharacterId === targetCharacterId
			)
		) return '请选择两个不同的人物。';
		if (!instruction.trim()) return '请输入作者指令。';
		return undefined;
	}, [
		actionType,
		chapter,
		instruction,
		props.characters.length,
		props.readOnly,
		sourceCharacterId,
		targetCharacterId
	]);

	const selectAction = (nextActionType: RelationshipAnalysisActionType) => {
		setActionType(nextActionType);
		setInstruction(actionDefinitions[nextActionType].instruction);
		setBatch(undefined);
		props.onBatchChange(undefined);
		setError(undefined);
		setNotice(undefined);
	};

	const generate = async () => {
		if (!chapter || disabledReason || generating) return;
		setBatch(undefined);
		props.onBatchChange(undefined);
		setError(undefined);
		setNotice(undefined);
		setStreamedLength(0);
		setJobState('created');
		try {
			const source = await desktopBridge.readText(props.projectRoot, chapter.path);
			const messages = buildRelationshipAnalysisMessages({
				actionType,
				instruction,
				content: source.content,
				resourceId: chapter.resourceId,
				sourceRevision: source.hash,
				narrativeOrder: chapter.narrativeOrder,
				...(actionType === 'generate-relationship'
					? { sourceCharacterId, targetCharacterId }
					: {}),
				characters: props.characters.map(character => ({
					id: character.id,
					title: character.title,
					aliases: character.aliases,
					revision: character.revision
				})),
				existingRelationships: props.relationships.map(relationship => ({
					id: relationship.id,
					sourceCharacterId: relationship.sourceCharacterId,
					targetCharacterId: relationship.targetCharacterId,
					relationshipType: relationship.relationshipType,
					revision: relationship.revision
				}))
			});
			const result = await runGroundedJsonJob({
				jobType: 'relationship-analysis',
				messages,
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const responses = parseRelationshipAnalysisResponse(
				result.output,
				actionType,
				new Set(props.characters.map(character => character.id))
			);
			const next = stageRelationshipReviewBatch({
				actionType,
				sourceResourceId: chapter.resourceId,
				sourceRevision: source.hash,
				sourceContent: source.content,
				narrativeOrder: chapter.narrativeOrder,
				characters: props.characters,
				relationships: props.relationships,
				responses
			});
			setBatch(next);
			props.onBatchChange(next);
			setJobState('completed');
			if (next.candidates.length === 0) {
				setNotice('本章没有找到可确认的关系变化。');
			}
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '关系候选生成失败。');
		}
	};

	const apply = async (candidateId: string) => {
		if (!batch || !chapter || props.readOnly) return;
		setApplyingId(candidateId);
		setError(undefined);
		setNotice(undefined);
		try {
			const currentSource = await desktopBridge.readText(props.projectRoot, chapter.path);
			const service = new RelationshipAiReviewService(
				new DesktopStoryRepository(props.projectRoot, desktopBridge),
				label => desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-relationship-review',
					label
				)
			);
			const result = await service.apply({
				batch,
				candidateId,
				currentSourceRevision: currentSource.hash,
				currentSourceContent: currentSource.content
			});
			const next = {
				...batch,
				candidates: batch.candidates.map(candidate => (
					candidate.id === candidateId ? result.candidate : candidate
				))
			};
			setBatch(next);
			props.onBatchChange(next);
			props.onAccepted(result.relationship);
			setNotice('已创建安全快照，候选边已进入正式关系图。');
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '关系候选写入失败。');
		} finally {
			setApplyingId(undefined);
		}
	};

	return (
		<aside className="ai-review-drawer" aria-label="AI 关系助手">
			<header className="ai-review-drawer-header">
				<div>
					<span className="eyebrow">DIRECTED RELATIONSHIPS</span>
					<h2><GitBranchPlus size={20} />AI 关系助手</h2>
					<p>虚线是待确认候选；双向认知可以分别生成和接受。</p>
				</div>
				<button type="button" className="ai-review-close" onClick={props.onClose} aria-label="关闭 AI 关系助手">
					<X size={18} />
				</button>
			</header>

			<div className="ai-review-scroll">
				<div className="ai-review-action-grid" role="tablist" aria-label="关系 AI 动作">
					{(Object.entries(actionDefinitions) as [
						RelationshipAnalysisActionType,
						typeof actionDefinitions[RelationshipAnalysisActionType]
					][]).map(([id, definition]) => (
						<button
							type="button"
							role="tab"
							aria-selected={id === actionType}
							className={id === actionType ? 'is-active' : ''}
							key={id}
							onClick={() => selectAction(id)}
						>{definition.label}</button>
					))}
				</div>

				<section className="ai-review-source-card">
					<div><BookOpen size={17} /><strong>章节范围</strong></div>
					<select
						aria-label="选择关系分析章节"
						value={chapterResourceId}
						onChange={event => setChapterResourceId(event.target.value)}
					>
						{props.chapters.length === 0 ? <option value="">没有可用章节</option> : null}
						{props.chapters.map(source => (
							<option key={source.resourceId} value={source.resourceId}>
								{source.title}
							</option>
						))}
					</select>
					<small>仅发送这一章；正文分析要求每条边都有精确证据。</small>
				</section>

				{actionType === 'generate-relationship' ? (
					<div className="ai-review-character-pair">
						<label>
							<span>关系发起者</span>
							<select value={sourceCharacterId} onChange={event => setSourceCharacterId(event.target.value)}>
								{props.characters.map(character => <option key={character.id} value={character.id}>{character.title}</option>)}
							</select>
						</label>
						<ArrowRight size={17} />
						<label>
							<span>关系目标</span>
							<select value={targetCharacterId} onChange={event => setTargetCharacterId(event.target.value)}>
								{props.characters.map(character => <option key={character.id} value={character.id}>{character.title}</option>)}
							</select>
						</label>
					</div>
				) : null}

				<label className="ai-review-instruction">
					<span>作者指令</span>
					<textarea value={instruction} maxLength={2_000} onChange={event => setInstruction(event.target.value)} />
				</label>
				{disabledReason ? <p className="ai-review-hint">{disabledReason}</p> : null}
				<div className="ai-review-run-row">
					<button type="button" className="ai-review-primary" disabled={Boolean(disabledReason) || generating} onClick={() => void generate()}>
						{generating ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}
						{generating ? `正在分析 · ${streamedLength} 字符` : '生成关系候选'}
					</button>
					{generating && activeJobId ? (
						<button type="button" className="ai-review-secondary" onClick={() => void desktopBridge.cancelAiJob(activeJobId)}>取消</button>
					) : null}
				</div>

				{error ? <p className="ai-review-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
				{notice ? <p className="ai-review-notice" role="status"><Check size={16} />{notice}</p> : null}

				{batch?.candidates.map(candidate => (
					<article
						className={`ai-review-candidate ai-review-edge-card is-${candidate.status} ${props.selectedCandidateId === candidate.id ? 'is-selected' : ''}`}
						key={candidate.id}
					>
						<header>
							<div>
								<span>有向候选</span>
								<h3>{candidate.relationshipType}</h3>
							</div>
							<strong>{Math.round(candidate.confidence * 100)}%</strong>
						</header>
						<div className="ai-review-edge-route">
							<strong>{candidate.sourceTitle}</strong>
							<ArrowRight size={16} />
							<strong>{candidate.targetTitle}</strong>
						</div>
						<p>{candidate.description || candidate.rationale}</p>
						<small>强度 {Math.round(candidate.strength * 100)}% · {visibilityLabels[candidate.visibility]}</small>
						{candidate.conflict ? (
							<div className="ai-review-merge-note"><AlertTriangle size={15} />{candidate.conflict}</div>
						) : null}
						<div className="ai-review-run-row">
							{candidate.evidence && props.onOpenEvidence ? (
								<button type="button" className="ai-review-secondary" onClick={() => props.onOpenEvidence?.(candidate.evidence!)}>
									<BookOpen size={14} />查看证据
								</button>
							) : null}
							<button
								type="button"
								className="ai-review-accept"
								disabled={candidate.blocking || candidate.status !== 'candidate' || applyingId === candidate.id}
								onClick={() => void apply(candidate.id)}
							>
								{applyingId === candidate.id
									? <LoaderCircle className="spin" size={16} />
									: candidate.status === 'accepted'
										? <Check size={16} />
										: <Sparkles size={16} />}
								{candidate.status === 'accepted' ? '已成为正式关系' : '接受这条边'}
							</button>
						</div>
					</article>
				))}
			</div>
		</aside>
	);
}
