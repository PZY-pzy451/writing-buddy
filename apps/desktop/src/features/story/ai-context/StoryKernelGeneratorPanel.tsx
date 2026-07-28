import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	DatabaseZap,
	LoaderCircle,
	ShieldCheck,
	Sparkles,
	X
} from 'lucide-react';
import {
	buildStoryKernelGenerationMessages,
	nextAiJobState,
	storyKernelGenerationResourceTypes,
	type AiGenerateRequest,
	type AiJobState,
	type AiMessage,
	type AiStreamEvent,
	type StoryKernelGenerationResourceType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	toStoryChapterId,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import { useEffect, useMemo, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import {
	loadStoryKernelGenerationIdentities,
	StoryKernelGenerationService,
	StoryKernelGenerationStore,
	type StoryKernelGenerationBatch,
	type StoryKernelGenerationCandidate
} from './StoryKernelGenerationService';
import './StoryKernelGeneratorPanel.css';

const resourceTypeLabels: Readonly<Record<StoryKernelGenerationResourceType, string>> = {
	character: '人物',
	scene: '场景',
	location: '地点',
	faction: '势力',
	item: '物品',
	worldRule: '世界规则',
	timelineEvent: '时间线事件',
	relationship: '人物关系',
	plotThread: '剧情线',
	foreshadowing: '伏笔',
	information: '信息权限'
};

const defaultTargetTypes: readonly StoryKernelGenerationResourceType[] = [
	'character',
	'location',
	'item',
	'timelineEvent',
	'relationship',
	'plotThread',
	'information'
];

const terminalStates: readonly AiJobState[] = [
	'created',
	'completed',
	'cancelled',
	'failed'
];

export interface StoryKernelGeneratorPanelProps {
	readonly projectRoot: string;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly content: string;
	readonly readOnly?: boolean;
	readonly selection?: {
		readonly start: number;
		readonly end: number;
		readonly text: string;
	};
	readonly preset?: {
		readonly id: string;
		readonly instruction: string;
		readonly targetTypes: readonly StoryKernelGenerationResourceType[];
	};
	readonly repository?: StoryRepository;
	readonly store?: StoryKernelGenerationStore;
	readonly runGeneration?: (
		messages: readonly AiMessage[],
		onProgress: (state: AiJobState, output: string) => void
	) => Promise<string>;
	readonly createSafetySnapshot?: () => Promise<string>;
	readonly onCommitted?: (batch: StoryKernelGenerationBatch) => void;
}

function errorMessage(reason: unknown): string {
	const code = reason instanceof Error ? reason.message : String(reason);
	const messages: Readonly<Record<string, string>> = {
		authentication_failed: 'DeepSeek 尚未配置或密钥已失效，请先到设置页完成连接。',
		invalidStoryKernelGenerationSelection: '请至少选择一个可确认候选。',
		storyKernelGenerationCandidateBlocked: '所选候选包含阻断冲突，暂时不能写入。',
		storyKernelGenerationCreateCollision: '确认前资源已被创建，请重新生成或改为更新。',
		storyKernelGenerationRevisionConflict: '确认前资源已被修改，请重新生成后再确认。',
		storyKernelGenerationBatchNotFound: '候选批次已不存在，请重新生成。'
	};
	return messages[code] ?? code;
}

async function defaultRunGeneration(
	messages: readonly AiMessage[],
	onProgress: (state: AiJobState, output: string) => void,
	onJobId: (jobId: string | undefined) => void
): Promise<string> {
	const preferences = await desktopBridge.getAiPreferences();
	if (!preferences.defaultModelId) {
		throw new Error('DeepSeek 尚未选择可用模型，请先到设置页配置。');
	}
	const jobId = crypto.randomUUID();
	onJobId(jobId);
	const request: AiGenerateRequest = {
		jobId,
		jobType: 'story-kernel-generation',
		providerId: 'deepseek',
		modelId: preferences.defaultModelId,
		messages,
		options: {
			stream: true,
			thinkingMode: preferences.thinkingMode,
			reasoningEffort: preferences.thinkingMode === 'enabled' ? 'high' : undefined,
			maxOutputTokens: preferences.maxOutputTokens,
			responseFormat: 'json_object'
		}
	};
	return new Promise((resolve, reject) => {
		let state: AiJobState = 'created';
		let output = '';
		let settled = false;
		const settle = (value?: string, reason?: Error) => {
			if (settled) return;
			settled = true;
			onJobId(undefined);
			if (reason) reject(reason);
			else resolve(value ?? '');
		};
		const listener = (event: AiStreamEvent) => {
			if (settled || event.jobId !== jobId) return;
			try {
				state = nextAiJobState(state, event);
			} catch {
				return;
			}
			if (event.type === 'content_delta') output += event.text;
			onProgress(state, output);
			if (event.type === 'completed') settle(output);
			if (event.type === 'failed') settle(undefined, new Error(event.error.message));
			if (event.type === 'cancelled') settle(undefined, new Error('AI 生成已取消。'));
		};
		void desktopBridge.startAiGeneration(request, listener).catch(reason => {
			settle(undefined, reason instanceof Error ? reason : new Error('AI 生成失败。'));
		});
	});
}

function candidateIsConfirmable(candidate: StoryKernelGenerationCandidate): boolean {
	return candidate.status === 'pending'
		&& candidate.conflicts.length === 0
		&& candidate.normalizedResource !== undefined;
}

export function StoryKernelGeneratorPanel(
	props: StoryKernelGeneratorPanelProps
): React.JSX.Element {
	return (
		<StoryKernelGeneratorPanelContent
			key={`${props.projectRoot}:${props.resourceId}:${props.preset?.id ?? 'latest'}`}
			{...props}
		/>
	);
}

function StoryKernelGeneratorPanelContent(
	props: StoryKernelGeneratorPanelProps
): React.JSX.Element {
	const presetId = props.preset?.id;
	const repository = useMemo(
		() => props.repository
			?? new DesktopStoryRepository(props.projectRoot, desktopBridge),
		[props.projectRoot, props.repository]
	);
	const store = useMemo(
		() => props.store
			?? new StoryKernelGenerationStore(props.projectRoot, desktopBridge),
		[props.projectRoot, props.store]
	);
	const service = useMemo(
		() => new StoryKernelGenerationService(store, repository),
		[repository, store]
	);
	const [instruction, setInstruction] = useState(
		props.preset?.instruction
			?? '根据正文生成可确认的人物、地点、物品、事件、关系、剧情线和信息权限资源。'
	);
	const [targetTypes, setTargetTypes] = useState<readonly StoryKernelGenerationResourceType[]>(
		props.preset?.targetTypes ?? defaultTargetTypes
	);
	const [batch, setBatch] = useState<StoryKernelGenerationBatch>();
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [busyAction, setBusyAction] = useState<'confirm' | 'reject'>();
	const [error, setError] = useState('');
	const [activeJobId, setActiveJobId] = useState<string>();
	const generating = !terminalStates.includes(jobState);

	useEffect(() => {
		if (presetId) return;
		let cancelled = false;
		void store.load().then(batches => {
			if (cancelled) return;
			const latest = [...batches].reverse().find(
				item => item.sourceResourceId === toStoryChapterId(props.resourceId)
			);
			setBatch(latest);
			setSelectedIds(new Set(
				latest?.candidates.filter(candidateIsConfirmable).map(candidate => candidate.id)
			));
		}).catch(reason => {
			if (!cancelled) setError(errorMessage(reason));
		});
		return () => {
			cancelled = true;
		};
	}, [presetId, props.resourceId, store]);

	const toggleTargetType = (type: StoryKernelGenerationResourceType) => {
		setTargetTypes(current => current.includes(type)
			? current.filter(candidate => candidate !== type)
			: [...current, type]);
	};

	const generate = async () => {
		if (generating || !instruction.trim() || targetTypes.length === 0) return;
		const selectedSource = props.selection?.text
			? { content: props.selection.text, baseOffset: props.selection.start }
			: { content: props.content, baseOffset: 0 };
		setError('');
		setStreamedLength(0);
		setJobState('created');
		setBatch(undefined);
		try {
			const existingResources = await loadStoryKernelGenerationIdentities(repository);
			const messages = buildStoryKernelGenerationMessages({
				instruction,
				content: selectedSource.content,
				resourceId: toStoryChapterId(props.resourceId),
				sourceRevision: String(props.sourceRevision),
				targetTypes,
				existingResources
			});
			const output = props.runGeneration
				? await props.runGeneration(messages, (state, value) => {
					setJobState(state);
					setStreamedLength(value.length);
				})
				: await defaultRunGeneration(
					messages,
					(state, value) => {
						setJobState(state);
						setStreamedLength(value.length);
					},
					jobId => {
						setActiveJobId(jobId);
					}
				);
			const nextBatch = await service.stageFromResponse({
				instruction,
				sourceResourceId: toStoryChapterId(props.resourceId),
				sourceRevision: String(props.sourceRevision),
				content: selectedSource.content,
				baseOffset: selectedSource.baseOffset,
				targetTypes,
				response: output
			});
			setBatch(nextBatch);
			setSelectedIds(new Set(
				nextBatch.candidates.filter(candidateIsConfirmable).map(candidate => candidate.id)
			));
			setJobState('completed');
		} catch (reason) {
			setJobState('failed');
			setError(errorMessage(reason));
		}
	};

	const cancel = async () => {
		if (!activeJobId) return;
		await desktopBridge.cancelAiJob(activeJobId);
	};

	const confirmSelected = async () => {
		if (!batch || selectedIds.size === 0 || busyAction) return;
		setBusyAction('confirm');
		setError('');
		try {
			await (props.createSafetySnapshot
				? props.createSafetySnapshot()
				: desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-story-kernel-generation',
					'AI Story Kernel 生成前'
				));
			const confirmed = await service.confirm(batch.id, [...selectedIds]);
			setBatch(confirmed);
			setSelectedIds(new Set());
			props.onCommitted?.(confirmed);
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setBusyAction(undefined);
		}
	};

	const rejectCandidate = async (candidateId: string) => {
		if (!batch || busyAction) return;
		setBusyAction('reject');
		setError('');
		try {
			const updated = await service.reject(batch.id, candidateId);
			setBatch(updated);
			setSelectedIds(current => {
				const next = new Set(current);
				next.delete(candidateId);
				return next;
			});
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setBusyAction(undefined);
		}
	};

	return (
		<section className="kernel-generator" aria-label="AI Story Kernel 直接生成">
			<header className="kernel-generator-heading">
				<div>
					<span className="eyebrow">STORY KERNEL GENERATOR</span>
					<h3>直接生成故事内核</h3>
				</div>
				<span className="kernel-generator-safety"><ShieldCheck size={15} />确认后才写入</span>
			</header>

			<p className="kernel-generator-note">
				<DatabaseZap size={17} />
				{props.selection?.text
					? '仅使用当前选区生成；作者秘密不会加入发送上下文。'
					: '使用当前章节生成；作者秘密不会加入发送上下文。'}
			</p>

			<label className="kernel-generator-instruction">
				<span>生成要求</span>
				<textarea
					value={instruction}
					maxLength={2_000}
					disabled={generating || Boolean(busyAction)}
					onChange={event => setInstruction(event.target.value)}
				/>
			</label>

			<fieldset className="kernel-generator-types" disabled={generating || Boolean(busyAction)}>
				<legend>允许生成的资源类型</legend>
				<div>
					{storyKernelGenerationResourceTypes.map(type => (
						<label key={type}>
							<input
								type="checkbox"
								checked={targetTypes.includes(type)}
								onChange={() => toggleTargetType(type)}
							/>
							<span>{resourceTypeLabels[type]}</span>
						</label>
					))}
				</div>
			</fieldset>

			<div className="kernel-generator-primary-actions">
				<button
					className="primary-button"
					type="button"
					disabled={
						props.readOnly
						|| generating
						|| Boolean(busyAction)
						|| !props.content.trim()
						|| !instruction.trim()
						|| targetTypes.length === 0
					}
					onClick={() => void generate()}
				>
					{generating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
					{generating ? `DeepSeek 生成中 · ${streamedLength} 字符` : '生成 Story Kernel 候选'}
				</button>
				{generating && activeJobId ? (
					<button className="secondary-button" type="button" onClick={() => void cancel()}>
						<X size={16} />取消
					</button>
				) : null}
			</div>

			{props.readOnly ? (
				<p className="kernel-generator-error" role="status">
					<AlertTriangle size={16} />当前项目为只读模式，不能生成并写入 Story Kernel。
				</p>
			) : null}
			{error ? (
				<p className="kernel-generator-error" role="alert" aria-live="assertive">
					<AlertTriangle size={16} />{error}
				</p>
			) : null}

			{batch ? (
				<section className="kernel-candidates" aria-label="Story Kernel 候选">
					<header>
						<div>
							<strong>{batch.candidates.length} 个候选</strong>
							<span>{batch.candidates.filter(candidateIsConfirmable).length} 个可确认</span>
						</div>
						<button
							type="button"
							disabled={selectedIds.size === 0 || Boolean(busyAction)}
							onClick={() => void confirmSelected()}
						>
							{busyAction === 'confirm'
								? <LoaderCircle className="spin" size={16} />
								: <Check size={16} />}
							创建快照并确认 {selectedIds.size || ''}
						</button>
					</header>
					<div className="kernel-candidate-list">
						{batch.candidates.map(candidate => (
							<KernelCandidateCard
								key={candidate.id}
								candidate={candidate}
								selected={selectedIds.has(candidate.id)}
								busy={Boolean(busyAction)}
								onToggle={() => setSelectedIds(current => {
									const next = new Set(current);
									if (next.has(candidate.id)) next.delete(candidate.id);
									else next.add(candidate.id);
									return next;
								})}
								onReject={() => void rejectCandidate(candidate.id)}
							/>
						))}
					</div>
				</section>
			) : (
				<p className="kernel-generator-empty" aria-live="polite">
					AI 返回的数据会先进入候选区，校验通过并经你确认后才会原子写入。
				</p>
			)}
		</section>
	);
}

function KernelCandidateCard(props: {
	readonly candidate: StoryKernelGenerationCandidate;
	readonly selected: boolean;
	readonly busy: boolean;
	readonly onToggle: () => void;
	readonly onReject: () => void;
}): React.JSX.Element {
	const [expanded, setExpanded] = useState(false);
	const confirmable = candidateIsConfirmable(props.candidate);
	return (
		<article
			className="kernel-candidate-card"
			data-status={props.candidate.status}
			data-blocked={props.candidate.conflicts.length > 0 ? 'true' : 'false'}
		>
			<header>
				<label>
					<input
						type="checkbox"
						checked={props.selected}
						disabled={!confirmable || props.busy}
						onChange={props.onToggle}
						aria-label={`选择 ${props.candidate.title}`}
					/>
					<span>
						<strong>{props.candidate.title}</strong>
						<small>
							{resourceTypeLabels[props.candidate.resourceType]}
							{' · '}
							{props.candidate.operation === 'create' ? '新建' : '更新'}
							{' · '}
							{Math.round(props.candidate.confidence * 100)}%
						</small>
					</span>
				</label>
				<span className="kernel-candidate-status">
					{props.candidate.status === 'accepted'
						? '已写入'
						: props.candidate.status === 'rejected'
							? '已拒绝'
							: props.candidate.conflicts.length > 0
								? '需处理'
								: '待确认'}
				</span>
			</header>
			<p>{props.candidate.rationale}</p>
			{props.candidate.evidence ? (
				<blockquote>{props.candidate.evidence.quotePreview}</blockquote>
			) : (
				<small className="kernel-candidate-no-evidence">此候选未附正文证据，请重点人工核对。</small>
			)}
			{props.candidate.conflicts.length > 0 ? (
				<ul className="kernel-candidate-conflicts">
					{props.candidate.conflicts.map(item => (
						<li key={`${item.code}:${item.message}`}>
							<AlertTriangle size={14} />{item.message}
						</li>
					))}
				</ul>
			) : null}
			<div className="kernel-candidate-actions">
				<button type="button" onClick={() => setExpanded(value => !value)}>
					{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
					{expanded ? '收起结构' : '查看结构'}
				</button>
				{props.candidate.status === 'pending' ? (
					<button type="button" disabled={props.busy} onClick={props.onReject}>
						<X size={15} />拒绝
					</button>
				) : null}
			</div>
			{expanded ? (
				<pre tabIndex={0}>{JSON.stringify(
					props.candidate.normalizedResource ?? props.candidate.rawResource,
					null,
					2
				)}</pre>
			) : null}
		</article>
	);
}
