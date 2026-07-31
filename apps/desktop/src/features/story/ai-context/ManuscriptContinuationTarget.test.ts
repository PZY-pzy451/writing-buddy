import { describe, expect, it } from 'vitest';
import {
	isSceneScaffoldOnly,
	resolveManuscriptContinuationTarget
} from './ManuscriptContinuationTarget';

const scaffold = [
	'# 第一章 · 迟到的声音',
	'',
	'## 场景 1 · 零点来电',
	'',
	'<!-- writing-buddy-scene:scene:one -->',
	'',
	'## 场景 2 · 雨夜声纹',
	'',
	'<!-- writing-buddy-scene:scene:two -->',
	''
].join('\n');

describe('ManuscriptContinuationTarget', () => {
	it('recognizes a materialized chapter that still contains only scene scaffolding', () => {
		expect(isSceneScaffoldOnly(scaffold)).toBe(true);
		expect(isSceneScaffoldOnly(`${scaffold}\n顾言听见电话响了。`)).toBe(false);
		expect(isSceneScaffoldOnly('# 只有标题')).toBe(false);
	});

	it('moves an opening draft from offset zero to the end of the confirmed scaffold', () => {
		expect(resolveManuscriptContinuationTarget(
			scaffold,
			0,
			'continue-paragraph'
		)).toEqual({
			cursorOffset: scaffold.length,
			openingDraft: true
		});
		expect(resolveManuscriptContinuationTarget(
			scaffold,
			0,
			'three-directions'
		)).toEqual({
			cursorOffset: scaffold.length,
			openingDraft: true
		});
		expect(resolveManuscriptContinuationTarget(
			scaffold,
			scaffold.length,
			'continue-paragraph'
		)).toEqual({
			cursorOffset: scaffold.length,
			openingDraft: true
		});
	});

	it('never relocates a normal continuation or a document that already has prose', () => {
		const prose = `${scaffold}\n顾言听见电话响了。`;
		expect(resolveManuscriptContinuationTarget(
			prose,
			prose.length,
			'continue-paragraph'
		)).toEqual({
			cursorOffset: prose.length,
			openingDraft: false
		});
		expect(resolveManuscriptContinuationTarget(
			prose,
			0,
			'continue-paragraph'
		)).toEqual({
			cursorOffset: 0,
			openingDraft: false
		});
		expect(resolveManuscriptContinuationTarget(
			scaffold,
			0,
			'finish-scene'
		)).toEqual({
			cursorOffset: 0,
			openingDraft: false
		});
	});
});
