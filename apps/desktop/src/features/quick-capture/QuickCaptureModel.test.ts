import { describe, expect, it } from 'vitest';
import { resolveAnchor } from '@writing-buddy/review';
import {
	captureAnchorForEditor,
	createQuickCapture,
	parseQuickCaptureState,
	serializeQuickCaptureState
} from './QuickCaptureModel';

describe('QuickCaptureModel', () => {
	it('creates a portable anchor from the exact editor selection', () => {
		const content = '夜雨落在旧车站的玻璃顶上。\n林越停在门外。';
		const anchor = captureAnchorForEditor(content, 4, { start: 4, end: 7 });

		expect(anchor?.target).toBe('旧车站');
		expect(resolveAnchor(content, anchor!)).toEqual({ start: 4, end: 7 });
	});

	it('anchors the non-empty paragraph around the cursor without changing text', () => {
		const content = '第一段。\n\n  夜雨落在玻璃顶上。  \n尾声。';
		const before = content;
		const anchor = captureAnchorForEditor(content, 13);

		expect(anchor?.target).toBe('夜雨落在玻璃顶上。');
		expect(resolveAnchor(content, anchor!)).toEqual({ start: 8, end: 17 });
		expect(content).toBe(before);
	});

	it('creates, serializes, and strictly parses a versioned project record', () => {
		const capture = createQuickCapture({
			projectId: 'novel-001',
			type: 'idea',
			text: '让玻璃顶在终章再次出现',
			chapterId: 'chapter:chapter-001',
			sceneId: 'scene:opening',
			anchor: captureAnchorForEditor('夜雨落在玻璃顶上。', 4)
		}, {
			id: () => 'capture:idea-001',
			now: () => '2026-07-29T01:02:03.000Z'
		});

		const parsed = parseQuickCaptureState(serializeQuickCaptureState({
			schemaVersion: 1,
			captures: [capture]
		}));

		expect(parsed.captures[0]).toMatchObject({
			id: 'capture:idea-001',
			status: 'inbox',
			text: '让玻璃顶在终章再次出现',
			chapterId: 'chapter:chapter-001'
		});
		expect(() => parseQuickCaptureState(JSON.stringify({
			schemaVersion: 1,
			captures: [{ ...capture, status: 'unknown' }]
		}))).toThrow('quickCaptureStateInvalid');
	});
});
