import type {
	ManuscriptContinuationMode,
	SelectionRewriteActionType
} from '@writing-buddy/story-kernel';

export type WriterWorkspace =
	| 'writing'
	| 'planning'
	| 'reference'
	| 'review'
	| 'history';

export interface WriterUiContext {
	readonly workspace: WriterWorkspace;
	readonly hasProject: boolean;
	readonly activeResourceType?: string;
	readonly selectionText?: string;
	readonly cursorAtParagraphEnd: boolean;
	readonly chapterHasDraft: boolean;
	readonly chapterHasPendingExtraction: boolean;
}

interface ContextualActionBase {
	readonly id: string;
	readonly label: string;
	readonly description: string;
}

export type ContextualWriterAction =
	| ContextualActionBase & {
			readonly kind: 'rewrite';
			readonly actionType: SelectionRewriteActionType;
		}
	| ContextualActionBase & {
			readonly kind: 'continuation';
			readonly mode: ManuscriptContinuationMode;
		}
	| ContextualActionBase & {
			readonly kind: 'organize';
		};

export interface ContextualActionGroup {
	readonly primary: readonly ContextualWriterAction[];
	readonly secondary: readonly ContextualWriterAction[];
}

const rewriteActions: Readonly<Record<
	SelectionRewriteActionType,
	ContextualWriterAction
>> = {
	polish: {
		id: 'rewrite:polish',
		kind: 'rewrite',
		actionType: 'polish',
		label: '润色',
		description: '改善表达，同时保留原意。'
	},
	concise: {
		id: 'rewrite:concise',
		kind: 'rewrite',
		actionType: 'concise',
		label: '精简',
		description: '删去重复和拖沓表达。'
	},
	expand: {
		id: 'rewrite:expand',
		kind: 'rewrite',
		actionType: 'expand',
		label: '扩写',
		description: '补充动作、感官和必要细节。'
	},
	grammar: {
		id: 'rewrite:grammar',
		kind: 'rewrite',
		actionType: 'grammar',
		label: '语病检查',
		description: '修正明确的语法和表达问题。'
	},
	dialogue: {
		id: 'rewrite:dialogue',
		kind: 'rewrite',
		actionType: 'dialogue',
		label: '优化对话',
		description: '改善人物语气、节奏和潜台词。'
	},
	pacing: {
		id: 'rewrite:pacing',
		kind: 'rewrite',
		actionType: 'pacing',
		label: '调整节奏',
		description: '调整句段速度和信息密度。'
	}
};

const continuationActions: Readonly<Record<
	ManuscriptContinuationMode,
	ContextualWriterAction
>> = {
	'continue-paragraph': {
		id: 'continuation:continue-paragraph',
		kind: 'continuation',
		mode: 'continue-paragraph',
		label: '继续这一段',
		description: '沿当前光标生成一个候选。'
	},
	'three-directions': {
		id: 'continuation:three-directions',
		kind: 'continuation',
		mode: 'three-directions',
		label: '三个发展方向',
		description: '并排审阅三种不同走向。'
	},
	'finish-scene': {
		id: 'continuation:finish-scene',
		kind: 'continuation',
		mode: 'finish-scene',
		label: '完成当前场景',
		description: '收束当前已关联场景。'
	}
};

/**
 * Deliberately conservative and local. Ambiguous prose returns false instead
 * of making a hidden provider request just to choose a menu.
 */
export function looksLikeDialogue(selectionText: string): boolean {
	const text = selectionText.trim();
	if (!text) return false;
	const chineseQuotes = text.match(/“[^”\r\n]{1,240}”/gu) ?? [];
	const straightQuotes = text.match(/"[^"\r\n]{1,240}"/gu) ?? [];
	const quotedSegments = [...chineseQuotes, ...straightQuotes];
	if (quotedSegments.length >= 2) return true;
	if (quotedSegments.length !== 1) return false;
	const quotedLength = quotedSegments[0]?.length ?? 0;
	const lines = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
	return lines.length === 1 && quotedLength / text.length >= 0.5;
}

export function resolveContextualWriterActions(
	context: WriterUiContext
): ContextualActionGroup {
	if (
		!context.hasProject
		|| context.workspace !== 'writing'
		|| context.activeResourceType !== 'chapter'
	) {
		return { primary: [], secondary: [] };
	}

	const selection = context.selectionText?.trim() ?? '';
	if (selection) {
		if (looksLikeDialogue(selection)) {
			return {
				primary: [
					rewriteActions.dialogue,
					rewriteActions.polish,
					rewriteActions.concise,
					rewriteActions.pacing
				],
				secondary: [
					rewriteActions.expand,
					rewriteActions.grammar
				]
			};
		}
		return {
			primary: [
				rewriteActions.polish,
				rewriteActions.concise,
				rewriteActions.expand,
				rewriteActions.pacing
			],
			secondary: [
				rewriteActions.grammar,
				rewriteActions.dialogue
			]
		};
	}

	if (!context.chapterHasDraft) {
		return { primary: [], secondary: [] };
	}
	const continuationOrder = context.cursorAtParagraphEnd
		? [
				continuationActions['continue-paragraph'],
				continuationActions['three-directions'],
				continuationActions['finish-scene']
			]
		: [
				continuationActions['three-directions'],
				continuationActions['finish-scene']
			];
	return {
		primary: continuationOrder,
		secondary: [
			{
				id: 'organize:chapter',
				kind: 'organize',
				label: context.chapterHasPendingExtraction ? '查看整理候选' : '整理本章',
				description: '进入写后整理；打开页面不会自动调用 AI。'
			},
			...(context.cursorAtParagraphEnd
				? []
				: [continuationActions['continue-paragraph']])
		]
	};
}
