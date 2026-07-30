import type { ChapterStatus } from '@writing-buddy/domain';
import type {
	CreationJourneyAiInput,
	CreationJourneyAiResponse
} from '@writing-buddy/ai';
import type {
	CreationJourneyState,
	StoryOutlineNode
} from './CreationJourneyModel';

export type OutlineQualitySource = 'local' | 'ai';
export type OutlineQualitySeverity = 'suggestion' | 'warning' | 'error';

export type LocalOutlineQualityCode =
	| 'empty-title'
	| 'empty-summary'
	| 'duplicate-order'
	| 'orphan-node'
	| 'scene-without-chapter'
	| 'chapter-without-volume'
	| 'duplicate-id'
	| 'locked-node-modified'
	| 'chapter-manuscript-status-mismatch';

export type AiOutlineQualityCode =
	| 'unclear-protagonist-goal'
	| 'unclear-failure-stakes'
	| 'flat-conflict-escalation'
	| 'repetitive-consecutive-chapters'
	| 'unchanging-middle'
	| 'events-not-character-driven'
	| 'ending-does-not-answer-opening'
	| 'plot-thread-disappears'
	| 'foreshadowing-without-payoff';

export interface OutlineQualityEvidence {
	readonly nodeId: string;
	readonly field: string;
	readonly quote: string;
}

export interface OutlineQualityIssue {
	readonly id: string;
	readonly code: LocalOutlineQualityCode | AiOutlineQualityCode;
	readonly source: OutlineQualitySource;
	readonly severity: OutlineQualitySeverity;
	readonly title: string;
	readonly message: string;
	readonly nodeIds: readonly string[];
	readonly evidence: readonly OutlineQualityEvidence[];
	readonly impact: string;
	readonly suggestedAction: string;
}

export interface OutlineManuscriptState {
	readonly resourceId: string;
	readonly status?: ChapterStatus;
	readonly hasContent: boolean;
}

export interface LocalOutlineCheckContext {
	readonly baseline?: CreationJourneyState;
	readonly manuscripts?: readonly OutlineManuscriptState[];
}

export type OutlineSemanticCheckInput = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'check-outline-semantics' }
>;

export type OutlineSemanticCheckResponse = Extract<
	CreationJourneyAiResponse,
	{ readonly operation: 'check-outline-semantics' }
>;

export function createOutlineSemanticCheckInput(
	state: CreationJourneyState
): OutlineSemanticCheckInput {
	if (!state.storyOutline || state.outline.length === 0) {
		throw new Error('outlineSemanticCheckUnavailable');
	}
	const story = state.storyOutline;
	return {
		schemaVersion: 1,
		operation: 'check-outline-semantics',
		story: {
			genre: story.genre,
			premise: story.premise,
			...(story.themePromise ? { themePromise: story.themePromise } : {}),
			...(story.protagonistGoal ? { protagonistGoal: story.protagonistGoal } : {}),
			...(story.centralConflict ? { centralConflict: story.centralConflict } : {}),
			...(story.stakes ? { stakes: story.stakes } : {}),
			...(story.mysteryQuestion ? { mysteryQuestion: story.mysteryQuestion } : {}),
			...(story.endingDirection ? { endingDirection: story.endingDirection } : {})
		},
		nodes: state.outline.map(node => ({
			id: node.id,
			type: node.type ?? 'story_beat',
			...(node.parentId ? { parentId: node.parentId } : {}),
			...(node.order !== undefined ? { order: node.order } : {}),
			title: node.title,
			summary: node.summary,
			...(node.purpose ? { purpose: node.purpose } : {}),
			...(node.goal ? { goal: node.goal } : {}),
			...(node.conflict ? { conflict: node.conflict } : {}),
			...(node.outcome ? { outcome: node.outcome } : {}),
			...(node.hook ? { hook: node.hook } : {}),
			...(node.characterIds?.length ? { characterIds: [...node.characterIds] } : {}),
			...(node.plotThreadIds?.length ? { plotThreadIds: [...node.plotThreadIds] } : {}),
			...(node.foreshadowingIds?.length ? { foreshadowingIds: [...node.foreshadowingIds] } : {})
		}))
	};
}

export function outlineQualityIssuesFromAi(
	response: OutlineSemanticCheckResponse
): readonly OutlineQualityIssue[] {
	return response.issues.map((candidate, index) => ({
		id: `ai:${candidate.code}:${candidate.nodeIds.join(',')}:${index}`,
		code: candidate.code,
		source: 'ai',
		severity: candidate.severity,
		title: candidate.title,
		message: candidate.message,
		nodeIds: candidate.nodeIds,
		evidence: candidate.evidence,
		impact: candidate.impact,
		suggestedAction: candidate.suggestedAction
	}));
}

function nodeEvidence(
	node: StoryOutlineNode,
	field: keyof StoryOutlineNode,
	quote?: string
): OutlineQualityEvidence {
	return {
		nodeId: node.id,
		field,
		quote: quote ?? String(node[field] ?? '（空）')
	};
}

function issue(
	code: LocalOutlineQualityCode,
	severity: OutlineQualitySeverity,
	title: string,
	message: string,
	nodes: readonly StoryOutlineNode[],
	evidence: readonly OutlineQualityEvidence[],
	impact: string,
	suggestedAction: string,
	discriminator = ''
): OutlineQualityIssue {
	const nodeIds = [...new Set(nodes.map(node => node.id))];
	return {
		id: `local:${code}:${nodeIds.join(',')}:${discriminator}`,
		code,
		source: 'local',
		severity,
		title,
		message,
		nodeIds,
		evidence,
		impact,
		suggestedAction
	};
}

function lockedFingerprint(node: StoryOutlineNode): string {
	return JSON.stringify({
		title: node.title,
		summary: node.summary,
		purpose: node.purpose,
		type: node.type,
		parentId: node.parentId,
		order: node.order,
		goal: node.goal,
		conflict: node.conflict,
		outcome: node.outcome,
		hook: node.hook,
		povHint: node.povHint,
		locationHint: node.locationHint,
		characterHints: node.characterHints,
		povCharacterId: node.povCharacterId,
		locationId: node.locationId,
		characterIds: node.characterIds,
		plotThreadIds: node.plotThreadIds,
		foreshadowingIds: node.foreshadowingIds,
		status: node.status,
		source: node.source,
		resourceId: node.resourceId
	});
}

function chapterStatusMismatch(
	node: StoryOutlineNode,
	manuscript: OutlineManuscriptState
): string | undefined {
	const plannedStatus = node.status ?? 'planned';
	if (!manuscript.hasContent && ['drafting', 'drafted', 'revising', 'complete'].includes(plannedStatus)) {
		return `大纲状态为“${plannedStatus}”，但对应正文为空。`;
	}
	if (manuscript.hasContent && ['planned', 'ready_to_write'].includes(plannedStatus)) {
		return `对应正文已经有内容，但大纲状态仍为“${plannedStatus}”。`;
	}
	if (manuscript.status === 'completed' && plannedStatus !== 'complete') {
		return '项目中的章节已完成，但大纲节点尚未标记完成。';
	}
	if (plannedStatus === 'complete' && manuscript.status !== 'completed') {
		return '大纲节点已标记完成，但项目中的章节尚未完成。';
	}
	return undefined;
}

/**
 * Runs deterministic, read-only outline checks. The implementation intentionally
 * uses maps and single-pass groups so the persisted 512-node maximum remains cheap.
 */
export function runLocalOutlineChecks(
	state: CreationJourneyState,
	context: LocalOutlineCheckContext = {}
): readonly OutlineQualityIssue[] {
	const issues: OutlineQualityIssue[] = [];
	const nodesById = new Map<string, StoryOutlineNode>();
	const duplicateGroups = new Map<string, StoryOutlineNode[]>();
	for (const node of state.outline) {
		const group = duplicateGroups.get(node.id);
		if (group) group.push(node);
		else duplicateGroups.set(node.id, [node]);
		if (!nodesById.has(node.id)) nodesById.set(node.id, node);
	}

	for (const [id, nodes] of duplicateGroups) {
		if (nodes.length < 2) continue;
		issues.push(issue(
			'duplicate-id',
			'error',
			'节点 ID 重复',
			`有 ${nodes.length} 个节点使用同一个 ID，系统无法可靠区分它们。`,
			nodes,
			nodes.map(node => nodeEvidence(node, 'id')),
			'保存、定位和跨资源引用可能指向错误节点。',
			'为重复节点分配新的唯一 ID，再重新检查。',
			id
		));
	}

	const siblingOrders = new Map<string, Map<number, StoryOutlineNode[]>>();
	for (const node of state.outline) {
		if (!node.title.trim()) {
			issues.push(issue(
				'empty-title', 'error', '节点标题为空', '这个节点没有可识别的标题。',
				[node], [nodeEvidence(node, 'title')],
				'作者和后续生成无法稳定引用这个节点。', '填写一个简短、可区分的节点标题。'
			));
		}
		if (!node.summary.trim()) {
			issues.push(issue(
				'empty-summary', 'error', '节点概要为空', '这个节点没有说明发生了什么。',
				[node], [nodeEvidence(node, 'summary')],
				'章节拆分和语义检查会缺少必要上下文。', '补充一句话概要，说明行动、变化或结果。'
			));
		}

		const parent = node.parentId ? nodesById.get(node.parentId) : undefined;
		if (node.parentId && !parent) {
			issues.push(issue(
				'orphan-node', 'error', '节点失去父级',
				`父级“${node.parentId}”不存在。`, [node], [nodeEvidence(node, 'parentId')],
				'这个节点不会出现在正确的故事层级中。', '重新选择一个存在且类型正确的父级。'
			));
		}
		if (node.type === 'chapter' && parent?.type !== 'volume') {
			issues.push(issue(
				'chapter-without-volume', 'error', '章节不在卷内',
				'章节必须属于一个有效的卷节点。', [node], [nodeEvidence(node, 'parentId')],
				'章节无法安全物化到项目目录。', '把章节移动到目标卷下。'
			));
		}
		if (node.type === 'scene' && parent?.type !== 'chapter') {
			issues.push(issue(
				'scene-without-chapter', 'error', '场景不在章节内',
				'场景必须属于一个有效的章节节点。', [node], [nodeEvidence(node, 'parentId')],
				'场景目标和正文锚点无法归入章节。', '把场景移动到目标章节下。'
			));
		}

		if (node.order !== undefined) {
			const siblingKey = `${node.type ?? 'story_beat'}:${node.parentId ?? 'root'}`;
			const orders = siblingOrders.get(siblingKey) ?? new Map<number, StoryOutlineNode[]>();
			const orderGroup = orders.get(node.order) ?? [];
			orderGroup.push(node);
			orders.set(node.order, orderGroup);
			siblingOrders.set(siblingKey, orders);
		}
	}

	for (const [siblingKey, orders] of siblingOrders) {
		for (const [order, nodes] of orders) {
			if (nodes.length < 2) continue;
			issues.push(issue(
				'duplicate-order', 'error', '同级顺序重复',
				`同一层级有 ${nodes.length} 个节点都使用顺序 ${order}。`, nodes,
				nodes.map(node => nodeEvidence(node, 'order')),
				'显示顺序和生成顺序可能在不同操作中发生漂移。',
				'重新排序这些同级节点，使顺序值唯一且连续。', siblingKey
			));
		}
	}

	if (context.baseline) {
		const baselineById = new Map(context.baseline.outline.map(node => [node.id, node]));
		for (const id of state.locks.outlineNodeIds) {
			const node = nodesById.get(id);
			const baseline = baselineById.get(id);
			if (!node || !baseline || lockedFingerprint(node) === lockedFingerprint(baseline)) continue;
			issues.push(issue(
				'locked-node-modified', 'error', '锁定节点已被改动',
				'当前内容与最近保存的锁定版本不同。', [node], [nodeEvidence(node, 'title')],
				'继续保存会破坏作者明确锁定的决定。',
				'恢复已保存内容，或先明确解除锁定再修改。'
			));
		}
	}

	const manuscripts = new Map(
		(context.manuscripts ?? []).map(manuscript => [manuscript.resourceId, manuscript])
	);
	for (const node of state.outline) {
		if (node.type !== 'chapter' || !node.resourceId) continue;
		const manuscript = manuscripts.get(node.resourceId);
		if (!manuscript) continue;
		const mismatch = chapterStatusMismatch(node, manuscript);
		if (!mismatch) continue;
		issues.push(issue(
			'chapter-manuscript-status-mismatch', 'warning', '章节计划与正文状态不一致',
			mismatch, [node], [
				nodeEvidence(node, 'status'),
				{ nodeId: node.id, field: 'manuscript', quote: manuscript.hasContent ? '已有正文' : '正文为空' }
			],
			'写作进度、导航提示和后续检查可能给出互相矛盾的结论。',
			'核对正文后，把大纲节点和项目章节更新为一致状态。'
		));
	}

	return issues;
}
