import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	BookOpenText,
	Check,
	GripVertical,
	LoaderCircle,
	Plus,
	RefreshCw,
	Sparkles,
	Trash2,
	X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	buildCreationJourneyMessages,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput
} from '@writing-buddy/ai';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { runGroundedJsonJob } from '../story/ai-context/GroundedAiRunner';
import {
	addStoryElement,
	advanceCreationJourney,
	confirmStoryCore,
	moveStoryElement,
	moveStoryOutlineNode,
	removeStoryElement,
	selectStoryDirections,
	serializeCreationJourneyState,
	setGeneratedStoryCore,
	setJourneyChapterProposals,
	setStoryDirections,
	setStoryOutline,
	updateJourneyChapterProposal,
	updateStoryCore,
	updateStoryDirection,
	updateStoryElement,
	updateStoryOutlineNode,
	type CreationJourneyStage,
	type CreationJourneyState,
	type StoryCore,
	type StoryElement
} from './CreationJourneyModel';
import {
	CreationJourneyStore,
	type LoadedCreationJourney
} from './CreationJourneyStore';

const stageOrder: readonly CreationJourneyStage[] = [
	'elements',
	'core',
	'directions',
	'outline',
	'chapters',
	'writing'
];

const stageCopy: Readonly<Record<CreationJourneyStage, {
	readonly short: string;
	readonly title: string;
	readonly description: string;
}>> = {
	elements: {
		short: '灵感',
		title: '先把脑中的碎片放下来',
		description: '记录 3–8 个要素。它们不需要完整，也不需要先分类成资料库。'
	},
	core: {
		short: '故事核心',
		title: '把碎片收束成一个故事核心',
		description: 'AI 只负责整理候选。每个字段都可以修改，确认权属于你。'
	},
	directions: {
		short: '故事方向',
		title: '比较三个真正不同的方向',
		description: '选择一个方向，或选择两个交给下一步合并。'
	},
	outline: {
		short: '故事总纲',
		title: '调整故事节点的顺序',
		description: '拖动节点，或使用上下移动按钮。总纲仍然是可编辑草稿。'
	},
	chapters: {
		short: '章节',
		title: '确认前三章怎样承接总纲',
		description: '确认后会一次性创建三章；任何一步失败都会回滚。'
	},
	writing: {
		short: '正文',
		title: '前三章已经准备好',
		description: '现在可以进入第一章，把计划变成真正的正文。'
	}
};

const elementCategories: readonly {
	readonly id: StoryElement['category'];
	readonly label: string;
}[] = [
	{ id: 'character', label: '人物' },
	{ id: 'place', label: '地点' },
	{ id: 'object', label: '物品' },
	{ id: 'event', label: '事件' },
	{ id: 'mood', label: '氛围' },
	{ id: 'theme', label: '主题' },
	{ id: 'question', label: '疑问' },
	{ id: 'other', label: '其他' }
];

const coreFields: readonly {
	readonly key: Exclude<keyof StoryCore, 'confirmedAt'>;
	readonly label: string;
	readonly placeholder: string;
	readonly multiline?: boolean;
}[] = [
	{ key: 'oneSentence', label: '一句话故事', placeholder: '谁必须做什么，否则会失去什么？', multiline: true },
	{ key: 'protagonist', label: '主角', placeholder: '主角是谁，现在处于什么状态？' },
	{ key: 'goal', label: '目标', placeholder: '主角真正想完成什么？' },
	{ key: 'obstacle', label: '核心阻力', placeholder: '什么持续阻止主角？', multiline: true },
	{ key: 'stakes', label: '失败代价', placeholder: '失败会失去什么？', multiline: true },
	{ key: 'mystery', label: '核心悬念', placeholder: '读者最想知道的答案是什么？', multiline: true },
	{ key: 'readerExperience', label: '读者体验', placeholder: '希望读者感到什么？' },
	{ key: 'endingDirection', label: '结局方向', placeholder: '故事最终倾向怎样的选择或代价？', multiline: true }
];

function coreForAi(core: StoryCore): Omit<StoryCore, 'confirmedAt'> {
	return {
		oneSentence: core.oneSentence,
		protagonist: core.protagonist,
		goal: core.goal,
		obstacle: core.obstacle,
		stakes: core.stakes,
		mystery: core.mystery,
		readerExperience: core.readerExperience,
		endingDirection: core.endingDirection
	};
}

function journeyId(prefix: 'journey-direction' | 'journey-outline' | 'journey-chapter'): string {
	return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

function journeyErrorCopy(error: unknown): string {
	const code = error instanceof Error ? error.message.split(':')[0] : '';
	const copy: Readonly<Record<string, string>> = {
		creationJourneyElementsIncomplete: '请先填写至少 3 个非空灵感要素。',
		creationJourneyCoreIncomplete: '故事核心还有空白字段，请补充或修改后再确认。',
		creationJourneyCoreConfirmationRequired: '请先确认故事核心。',
		creationJourneyDirectionDecisionRequired: '请先选择一个方向，或选择两个方向合并。',
		creationJourneyOutlineRequired: '故事总纲尚未准备好，不能拆分章节。',
		creationJourneyDirectionsInvalid: 'AI 返回的三个方向结构不完整，请重试。',
		creationJourneyOutlineInvalid: 'AI 返回的总纲结构不完整，请重试。',
		creationJourneyChaptersInvalid: 'AI 返回的章节结构不完整，请重试。',
		invalidCreationJourneyResponse: 'AI 返回的结构不符合创作旅程，请重试。',
		externalChange: '创作旅程已在其他窗口修改，请重新打开作品。',
		cancelled: '已取消本次 AI 请求，没有改动旅程。'
	};
	return copy[code] ?? (error instanceof Error ? error.message : '暂时无法完成这个操作。');
}

export function CreationJourneyPage(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const materialize = useAppStore(state => state.materializeCreationJourney);
	const openResource = useAppStore(state => state.openResource);
	const setMode = useAppStore(state => state.setMode);
	const [state, setState] = useState<CreationJourneyState>();
	const [hash, setHash] = useState('');
	const [status, setStatus] = useState('正在读取创作旅程…');
	const [error, setError] = useState<string>();
	const [busyOperation, setBusyOperation] = useState<CreationJourneyAiInput['operation']>();
	const [jobId, setJobId] = useState<string>();
	const [draggedOutlineIndex, setDraggedOutlineIndex] = useState<number>();
	const headingRef = useRef<HTMLHeadingElement>(null);
	const storeRef = useRef<CreationJourneyStore | undefined>(undefined);
	const loadedRef = useRef<LoadedCreationJourney | undefined>(undefined);
	const stateRef = useRef<CreationJourneyState | undefined>(undefined);
	const saveTimerRef = useRef<number | undefined>(undefined);
	const saveChainRef = useRef<Promise<void>>(Promise.resolve());

	useEffect(() => {
		if (!snapshot) return;
		let active = true;
		const store = new CreationJourneyStore(
			snapshot.root,
			snapshot.project.projectId,
			desktopBridge
		);
		storeRef.current = store;
		void store.load().then(loaded => {
			if (!active) return;
			loadedRef.current = loaded;
			stateRef.current = loaded.state;
			setState(loaded.state);
			setHash(loaded.hash);
			setStatus(loaded.hash ? '已从项目恢复' : '尚未写入 AI 内容');
			if (!loaded.hash && !snapshot.readOnly) {
				const initialize = store.save(loaded, loaded.state).then(saved => {
					if (!active) return;
					loadedRef.current = saved;
					setHash(saved.hash);
					setStatus('创作旅程已保存到项目');
				}).catch(reason => {
					if (!active) return;
					setError(journeyErrorCopy(reason));
					setStatus('创作旅程初始化保存失败');
				});
				saveChainRef.current = initialize.then(() => undefined);
			}
		}).catch(reason => {
			if (!active) return;
			setError(journeyErrorCopy(reason));
			setStatus('无法读取创作旅程');
		});
		return () => {
			active = false;
			window.clearTimeout(saveTimerRef.current);
		};
	}, [snapshot]);

	useEffect(() => {
		headingRef.current?.focus();
	}, [state?.stage]);

	const persistLatest = (): Promise<void> => {
		window.clearTimeout(saveTimerRef.current);
		const task = saveChainRef.current.then(async () => {
			const store = storeRef.current;
			const loaded = loadedRef.current;
			const latest = stateRef.current;
			if (!store || !loaded || !latest || latest.revision <= loaded.state.revision) return;
			setStatus('正在保存到项目…');
			try {
				const saved = await store.save(loaded, latest);
				loadedRef.current = saved;
				setHash(saved.hash);
				setStatus('已保存到项目');
				setError(undefined);
			} catch (reason) {
				setStatus('保存失败');
				setError(journeyErrorCopy(reason));
				throw reason;
			}
		});
		saveChainRef.current = task.catch(() => undefined);
		return task;
	};

	const applyState = (next: CreationJourneyState, immediate = false) => {
		stateRef.current = next;
		setState(next);
		setStatus('有尚未写入项目的更改');
		window.clearTimeout(saveTimerRef.current);
		if (immediate) {
			void persistLatest();
		} else {
			saveTimerRef.current = window.setTimeout(() => void persistLatest(), 320);
		}
	};

	const goToStage = (stage: CreationJourneyStage) => {
		if (!stateRef.current) return;
		try {
			applyState(advanceCreationJourney(stateRef.current, stage), true);
			setError(undefined);
		} catch (reason) {
			setError(journeyErrorCopy(reason));
		}
	};

	const runAi = async (operation: CreationJourneyAiInput['operation']) => {
		const current = stateRef.current;
		if (!current || busyOperation) return;
		setError(undefined);
		try {
			await persistLatest();
			const input: CreationJourneyAiInput = (() => {
				if (operation === 'organize-core') {
					return {
						schemaVersion: 1,
						operation,
						elements: current.elements.map(element => ({
							category: element.category,
							text: element.text.trim()
						}))
					};
				}
				const core = coreForAi(current.core);
				if (operation === 'generate-directions') {
					return { schemaVersion: 1, operation, core };
				}
				const selectedDirections = current.selectedDirectionIds.map(id => {
					const direction = current.directions.find(candidate => candidate.id === id);
					if (!direction) throw new Error('creationJourneyDirectionDecisionRequired');
					return {
						title: direction.title,
						premise: direction.premise,
						centralConflict: direction.centralConflict,
						endingPromise: direction.endingPromise,
						tone: direction.tone
					};
				});
				if (operation === 'generate-outline') {
					return { schemaVersion: 1, operation, core, selectedDirections };
				}
				return {
					schemaVersion: 1,
					operation,
					core,
					selectedDirections,
					outline: current.outline.map(node => ({
						title: node.title,
						summary: node.summary,
						purpose: node.purpose
					}))
				};
			})();
			const messages = buildCreationJourneyMessages(input);
			setBusyOperation(operation);
			setStatus('AI 正在生成候选，不会自动写入下一阶段…');
			const result = await runGroundedJsonJob({
				jobType: 'creation-journey',
				messages,
				onJobId: setJobId,
				onProgress: progress => {
					if (progress.state === 'thinking') setStatus('AI 正在思考当前这一步…');
					if (progress.state === 'streaming') setStatus('AI 正在返回结构化候选…');
				}
			});
			const response = parseCreationJourneyResponse(result.output);
			if (response.operation !== operation) {
				throw new Error('invalidCreationJourneyResponse');
			}
			const latest = stateRef.current;
			if (!latest) return;
			let next: CreationJourneyState;
			switch (response.operation) {
				case 'organize-core':
					next = setGeneratedStoryCore(latest, response.core);
					break;
				case 'generate-directions':
					next = setStoryDirections(latest, response.directions.map(direction => ({
						id: journeyId('journey-direction'),
						...direction
					})));
					break;
				case 'generate-outline':
					next = setStoryOutline(latest, response.nodes.map(node => ({
						id: journeyId('journey-outline'),
						...node
					})));
					break;
				case 'split-chapters':
					next = setJourneyChapterProposals(latest, response.chapters.map(chapter => {
						const sourceNodeIds = chapter.sourceNodeIndexes.map(index => latest.outline[index]?.id);
						if (sourceNodeIds.some(id => !id)) {
							throw new Error('invalidCreationJourneyResponse');
						}
						return {
							id: journeyId('journey-chapter'),
							title: chapter.title,
							goal: chapter.goal,
							summary: chapter.summary,
							sourceNodeIds
						};
					}));
					break;
			}
			applyState(next, true);
			setStatus('候选已加入旅程，请编辑并确认');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('本次候选未写入');
		} finally {
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const cancelAi = () => {
		if (jobId) void desktopBridge.cancelAiJob(jobId);
	};

	const createChapters = async () => {
		const current = stateRef.current;
		if (!current) return;
		setError(undefined);
		try {
			await persistLatest();
			const loaded = loadedRef.current;
			const latest = stateRef.current;
			if (!loaded || !latest) throw new Error('creationJourneyStateInvalid');
			setStatus('正在原子创建三章并验证…');
			const ok = await materialize(serializeCreationJourneyState(latest), loaded.hash);
			if (!ok) setStatus('章节未创建，项目保持原样');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('章节未创建，项目保持原样');
		}
	};

	if (!snapshot) {
		return <div className="creation-journey-loading">请先打开作品。</div>;
	}
	if (!state) {
		return (
			<div className="creation-journey-loading" role="status">
				<LoaderCircle className="spin" size={24} />
				<span>{error ?? status}</span>
			</div>
		);
	}

	const currentStageIndex = stageOrder.indexOf(state.stage);
	const incompleteElements = state.elements.some(element => !element.text.trim());
	const stale = state.stale.directions || state.stale.outline || state.stale.chapters;

	return (
		<section className="creation-journey" aria-labelledby="creation-journey-heading">
			<header className="creation-journey-header">
				<div>
					<span className="eyebrow">NOVEL CREATION JOURNEY</span>
					<h1>从几个想法，到可以写的第一章</h1>
					<p>一次只做一个决定。AI 提供小份候选，你负责修改、选择和确认。</p>
				</div>
				<div className="creation-journey-save" role="status" aria-live="polite">
					<span className={status.includes('失败') ? 'is-error' : ''}>
						{status}
					</span>
					{hash && <small>项目内保存</small>}
				</div>
			</header>

			<nav className="creation-journey-progress" aria-label="创作旅程阶段">
				{stageOrder.map((stage, index) => (
					<button
						type="button"
						key={stage}
						className={[
							stage === state.stage ? 'is-current' : '',
							index < currentStageIndex ? 'is-complete' : ''
						].filter(Boolean).join(' ')}
						aria-current={stage === state.stage ? 'step' : undefined}
						disabled={index > currentStageIndex}
						onClick={() => goToStage(stage)}
					>
						<span>{index < currentStageIndex ? <Check size={16} /> : index + 1}</span>
						<strong>{stageCopy[stage].short}</strong>
					</button>
				))}
			</nav>

			<div className="creation-journey-body">
				<div className="creation-stage-heading">
					<span className="eyebrow">第 {currentStageIndex + 1} 步，共 6 步</span>
					<h2 id="creation-journey-heading" ref={headingRef} tabIndex={-1}>
						{stageCopy[state.stage].title}
					</h2>
					<p>{stageCopy[state.stage].description}</p>
				</div>

				{error && (
					<div className="creation-journey-error" role="alert">
						<AlertTriangle size={18} />
						<span>{error}</span>
						<button type="button" aria-label="关闭错误" onClick={() => setError(undefined)}>
							<X size={16} />
						</button>
					</div>
				)}

				{stale && (
					<div className="creation-journey-stale" role="note">
						<RefreshCw size={18} />
						<span>
							<strong>上游内容已经修改</strong>
							<small>已有下游草稿仍被保留，但需要重新生成或确认后才能创建章节。</small>
						</span>
					</div>
				)}

				{state.stage === 'elements' && (
					<div className="creation-elements-stage">
						<div className="creation-element-list">
							{state.elements.map((element, index) => (
								<article className="creation-element-card" key={element.id}>
									<div className="creation-element-order">
										<GripVertical size={18} aria-hidden="true" />
										<span>{index + 1}</span>
									</div>
									<label>
										<span className="sr-only">要素类型</span>
										<select
											value={element.category}
											onChange={event => applyState(updateStoryElement(
												state,
												element.id,
												{ category: event.target.value as StoryElement['category'] }
											))}
										>
											{elementCategories.map(category => (
												<option key={category.id} value={category.id}>{category.label}</option>
											))}
										</select>
									</label>
									<label className="creation-element-text">
										<span className="sr-only">灵感要素 {index + 1}</span>
										<textarea
											value={element.text}
											maxLength={500}
											placeholder="例如：一个只在雨夜出现的旧车站"
											onChange={event => applyState(updateStoryElement(
												state,
												element.id,
												{ text: event.target.value }
											))}
											onBlur={() => void persistLatest()}
										/>
									</label>
									<div className="creation-reorder-actions">
										<button type="button" aria-label={`上移要素 ${index + 1}`} disabled={index === 0} onClick={() => applyState(moveStoryElement(state, index, index - 1), true)}>
											<ArrowUp size={16} />
										</button>
										<button type="button" aria-label={`下移要素 ${index + 1}`} disabled={index === state.elements.length - 1} onClick={() => applyState(moveStoryElement(state, index, index + 1), true)}>
											<ArrowDown size={16} />
										</button>
										<button type="button" aria-label={`删除要素 ${index + 1}`} disabled={state.elements.length <= 3} onClick={() => applyState(removeStoryElement(state, element.id), true)}>
											<Trash2 size={16} />
										</button>
									</div>
								</article>
							))}
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" disabled={state.elements.length >= 8} onClick={() => applyState(addStoryElement(state), true)}>
								<Plus size={18} />添加一个要素
							</button>
							<button className="primary-button" type="button" disabled={incompleteElements || Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('organize-core')}>
								{busyOperation === 'organize-core' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
								整理成故事核心
							</button>
						</div>
					</div>
				)}

				{state.stage === 'core' && (
					<div className="creation-core-stage">
						<div className="creation-ai-draft-label">
							<Sparkles size={18} />
							<span><strong>AI 整理候选</strong><small>以下内容尚未确认，可直接编辑。</small></span>
						</div>
						<div className="creation-core-grid">
							{coreFields.map(field => (
								<label key={field.key} className={field.multiline ? 'is-wide' : ''}>
									<span>{field.label}</span>
									{field.multiline ? (
										<textarea
											value={state.core[field.key]}
											maxLength={field.key === 'oneSentence' ? 2_000 : 1_000}
											placeholder={field.placeholder}
											onChange={event => applyState(updateStoryCore(state, {
												[field.key]: event.target.value
											}))}
											onBlur={() => void persistLatest()}
										/>
									) : (
										<input
											value={state.core[field.key]}
											maxLength={1_000}
											placeholder={field.placeholder}
											onChange={event => applyState(updateStoryCore(state, {
												[field.key]: event.target.value
											}))}
											onBlur={() => void persistLatest()}
										/>
									)}
								</label>
							))}
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" onClick={() => goToStage('elements')}>返回灵感</button>
							<button className="primary-button" type="button" disabled={snapshot.readOnly} onClick={() => {
								try {
									const confirmed = confirmStoryCore(state);
									applyState(advanceCreationJourney(confirmed, 'directions'), true);
								} catch (reason) {
									setError(journeyErrorCopy(reason));
								}
							}}>
								<Check size={18} />确认故事核心
							</button>
						</div>
					</div>
				)}

				{state.stage === 'directions' && (
					<div className="creation-directions-stage">
						{state.directions.length === 0 ? (
							<div className="creation-ai-empty">
								<Sparkles size={28} />
								<h3>故事核心已经由你确认</h3>
								<p>现在可以让 AI 只生成三个方向。点击前不会产生请求。</p>
								<button className="primary-button" type="button" disabled={Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('generate-directions')}>
									{busyOperation === 'generate-directions' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
									生成 3 个故事方向
								</button>
							</div>
						) : (
							<>
								<div className="creation-direction-grid">
									{state.directions.map((direction, index) => {
										const selected = state.selectedDirectionIds.includes(direction.id);
										const selectionFull = state.selectedDirectionIds.length >= 2 && !selected;
										return (
											<article className={selected ? 'creation-direction-card is-selected' : 'creation-direction-card'} key={direction.id}>
												<button
													type="button"
													className="creation-direction-select"
													aria-pressed={selected}
													disabled={selectionFull}
													onClick={() => {
														const ids = selected
															? state.selectedDirectionIds.length > 1
																? state.selectedDirectionIds.filter(id => id !== direction.id)
																: state.selectedDirectionIds
															: [...state.selectedDirectionIds, direction.id];
														try {
															applyState(selectStoryDirections(state, ids), true);
														} catch (reason) {
															setError(journeyErrorCopy(reason));
														}
													}}
												>
													<span>{selected ? <Check size={16} /> : index + 1}</span>
													<strong>{selected ? '已选择' : '选择此方向'}</strong>
												</button>
												<label><span>方向标题</span><input value={direction.title} maxLength={120} onChange={event => applyState(updateStoryDirection(state, direction.id, { title: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>故事前提</span><textarea value={direction.premise} maxLength={2_000} onChange={event => applyState(updateStoryDirection(state, direction.id, { premise: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>核心冲突</span><textarea value={direction.centralConflict} maxLength={2_000} onChange={event => applyState(updateStoryDirection(state, direction.id, { centralConflict: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>结局承诺</span><textarea value={direction.endingPromise} maxLength={2_000} onChange={event => applyState(updateStoryDirection(state, direction.id, { endingPromise: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>整体气质</span><input value={direction.tone} maxLength={500} onChange={event => applyState(updateStoryDirection(state, direction.id, { tone: event.target.value }))} onBlur={() => void persistLatest()} /></label>
											</article>
										);
									})}
								</div>
								<p className="creation-selection-hint">
									已选择 {state.selectedDirectionIds.length}/2 个方向
									{state.selectedDirectionIds.length === 2 ? '，下一步会合并两者。' : '。'}
								</p>
								<div className="creation-stage-actions">
									<button className="secondary-button" type="button" onClick={() => goToStage('core')}>返回故事核心</button>
									<button className="primary-button" type="button" disabled={state.selectedDirectionIds.length === 0 || Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('generate-outline')}>
										{busyOperation === 'generate-outline' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
										{state.selectedDirectionIds.length === 2 ? '合并并生成故事总纲' : '生成故事总纲'}
									</button>
								</div>
							</>
						)}
					</div>
				)}

				{state.stage === 'outline' && (
					<div className="creation-outline-stage">
						<div className="creation-outline-list">
							{state.outline.map((node, index) => (
								<article
									key={node.id}
									className={draggedOutlineIndex === index ? 'creation-outline-card is-dragging' : 'creation-outline-card'}
									draggable
									onDragStart={() => setDraggedOutlineIndex(index)}
									onDragEnd={() => setDraggedOutlineIndex(undefined)}
									onDragOver={event => event.preventDefault()}
									onDrop={() => {
										if (draggedOutlineIndex === undefined || draggedOutlineIndex === index) return;
										applyState(moveStoryOutlineNode(state, draggedOutlineIndex, index), true);
										setDraggedOutlineIndex(undefined);
									}}
								>
									<div className="creation-outline-order">
										<GripVertical size={18} aria-hidden="true" />
										<span>{index + 1}</span>
									</div>
									<div className="creation-outline-fields">
										<label><span>节点标题</span><input value={node.title} maxLength={120} onChange={event => applyState(updateStoryOutlineNode(state, node.id, { title: event.target.value }))} onBlur={() => void persistLatest()} /></label>
										<label><span>发生什么</span><textarea value={node.summary} maxLength={3_000} onChange={event => applyState(updateStoryOutlineNode(state, node.id, { summary: event.target.value }))} onBlur={() => void persistLatest()} /></label>
										<label><span>叙事作用</span><input value={node.purpose} maxLength={1_000} onChange={event => applyState(updateStoryOutlineNode(state, node.id, { purpose: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									</div>
									<div className="creation-reorder-actions">
										<button type="button" aria-label={`上移总纲节点 ${index + 1}`} disabled={index === 0} onClick={() => applyState(moveStoryOutlineNode(state, index, index - 1), true)}><ArrowUp size={16} /></button>
										<button type="button" aria-label={`下移总纲节点 ${index + 1}`} disabled={index === state.outline.length - 1} onClick={() => applyState(moveStoryOutlineNode(state, index, index + 1), true)}><ArrowDown size={16} /></button>
									</div>
								</article>
							))}
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" onClick={() => goToStage('directions')}>返回故事方向</button>
							<button className="primary-button" type="button" disabled={Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('split-chapters')}>
								{busyOperation === 'split-chapters' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
								拆分为 3 个开篇章节
							</button>
						</div>
					</div>
				)}

				{state.stage === 'chapters' && (
					<div className="creation-chapters-stage">
						<div className="creation-chapter-grid">
							{state.chapters.map((chapter, index) => (
								<article className="creation-chapter-card" key={chapter.id}>
									<span className="creation-chapter-number">第 {index + 1} 章</span>
									<label><span>章节标题</span><input value={chapter.title} maxLength={120} onChange={event => applyState(updateJourneyChapterProposal(state, chapter.id, { title: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									<label><span>本章目标</span><textarea value={chapter.goal} maxLength={1_000} onChange={event => applyState(updateJourneyChapterProposal(state, chapter.id, { goal: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									<label><span>章节摘要</span><textarea value={chapter.summary} maxLength={3_000} onChange={event => applyState(updateJourneyChapterProposal(state, chapter.id, { summary: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									<small>承接 {chapter.sourceNodeIds.length} 个总纲节点</small>
								</article>
							))}
						</div>
						<div className="creation-transaction-note">
							<Check size={18} />
							<span><strong>一次性安全创建</strong><small>三章、项目结构和旅程状态会一起验证；失败时全部恢复。</small></span>
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" onClick={() => goToStage('outline')}>返回故事总纲</button>
							<button className="primary-button" type="button" disabled={snapshot.readOnly || state.stale.chapters || state.chapters.some(chapter => !chapter.title.trim() || !chapter.goal.trim() || !chapter.summary.trim())} onClick={() => void createChapters()}>
								<BookOpenText size={18} />创建 3 章并进入第一章
							</button>
						</div>
					</div>
				)}

				{state.stage === 'writing' && (
					<div className="creation-writing-stage">
						<BookOpenText size={34} />
						<h3>你的前三章已经存在于项目中</h3>
						<p>创作旅程仍然保留，可以随时回来查看决定过程。</p>
						<button className="primary-button" type="button" onClick={() => {
							const firstId = state.chapters[0]?.resourceId;
							const first = snapshot.project.volumes
								.flatMap(volume => volume.chapters)
								.find(chapter => chapter.id === firstId);
							if (!first) return;
							setMode('works');
							void openResource({
								id: first.id,
								type: 'chapter',
								title: first.title,
								path: first.file,
								projectId: snapshot.project.projectId
							});
						}}>
							<BookOpenText size={18} />打开第一章
						</button>
					</div>
				)}

				{busyOperation && jobId && (
					<button className="creation-ai-cancel" type="button" onClick={cancelAi}>
						<X size={16} />取消本次 AI 请求
					</button>
				)}
			</div>
		</section>
	);
}
