import {
	isCursorAtParagraphEnd,
	looksLikeDialogue,
	resolveContextualWriterActions,
	type WriterUiContext
} from './ContextualActionResolver';

const baseContext: WriterUiContext = {
	workspace: 'writing',
	hasProject: true,
	activeResourceType: 'chapter',
	selectionText: '',
	cursorAtParagraphEnd: true,
	chapterHasDraft: true,
	chapterHasPendingExtraction: false
};

describe('ContextualActionResolver', () => {
	it('shows Continue only when an empty selection is at the paragraph end', () => {
		const content = '雨落在站台。\n林墨抬起头。';
		expect(isCursorAtParagraphEnd(content, '雨落在站台。'.length)).toBe(true);
		expect(isCursorAtParagraphEnd(content, content.indexOf('抬'))).toBe(false);
		expect(isCursorAtParagraphEnd(content, content.length)).toBe(true);
	});

	it('keeps the no-selection writing surface to the three existing continuation modes', () => {
		const group = resolveContextualWriterActions(baseContext);

		expect(group.primary.map(action => action.id)).toEqual([
			'continuation:continue-paragraph',
			'continuation:three-directions',
			'continuation:finish-scene'
		]);
		expect(group.primary).toHaveLength(3);
		expect(group.secondary.map(action => action.id)).toContain('organize:chapter');
	});

	it('shows four prose rewrites and moves less likely actions under More', () => {
		const group = resolveContextualWriterActions({
			...baseContext,
			selectionText: '夜雨落在旧车站的玻璃顶上，像一封迟迟没有拆开的信。'
		});

		expect(group.primary.map(action => action.id)).toEqual([
			'rewrite:polish',
			'rewrite:concise',
			'rewrite:expand',
			'rewrite:pacing'
		]);
		expect(group.secondary.map(action => action.id)).toEqual([
			'rewrite:grammar',
			'rewrite:dialogue'
		]);
		expect(group.primary.length).toBeLessThanOrEqual(4);
	});

	it('uses conservative local dialogue detection and falls back for ambiguous prose', () => {
		const dialogue = '“别回头。”林越压低声音。\n“为什么？”沈青问。';
		expect(looksLikeDialogue(dialogue)).toBe(true);
		expect(looksLikeDialogue('林越想起她曾说过不要回头。')).toBe(false);

		const group = resolveContextualWriterActions({
			...baseContext,
			selectionText: dialogue
		});
		expect(group.primary.map(action => action.id)).toEqual([
			'rewrite:dialogue',
			'rewrite:polish',
			'rewrite:concise',
			'rewrite:pacing'
		]);
		expect(group.secondary.map(action => action.id)).toEqual([
			'rewrite:expand',
			'rewrite:grammar'
		]);
	});

	it('does not surface manuscript AI outside a writable chapter context', () => {
		expect(resolveContextualWriterActions({
			...baseContext,
			workspace: 'reference'
		})).toEqual({ primary: [], secondary: [] });
		expect(resolveContextualWriterActions({
			...baseContext,
			activeResourceType: 'story'
		})).toEqual({ primary: [], secondary: [] });
		expect(resolveContextualWriterActions({
			...baseContext,
			hasProject: false
		})).toEqual({ primary: [], secondary: [] });
	});
});
