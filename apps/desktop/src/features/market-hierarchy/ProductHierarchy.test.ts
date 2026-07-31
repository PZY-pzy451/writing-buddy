import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { describe, expect, it } from 'vitest';
import {
	deriveAuthorProductStage,
	primaryModePresentation
} from './ProductHierarchy';

function snapshot(wordCounts: Readonly<Record<string, number>>, chapterCount = 1): ProjectSnapshot {
	return {
		root: 'D:/Market Hierarchy',
		projectRevision: 'revision-1',
		project: {
			schemaVersion: 1,
			projectId: 'market-hierarchy',
			title: '雾港来信',
			volumes: chapterCount === 0 ? [] : [{
				id: 'volume-one',
				title: '第一卷',
				chapters: Array.from({ length: chapterCount }, (_, index) => ({
					id: `chapter-${index + 1}`,
					title: `第 ${index + 1} 章`,
					file: `chapters/chapter-${index + 1}.md`,
					status: 'draft' as const,
					targetWords: 3000,
					scene: {
						location: '',
						time: '',
						pov: '',
						characters: [],
						goal: '',
						note: ''
					}
				}))
			}]
		},
		resources: [],
		wordCounts,
		integrityIssues: [],
		readOnly: false
	};
}

describe('ProductHierarchy', () => {
	it('derives the progressive author stage without reading author prose', () => {
		expect(deriveAuthorProductStage()).toBe('start');
		expect(deriveAuthorProductStage(snapshot({}, 0))).toBe('outline');
		expect(deriveAuthorProductStage(snapshot({}))).toBe('structure');
		expect(deriveAuthorProductStage(snapshot({ 'chapter-1': 40 }))).toBe('draft');
		expect(deriveAuthorProductStage(snapshot({
			'chapter-1': 40,
			'chapter-2': 20
		}, 2))).toBe('longform');
	});

	it('keeps all five destinations while lowering irrelevant early-stage weight', () => {
		expect(primaryModePresentation('start', 'planning')).toMatchObject({
			disabled: true,
			muted: true
		});
		expect(primaryModePresentation('outline', 'planning')).toMatchObject({
			disabled: false,
			muted: false
		});
		expect(primaryModePresentation('outline', 'references')).toMatchObject({
			disabled: false,
			muted: true
		});
		expect(primaryModePresentation('draft', 'references')).toMatchObject({
			disabled: false,
			muted: false
		});
	});
});
