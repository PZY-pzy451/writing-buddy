import {
	AlertTriangle,
	BookOpen,
	Check,
	LoaderCircle,
	Sparkles,
	UserRoundPlus,
	WandSparkles,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	buildCharacterAnalysisMessages,
	parseCharacterAnalysisResponse,
	type AiJobState,
	type CharacterAnalysisActionType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	characterRoleLabels,
	type Character,
	type StateRecord
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import {
	CharacterAiReviewService,
	CharacterStateFileStore,
	stageCharacterReviewBatch,
	type CharacterReviewBatch,
	type CharacterReviewFieldKey
} from './CharacterAiReviewService';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import '../ai-context/AiReviewDrawer.css';

const actions: readonly {
	readonly id: CharacterAnalysisActionType;
	readonly label: string;
	readonly selectedRequired: boolean;
	readonly instruction: string;
}[] = [{
	id: 'generate-character',
	label: '生成三个人物',
	selectedRequired: false,
	instruction: '根据所选章节的叙事气质，设计三个不同、可推动冲突的人物候选。'
}, {
	id: 'generate-background',
	label: '补全背景',
	selectedRequired: true,
	instruction: '为当前人物生成与已知正文一致的背景候选，不覆盖作者已经确认的字段。'
}, {
	id: 'generate-arc',
	label: '设计人物弧',
	selectedRequired: true,
	instruction: '为当前人物生成目标、欲望、恐惧与价值观候选，形成可审阅的人物弧。'
}, {
	id: 'generate-speech-style',
	label: '语言风格',
	selectedRequired: true,
	instruction: '为当前人物生成有辨识度、可执行的语言风格候选。'
}, {
	id: 'extract-from-chapter',
	label: '从正文提取',
	selectedRequired: false,
	instruction: '只提取本章明确出现的人物、别名、状态、知识和持有物，不推断未写出的事实。'
}];

const fieldLabels: Readonly<Record<CharacterReviewFieldKey, string>> = {
	role: '人物角色',
	aliases: '别名',
	summary: '人物摘要',
	pronouns: '称谓',
	birth: '出生信息',
	appearance: '外貌',
	occupation: '职业',
	goals: '目标',
	desires: '欲望',
	fears: '恐惧',
	values: '价值观',
	speechStyle: '语言风格',
	'state.location': '当前位置',
	'state.lifeStatus': '生命状态',
	'state.health': '健康状态',
	'state.emotion': '情绪',
	'state.currentGoal': '当前目标',
	'state.inventory': '持有物品',
	'state.knowledge': '已知信息',
	'state.misconception': '错误认知',
	'state.ability': '能力状态'
};

function displayFieldValue(key: CharacterReviewFieldKey, value: unknown): string {
	if (key === 'role' && typeof value === 'string') {
		return characterRoleLabels[value as keyof typeof characterRoleLabels] ?? value;
	}
	if (Array.isArray(value)) return value.join('、');
	if (value === null) return '无';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return `${value}`;
	return JSON.stringify(value) ?? '';
}

function initialFieldSelection(batch: CharacterReviewBatch): Readonly<Record<string, readonly string[]>> {
	return Object.fromEntries(batch.candidates.map(candidate => [
		candidate.id,
		candidate.fields.filter(field => field.selectedByDefault).map(field => field.id)
	]));
}

export interface CharacterAiPanelProps {
	readonly projectRoot: string;
	readonly chapters: readonly AiChapterSource[];
	readonly characters: readonly Character[];
	readonly states: readonly StateRecord[];
	readonly selectedCharacter?: Character;
	readonly readOnly?: boolean;
	readonly onClose: () => void;
	readonly onAccepted: (character: Character, states: readonly StateRecord[]) => void;
	readonly onOpenEvidence?: OpenAiEvidence;
}

export function CharacterAiPanel(props: CharacterAiPanelProps): React.JSX.Element {
	const [actionType, setActionType] = useState<CharacterAnalysisActionType>(
		props.characters.length ? 'extract-from-chapter' : 'generate-character'
	);
	const [chapterResourceId, setChapterResourceId] = useState(
		props.chapters[0]?.resourceId ?? ''
	);
	const [instruction, setInstruction] = useState(
		actions.find(action => action.id === actionType)?.instruction ?? ''
	);
	const [batch, setBatch] = useState<CharacterReviewBatch>();
	const [selectedFields, setSelectedFields] = useState<
		Readonly<Record<string, readonly string[]>>
	>({});
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [activeJobId, setActiveJobId] = useState<string>();
	const [streamedLength, setStreamedLength] = useState(0);
	const [applyingId, setApplyingId] = useState<string>();
	const [notice, setNotice] = useState<string>();
	const [error, setError] = useState<string>();
	const action = actions.find(candidate => candidate.id === actionType)!;
	const chapter = props.chapters.find(
		candidate => candidate.resourceId === chapterResourceId
	);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const disabledReason = useMemo(() => {
		if (props.readOnly) return '项目当前为只读。';
		if (!chapter) return '请先在作品中创建至少一个章节。';
		if (action.selectedRequired && !props.selectedCharacter) return '请先选择一个人物。';
		if (!instruction.trim()) return '请输入作者指令。';
		return undefined;
	}, [action.selectedRequired, chapter, instruction, props.readOnly, props.selectedCharacter]);

	const selectAction = (nextActionType: CharacterAnalysisActionType) => {
		setActionType(nextActionType);
		setInstruction(actions.find(candidate => candidate.id === nextActionType)?.instruction ?? '');
		setBatch(undefined);
		setNotice(undefined);
		setError(undefined);
	};

	const generate = async () => {
		if (!chapter || disabledReason || generating) return;
		setError(undefined);
		setNotice(undefined);
		setBatch(undefined);
		setStreamedLength(0);
		setJobState('created');
		try {
			const source = await desktopBridge.readText(props.projectRoot, chapter.path);
			const messages = buildCharacterAnalysisMessages({
				actionType,
				instruction,
				content: source.content,
				resourceId: chapter.resourceId,
				sourceRevision: source.hash,
				narrativeOrder: chapter.narrativeOrder,
				...(action.selectedRequired && props.selectedCharacter
					? { selectedCharacterId: props.selectedCharacter.id }
					: {}),
				existingCharacters: props.characters.map(character => ({
					id: character.id,
					title: character.title,
					aliases: character.aliases,
					revision: character.revision
				}))
			});
			const result = await runGroundedJsonJob({
				jobType: 'character-analysis',
				messages,
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const next = stageCharacterReviewBatch({
				actionType,
				sourceResourceId: chapter.resourceId,
				sourceRevision: source.hash,
				sourceContent: source.content,
				narrativeOrder: chapter.narrativeOrder,
				existingCharacters: props.characters,
				states: props.states,
				responses: parseCharacterAnalysisResponse(result.output, actionType)
			});
			setBatch(next);
			setSelectedFields(initialFieldSelection(next));
			setJobState('completed');
			if (next.candidates.length === 0) {
				setNotice('本章没有找到可确认的人物信息。');
			}
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '人物候选生成失败。');
		}
	};

	const toggleField = (candidateId: string, fieldId: string) => {
		setSelectedFields(current => {
			const currentIds = current[candidateId] ?? [];
			return {
				...current,
				[candidateId]: currentIds.includes(fieldId)
					? currentIds.filter(id => id !== fieldId)
					: [...currentIds, fieldId]
			};
		});
	};

	const apply = async (candidateId: string) => {
		if (!batch || !chapter || props.readOnly) return;
		setApplyingId(candidateId);
		setError(undefined);
		setNotice(undefined);
		try {
			const currentSource = await desktopBridge.readText(props.projectRoot, chapter.path);
			const service = new CharacterAiReviewService(
				new DesktopStoryRepository(props.projectRoot, desktopBridge),
				new CharacterStateFileStore(props.projectRoot, desktopBridge),
				label => desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-character-review',
					label
				)
			);
			const result = await service.apply({
				batch,
				candidateId,
				selectedFieldIds: selectedFields[candidateId] ?? [],
				currentSourceRevision: currentSource.hash,
				currentSourceContent: currentSource.content
			});
			setBatch({
				...batch,
				candidates: batch.candidates.map(candidate => (
					candidate.id === candidateId ? result.candidate : candidate
				))
			});
			props.onAccepted(result.character, result.states);
			setNotice(`已创建安全快照，并保存“${result.character.title}”的所选字段。`);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '人物字段写入失败。');
		} finally {
			setApplyingId(undefined);
		}
	};

	return (
		<aside className="ai-review-drawer" aria-label="AI 人物助手">
			<header className="ai-review-drawer-header">
				<div>
					<span className="eyebrow">AUTHOR CONTROLLED</span>
					<h2><UserRoundPlus size={20} />AI 人物助手</h2>
					<p>先生成候选，再逐字段确认；不会自动覆盖同名人物。</p>
				</div>
				<button type="button" className="ai-review-close" onClick={props.onClose} aria-label="关闭 AI 人物助手">
					<X size={18} />
				</button>
			</header>

			<div className="ai-review-scroll">
				<div className="ai-review-action-grid" role="tablist" aria-label="人物 AI 动作">
					{actions.map(candidate => (
						<button
							type="button"
							role="tab"
							aria-selected={candidate.id === actionType}
							className={candidate.id === actionType ? 'is-active' : ''}
							key={candidate.id}
							onClick={() => selectAction(candidate.id)}
						>{candidate.label}</button>
					))}
				</div>

				<section className="ai-review-source-card">
					<div><BookOpen size={18} /><strong>章节范围</strong></div>
					<select
						aria-label="选择人物分析章节"
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
					<small>仅发送这一章；接受后证据可回跳到原文。</small>
				</section>

				<label className="ai-review-instruction">
					<span>作者指令</span>
					<textarea
						value={instruction}
						maxLength={2_000}
						onChange={event => setInstruction(event.target.value)}
					/>
				</label>
				{disabledReason ? <p className="ai-review-hint">{disabledReason}</p> : null}
				<div className="ai-review-run-row">
					<button
						type="button"
						className="ai-review-primary"
						disabled={Boolean(disabledReason) || generating}
						onClick={() => void generate()}
					>
						{generating
							? <LoaderCircle className="spin" size={18} />
							: <WandSparkles size={18} />}
						{generating ? `正在分析 · ${streamedLength} 字符` : '生成候选'}
					</button>
					{generating && activeJobId ? (
						<button
							type="button"
							className="ai-review-secondary"
							onClick={() => void desktopBridge.cancelAiJob(activeJobId)}
						>取消</button>
					) : null}
				</div>

				{error ? <p className="ai-review-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
				{notice ? <p className="ai-review-notice" role="status"><Check size={16} />{notice}</p> : null}

				{batch?.candidates.map((candidate, index) => (
					<article className={`ai-review-candidate is-${candidate.status}`} key={candidate.id}>
						<header>
							<div>
								<span>候选 {index + 1}</span>
								<h3>{candidate.title}</h3>
							</div>
							<strong>{Math.round(candidate.confidence * 100)}%</strong>
						</header>
						<p>{candidate.rationale}</p>
						{candidate.matchedCharacterId ? (
							<div className="ai-review-merge-note">
								<AlertTriangle size={16} />同名或别名已存在，只会合并你勾选的字段。
							</div>
						) : null}
						{candidate.duplicateCount ? (
							<small>已合并 {candidate.duplicateCount} 个重复人物候选。</small>
						) : null}
						<div className="ai-review-field-list">
							{candidate.fields.map(field => (
								<label
									className={`ai-review-field ${field.conflict ? 'has-conflict' : ''}`}
									key={field.id}
								>
									<input
										type="checkbox"
										disabled={field.blocking || candidate.status !== 'candidate'}
										checked={(selectedFields[candidate.id] ?? []).includes(field.id)}
										onChange={() => toggleField(candidate.id, field.id)}
									/>
									<span>
										<strong>{fieldLabels[field.key]}</strong>
										<em>{displayFieldValue(field.key, field.value)}</em>
										{field.conflict ? <small>{field.conflict}</small> : null}
									</span>
									{field.evidence && props.onOpenEvidence ? (
										<button
											type="button"
											onClick={event => {
												event.preventDefault();
												props.onOpenEvidence?.(field.evidence!);
											}}
										><BookOpen size={16} />证据</button>
									) : null}
								</label>
							))}
						</div>
						<button
							type="button"
							className="ai-review-accept"
							disabled={
								candidate.status !== 'candidate'
								|| applyingId === candidate.id
								|| (selectedFields[candidate.id] ?? []).length === 0
							}
							onClick={() => void apply(candidate.id)}
						>
							{applyingId === candidate.id
								? <LoaderCircle className="spin" size={16} />
								: candidate.status === 'accepted'
									? <Check size={16} />
									: <Sparkles size={16} />}
							{candidate.status === 'accepted'
								? '已写入所选字段'
								: candidate.matchedCharacterId
									? '确认合并所选字段'
									: '创建人物并写入所选字段'}
						</button>
					</article>
				))}
			</div>
		</aside>
	);
}
