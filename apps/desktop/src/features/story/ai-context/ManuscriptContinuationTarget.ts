import type { ManuscriptContinuationMode } from '@writing-buddy/story-kernel';

const sceneAnchorPattern = /<!--\s*writing-buddy-scene:[^\r\n]*?-->/gu;
const markdownHeadingPattern = /^\s{0,3}#{1,6}\s+.*$/gmu;

export interface ManuscriptContinuationTarget {
	readonly cursorOffset: number;
	readonly openingDraft: boolean;
}

export function isSceneScaffoldOnly(content: string): boolean {
	if (!content.trim() || !sceneAnchorPattern.test(content)) {
		sceneAnchorPattern.lastIndex = 0;
		return false;
	}
	sceneAnchorPattern.lastIndex = 0;
	const prose = content
		.replace(sceneAnchorPattern, '')
		.replace(markdownHeadingPattern, '')
		.trim();
	sceneAnchorPattern.lastIndex = 0;
	return prose.length === 0;
}

export function resolveManuscriptContinuationTarget(
	content: string,
	cursorOffset: number,
	mode: ManuscriptContinuationMode
): ManuscriptContinuationTarget {
	const safeOffset = Math.max(0, Math.min(cursorOffset, content.length));
	if (
		mode !== 'finish-scene'
		&& isSceneScaffoldOnly(content)
	) {
		return {
			cursorOffset: content.length,
			openingDraft: true
		};
	}
	return {
		cursorOffset: safeOffset,
		openingDraft: false
	};
}
