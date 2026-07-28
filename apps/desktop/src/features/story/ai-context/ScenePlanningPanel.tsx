import {
	AlertTriangle,
	Check,
	ClipboardCheck,
	ListChecks,
	Send,
	Sparkles,
	X
} from 'lucide-react';
import {
	buildScenePlanMessages,
	parseScenePlanResponse,
	type AiJobState,
	type ScenePlanActionType,
	type ScenePlanResponse
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	DeterministicContextPackBuilder,
	serializeContextPackForAi,
	toStoryChapterId,
	type ContextPack,
	type StoryScene
} from '@writing-buddy/story-kernel';
import { useEffect, useMemo, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import { ContextPackPreview } from './ContextPackPreview';
import { runGroundedJsonJob } from './GroundedAiRunner';
import {
	ScenePlanningService,
	createScenePlanCandidate,
	isScenePlanCandidateStale,
	type ScenePlanCandidate,
	type ScenePlanField
} from './ScenePlanningService';
import { loadGroundedContextCandidates } from './SelectionRewriteService';
import './AiActionPanels.css';

const contextBuilder = new DeterministicContextPackBuilder();
const actionInstructions: Readonly<Record<ScenePlanActionType, string>> = {
	'generate-goal': '根据当前场景正文生成清晰、可验证的场景目标，只提供作者可审阅的字段候选。',
	'generate-outline': '根据当前场景正文生成目标、冲突、转折与结果的场景细纲，并保持既有故事事实一致。',
	'extract-outline': '只从当前场景正文中提取已经发生的目标、冲突、转折与结果，不补写正文中没有的事实。',
	'generate-emotion-beats': '根据当前场景正文生成按推进顺序排列的情绪节拍，强度使用 0 到 1。'
};

const fieldLabels: Readonly<Record<ScenePlanField, string>> = {
	goal: '场景目标',
	conflict: '核心冲突',
	turn: '关键转折',
	outcome: '场景结果',
	emotionBeats: '情绪节拍'
};

export interface ScenePlanningPanelProps {
	readonly projectRoot: string;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly content: string;
	readonly cursorOffset: number;
	readonly actionType: ScenePlanActionType;
	readonly readOnly: boolean;
}

function responseFields(response: ScenePlanResponse): readonly ScenePlanField[] {
	const fields: ScenePlanField[] = [];
	if (response.goal) fields.push('goal');
	if (response.conflict) fields.push('conflict');
	if (response.turn) fields.push('turn');
	if (response.outcome) fields.push('outcome');
	if (response.emotionBeats?.length) fields.push('emotionBeats');
	return fields;
}

async function loadScenePlanningContext(props: Pick<
	ScenePlanningPanelProps,
	'projectRoot' | 'resourceId' | 'sourceRevision' | 'content' | 'cursorOffset' | 'actionType'
>): Promise<{
	readonly repository: DesktopStoryRepository;
	readonly scene: StoryScene;
	readonly sourceText: string;
	readonly pack: ContextPack;
}> {
	const repository = new DesktopStoryRepository(props.projectRoot, desktopBridge);
	const chapterId = toStoryChapterId(props.resourceId);
	const scenes = await repository.list<StoryScene>('scene');
	const scene = scenes.find(candidate => (
		candidate.chapterId === chapterId
		&& candidate.manuscriptRange.start <= props.cursorOffset
		&& props.cursorOffset <= candidate.manuscriptRange.end
	));
	if (!scene) {
		throw new Error('当前光标不在已建立的场景中。请先选中正文并建立场景。');
	}
	const sourceText = props.content.slice(
		scene.manuscriptRange.start,
		scene.manuscriptRange.end
	);
	if (!sourceText.trim()) {
		throw new Error('当前场景没有可用于规划的正文。');
	}
	const candidates = await loadGroundedContextCandidates({
		repository,
		chapterId,
		selectionStart: Math.max(
			scene.manuscriptRange.start,
			Math.min(props.cursorOffset, scene.manuscriptRange.end - 1)
		)
	});
	const pack = await contextBuilder.build({
		actionType: props.actionType,
		instruction: actionInstructions[props.actionType],
		sourceKind: 'scene-manuscript',
		sourceTitle: '当前场景正文',
		selection: {
			text: sourceText,
			resourceId: props.resourceId,
			revision: props.sourceRevision,
			start: scene.manuscriptRange.start,
			end: scene.manuscriptRange.end
		},
		candidates,
		budgetTokens: 4_096
	});
	return { repository, scene, sourceText, pack };
}

export function ScenePlanningPanel(props: ScenePlanningPanelProps): React.JSX.Element {
	const [pack, setPack] = useState<ContextPack>();
	const [repository, setRepository] = useState<DesktopStoryRepository>();
	const [scene, setScene] = useState<StoryScene>();
	const [sourceText, setSourceText] = useState('');
	const [candidate, setCandidate] = useState<ScenePlanCandidate>();
	const [selectedFields, setSelectedFields] = useState<readonly ScenePlanField[]>([]);
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [activeJobId, setActiveJobId] = useState<string>();
	const [savedSnapshot, setSavedSnapshot] = useState<string>();
	const [error, setError] = useState<string>();
	const {
		actionType,
		content,
		cursorOffset,
		projectRoot,
		resourceId,
		sourceRevision
	} = props;

	useEffect(() => {
		let cancelled = false;
		void loadScenePlanningContext({
			actionType,
			content,
			cursorOffset,
			projectRoot,
			resourceId,
			sourceRevision
		}).then(result => {
			if (cancelled) return;
			setPack(result.pack);
			setRepository(result.repository);
			setScene(result.scene);
			setSourceText(result.sourceText);
			setCandidate(undefined);
			setError(undefined);
		}).catch(reason => {
			if (!cancelled) {
				setError(reason instanceof Error ? reason.message : '无法构建场景规划上下文。');
			}
		});
		return () => {
			cancelled = true;
		};
	}, [actionType, content, cursorOffset, projectRoot, resourceId, sourceRevision]);

	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const packReady = pack?.source.resourceId === props.resourceId
		&& pack.source.revision === props.sourceRevision
		&& pack.actionType === props.actionType
		&& pack.source.start <= props.cursorOffset
		&& props.cursorOffset <= pack.source.end;
	const stale = useMemo(() => candidate && scene
		? isScenePlanCandidateStale(
			candidate,
			props.sourceRevision,
			props.content,
			scene
		)
		: false, [candidate, props.content, props.sourceRevision, scene]);

	const generate = async () => {
		if (!pack || !scene || generating || props.readOnly) return;
		setCandidate(undefined);
		setSavedSnapshot(undefined);
		setError(undefined);
		setJobState('created');
		setStreamedLength(0);
		try {
			const result = await runGroundedJsonJob({
				jobType: 'scene-plan-generation',
				messages: buildScenePlanMessages(serializeContextPackForAi(pack)),
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const response = parseScenePlanResponse(result.output);
			const next = createScenePlanCandidate({
				mode: props.actionType,
				resourceId: props.resourceId,
				sourceRevision: props.sourceRevision,
				sourceText,
				scene,
				response
			});
			setCandidate(next);
			setSelectedFields(responseFields(response));
			setJobState('completed');
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '细纲候选生成失败。');
		}
	};

	const toggleField = (field: ScenePlanField) => {
		setSelectedFields(current => current.includes(field)
			? current.filter(candidateField => candidateField !== field)
			: [...current, field]);
	};

	const apply = async () => {
		if (!candidate || !repository || !scene || props.readOnly) return;
		try {
			const service = new ScenePlanningService(repository, () => desktopBridge.createSnapshot(
				props.projectRoot,
				'ai-scene-plan',
				`AI 细纲 · ${scene.title}`
			));
			const saved = await service.apply(
				candidate,
				selectedFields,
				props.sourceRevision,
				props.content,
				scene
			);
			setScene(saved);
			setCandidate({ ...candidate, status: 'accepted' });
			setSavedSnapshot('已创建安全快照，并写入所选场景字段。');
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '无法写入场景细纲。');
		}
	};

	return (
		<section className="ai-action-panel scene-planning-panel" aria-label="场景细纲候选">
			<div className="ai-action-intro">
				<ListChecks size={18} />
				<div>
					<strong>{scene ? scene.title : '定位当前场景'}</strong>
					<span>逐字段审阅后才会写回 Story Scene；正文不会被修改</span>
				</div>
			</div>
			{pack && packReady
				? <ContextPackPreview pack={pack} onChange={setPack} />
				: <p className="ai-action-loading"><Sparkles size={16} />正在读取当前场景…</p>}
			{error ? <p className="ai-action-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
			<div className="ai-action-toolbar">
				<button
					className="primary-button"
					type="button"
					disabled={!packReady || !scene || generating || props.readOnly || candidate?.status === 'accepted'}
					onClick={() => void generate()}
				>
					{generating ? <Sparkles size={17} /> : <Send size={17} />}
					{generating ? `DeepSeek 生成中 · ${streamedLength} 字符` : '确认资料并生成细纲'}
				</button>
				{generating && activeJobId ? (
					<button
						className="secondary-button"
						type="button"
						onClick={() => void desktopBridge.cancelAiJob(activeJobId)}
					>
						<X size={16} />取消
					</button>
				) : null}
			</div>
			{candidate ? (
				<section className="scene-plan-candidate">
					<header>
						<div><span className="eyebrow">FIELD CANDIDATES</span><h3>选择要写入的字段</h3></div>
						<span>{selectedFields.length}/{responseFields(candidate.response).length}</span>
					</header>
					{stale ? (
						<p className="ai-action-stale">
							<AlertTriangle size={15} />正文或场景版本已变化，请重新生成。
						</p>
					) : null}
					<div className="scene-plan-fields">
						{responseFields(candidate.response).map(field => (
							<label className={selectedFields.includes(field) ? 'is-selected' : ''} key={field}>
								<input
									type="checkbox"
									checked={selectedFields.includes(field)}
									disabled={candidate.status !== 'candidate'}
									onChange={() => toggleField(field)}
								/>
								<span aria-hidden="true">{selectedFields.includes(field) ? <Check size={14} /> : null}</span>
								<div>
									<strong>{fieldLabels[field]}</strong>
									{field === 'emotionBeats' ? (
										<ol>
											{candidate.response.emotionBeats?.map(beat => (
												<li key={`${beat.label}:${beat.emotion}`}>
													<span>{beat.label}</span>
													{beat.emotion} · {Math.round(beat.intensity * 100)}%
												</li>
											))}
										</ol>
									) : <p>{candidate.response[field]}</p>}
								</div>
							</label>
						))}
					</div>
					<p className="ai-action-rationale">{candidate.response.rationale}</p>
					<div className="ai-action-toolbar">
						<button
							type="button"
							disabled={
								stale
								|| candidate.status !== 'candidate'
								|| selectedFields.length === 0
								|| props.readOnly
							}
							onClick={() => void apply()}
						>
							<ClipboardCheck size={16} />写入所选字段
						</button>
						{candidate.status === 'candidate' ? (
							<button
								className="ai-action-reject"
								type="button"
								onClick={() => setCandidate({ ...candidate, status: 'rejected' })}
							>
								<X size={15} />放弃候选
							</button>
						) : null}
					</div>
				</section>
			) : null}
			{savedSnapshot ? (
				<p className="ai-action-success" role="status">
					<ClipboardCheck size={16} />{savedSnapshot}
				</p>
			) : null}
		</section>
	);
}
