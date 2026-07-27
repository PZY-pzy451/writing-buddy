import type { ItemState } from '../model/ItemState';
import type { StoryItem } from '../model/StoryItem';
import type { RuleEvidencePosition, RuleIssue } from './RuleIssue';
import { stableRuleIssueId } from './RuleIssue';

function evidenceFor(state: ItemState): RuleEvidencePosition {
	return {
		eventId: state.id,
		chapterId: state.effectiveFrom.chapterId,
		...(state.effectiveFrom.sceneId ? { sceneId: state.effectiveFrom.sceneId } : {}),
		...(state.effectiveFrom.storyTime ? { storyTime: state.effectiveFrom.storyTime } : {}),
		evidenceIds: state.evidenceIds
	};
}

export function runItemRules(
	items: readonly StoryItem[],
	states: readonly ItemState[]
): readonly RuleIssue[] {
	const issues: RuleIssue[] = [];
	const itemById = new Map(items.map(item => [item.id, item]));

	for (const state of states) {
		if (state.quantity < 0) {
			issues.push({
				id: stableRuleIssueId('item.negative-quantity', [state.id]),
				ruleId: 'item.negative-quantity',
				severity: 'error',
				title: '物品数量为负数',
				message: `${itemById.get(state.itemId)?.title ?? state.itemId} 的数量不能小于零。`,
				evidence: [evidenceFor(state)]
			});
		}
	}

	for (const item of items.filter(candidate => candidate.unique)) {
		const itemStates = states.filter(state => (
			state.itemId === item.id && state.quantity > 0 && state.holderCharacterId
		));
		for (let leftIndex = 0; leftIndex < itemStates.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < itemStates.length; rightIndex += 1) {
				const left = itemStates[leftIndex];
				const right = itemStates[rightIndex];
				if (!left || !right || left.holderCharacterId === right.holderCharacterId) continue;
				const leftEnd = left.effectiveUntil?.narrativeOrder ?? Number.POSITIVE_INFINITY;
				const rightEnd = right.effectiveUntil?.narrativeOrder ?? Number.POSITIVE_INFINITY;
				const overlaps = left.effectiveFrom.narrativeOrder < rightEnd
					&& right.effectiveFrom.narrativeOrder < leftEnd;
				if (overlaps) {
					issues.push({
						id: stableRuleIssueId('item.unique-multiple-holders', [left.id, right.id]),
						ruleId: 'item.unique-multiple-holders',
						severity: 'error',
						title: '唯一物品同时被多人持有',
						message: `${item.title} 在重叠时间范围内存在两个持有人。`,
						evidence: [evidenceFor(left), evidenceFor(right)]
					});
				}
			}
		}
		const transfersByOrder = new Map<number, ItemState[]>();
		for (const state of itemStates.filter(candidate => candidate.action === 'transferred')) {
			const group = transfersByOrder.get(state.effectiveFrom.narrativeOrder) ?? [];
			group.push(state);
			transfersByOrder.set(state.effectiveFrom.narrativeOrder, group);
		}
		for (const group of transfersByOrder.values()) {
			const holders = new Set(group.map(state => state.holderCharacterId));
			if (holders.size > 1) {
				issues.push({
					id: stableRuleIssueId('item.transfer-overlap', group.map(state => state.id)),
					ruleId: 'item.transfer-overlap',
					severity: 'warning',
					title: '物品转移记录重叠',
					message: `${item.title} 在同一叙事位置被转移给多个持有人。`,
					evidence: group.map(evidenceFor)
				});
			}
		}
	}
	return issues;
}
