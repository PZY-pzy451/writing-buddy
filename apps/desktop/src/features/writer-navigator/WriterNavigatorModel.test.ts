import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { resolveAnchor } from '@writing-buddy/review';
import { describe, expect, it, vi } from 'vitest';
import {
	buildWriterNavigatorCatalog,
	searchManuscriptOccurrences,
	sortWriterNavigatorResults,
	type WriterNavigatorResult
} from './WriterNavigatorModel';

const snapshot: ProjectSnapshot = {
	root: 'D:/fixture',
	project: {
		schemaVersion: 1,
		projectId: 'project-one',
		title: '我的小说',
		volumes: [{
			id: 'volume-one',
			title: '第一卷',
			chapters: [
				{
					id: 'chapter-one',
					title: '第一章 雨夜',
					file: 'chapters/one.md',
					scene: {
						location: '旧车站',
						time: '雨夜',
						pov: '林墨',
						characters: [],
						goal: '',
						note: ''
					}
				},
				{
					id: 'chapter-two',
					title: '第二章 车票',
					file: 'chapters/two.md',
					scene: {
						location: '',
						time: '',
						pov: '',
						characters: [],
						goal: '',
						note: ''
					}
				}
			]
		}]
	},
	projectRevision: 'revision',
	resources: [{
		id: 'note-one',
		type: 'note',
		title: '车票线索',
		path: 'notes/ticket.md'
	}],
	integrityIssues: [],
	wordCounts: {},
	readOnly: false
};

describe('WriterNavigatorModel', () => {
	it('builds grouped chapter, scene, resource, setting and command entries without author paths', () => {
		const catalog = buildWriterNavigatorCatalog({
			snapshot,
			scenes: [{
				id: 'scene-one',
				chapterId: 'chapter:chapter-one',
				manuscriptRange: {
					start: 8,
					end: 24,
					revision: 1,
					quote: '售票厅里的争执'
				},
				narrativeOrder: 1,
				summary: '售票厅里的争执',
				locationIds: [],
				participantIds: [],
				plotThreadIds: [],
				itemIds: []
			}] as never,
			storyResources: [{
				id: 'item:ticket',
				type: 'item',
				title: '褪色车票'
			}],
			recentIds: ['story:item:ticket']
		});

		expect(catalog.map(result => result.kind)).toEqual(expect.arrayContaining([
			'chapter',
			'scene',
			'resource',
			'setting',
			'command'
		]));
		expect(catalog.find(result => result.id === 'story:item:ticket')).toMatchObject({
			group: '资料',
			title: '褪色车票',
			recent: true
		});
		expect(JSON.stringify(catalog)).not.toContain('D:/fixture');
	});

	it('searches manuscript only on demand, bounds read concurrency and returns exact anchors', async () => {
		let active = 0;
		let maximum = 0;
		const contents: Record<string, string> = {
			'chapters/one.md': '雨落在旧车站的玻璃顶上。\\n\\n褪色车票贴在信封背面。',
			'chapters/two.md': '林墨再次取出那张车票。'
		};
		const readText = vi.fn(async (_root: string, path: string) => {
			active += 1;
			maximum = Math.max(maximum, active);
			await Promise.resolve();
			active -= 1;
			return {
				content: contents[path] ?? '',
				encoding: 'utf-8' as const,
				eol: 'lf' as const,
				hasBom: false,
				hash: `hash:${path}`
			};
		});

		expect(await searchManuscriptOccurrences(snapshot, '   ', readText, 1)).toEqual([]);
		expect(readText).not.toHaveBeenCalled();

		const results = await searchManuscriptOccurrences(snapshot, '车票', readText, 1);

		expect(maximum).toBeLessThanOrEqual(1);
		expect(results).toHaveLength(2);
		expect(results[0]).toMatchObject({
			kind: 'manuscript',
			group: '正文',
			chapterId: 'chapter-one'
		});
		expect(results[0]?.subtitle).not.toContain('\\n');
		const first = results[0];
		expect(first).toBeDefined();
		if (!first?.anchor) throw new Error('missing fixture anchor');
		expect(resolveAnchor(contents['chapters/one.md'], first.anchor)).toEqual({
			start: contents['chapters/one.md'].indexOf('车票'),
			end: contents['chapters/one.md'].indexOf('车票') + 2
		});
	});

	it('ranks exact, prefix, recent and command results deterministically', () => {
		const result = (patch: Partial<WriterNavigatorResult>): WriterNavigatorResult => ({
			id: 'one',
			kind: 'resource',
			group: '资料',
			title: '车票',
			searchText: '车票',
			...patch
		});
		expect(sortWriterNavigatorResults([
			result({
				id: 'command',
				kind: 'command',
				group: '命令',
				title: '记录车票',
				searchText: '记录车票'
			}),
			result({
				id: 'recent',
				title: '车票线索',
				searchText: '车票线索',
				recent: true
			}),
			result({ id: 'exact' })
		], '车票').map(candidate => candidate.id)).toEqual([
			'exact',
			'recent',
			'command'
		]);
	});
});
