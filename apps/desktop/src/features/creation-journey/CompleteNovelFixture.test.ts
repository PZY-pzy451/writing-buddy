import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countWords, type WritingProject } from '@writing-buddy/domain';
import {
	resourceSchemas,
	storyManifestSchema,
	type StoryResourceType
} from '@writing-buddy/story-kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseCreationJourneyState } from './CreationJourneyModel';

const repositoryRoot = process.cwd();
const outputRoot = resolve(repositoryRoot, 'artifacts', 'novels', 'zero-hour-echo');
const projectRoot = resolve(outputRoot, 'Writing Buddy Project');
const folderByType: Readonly<Partial<Record<StoryResourceType, string>>> = {
	character: 'characters',
	scene: 'scenes',
	location: 'locations',
	faction: 'factions',
	item: 'items',
	worldRule: 'world-rules',
	relationship: 'relationships',
	plotThread: 'plot-threads',
	foreshadowing: 'foreshadowing',
	information: 'information'
};

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, 'utf8'));
}

describe('complete novel acceptance fixture', () => {
	beforeAll(() => {
		execFileSync(
			process.execPath,
			[resolve(repositoryRoot, 'scripts', 'acceptance', 'prepare-complete-novel.mjs')],
			{ cwd: repositoryRoot, stdio: 'pipe' }
		);
	});

	it('contains twelve distinct, completed chapters with two authored scenes each', () => {
		const project = readJson(
			resolve(projectRoot, '.writing-buddy', 'project.json')
		) as WritingProject;
		const chapters = project.volumes.flatMap(volume => volume.chapters);
		const ids = new Set(chapters.map(chapter => chapter.id));
		const files = new Set(chapters.map(chapter => chapter.file));
		const hashes = new Set<string>();
		let totalWords = 0;

		expect(project.title).toBe('零点回声');
		expect(project.volumes).toHaveLength(3);
		expect(chapters).toHaveLength(12);
		expect(ids.size).toBe(12);
		expect(files.size).toBe(12);
		for (const chapter of chapters) {
			const content = readFileSync(resolve(projectRoot, chapter.file), 'utf8');
			const headings = content.match(/^## .+$/gmu) ?? [];
			const words = countWords(content);
			totalWords += words;
			hashes.add(createHash('sha256').update(content).digest('hex'));
			expect(chapter.status).toBe('completed');
			expect(headings).toHaveLength(2);
			expect(words).toBeGreaterThan(1_500);
			expect(content).not.toMatch(/\b(?:TODO|TBD|PLACEHOLDER)\b|待补|示例正文/u);
		}
		expect(hashes.size).toBe(12);
		expect(totalWords).toBeGreaterThan(20_000);
	});

	it('round-trips every Story Kernel resource and keeps all scene anchors exact', () => {
		const manifest = storyManifestSchema.parse(
			readJson(resolve(projectRoot, 'story', 'manifest.json'))
		);
		const resources = new Map<string, Record<string, unknown>>();
		for (const [type, ids] of Object.entries(manifest.resources)) {
			const typedType = type as StoryResourceType;
			const folder = folderByType[typedType];
			expect(folder).toBeTruthy();
			for (const id of ids ?? []) {
				const raw = readJson(resolve(
					projectRoot,
					'story',
					folder!,
					`${encodeURIComponent(id)}.json`
				));
				const parsed = resourceSchemas[typedType].parse(raw) as Record<string, unknown>;
				resources.set(id, parsed);
			}
		}

		const scenes = [...resources.values()].filter(resource => resource.type === 'scene');
		expect(scenes).toHaveLength(24);
		for (const scene of scenes) {
			const chapterId = String(scene.chapterId).replace(/^chapter:/u, '');
			const project = readJson(
				resolve(projectRoot, '.writing-buddy', 'project.json')
			) as WritingProject;
			const chapter = project.volumes
				.flatMap(volume => volume.chapters)
				.find(candidate => candidate.id === chapterId);
			expect(chapter).toBeDefined();
			const content = readFileSync(resolve(projectRoot, chapter!.file), 'utf8');
			const anchor = scene.manuscriptRange as {
				readonly start: number;
				readonly end: number;
				readonly quote: string;
			};
			expect(anchor.end).toBeLessThanOrEqual(content.length);
			expect(content.slice(anchor.start, anchor.start + anchor.quote.length))
				.toBe(anchor.quote);
		}

		const plotThreads = [...resources.values()]
			.filter(resource => resource.type === 'plotThread');
		const foreshadowing = [...resources.values()]
			.filter(resource => resource.type === 'foreshadowing');
		expect(plotThreads.every(resource => resource.status === 'resolved')).toBe(true);
		expect(foreshadowing.every(resource => resource.status === 'resolved')).toBe(true);
	});

	it('loads a complete creation journey with twelve chapter and twenty-four scene nodes', () => {
		const journey = parseCreationJourneyState(readFileSync(
			resolve(projectRoot, '.writing-buddy', 'creation', 'journey.json'),
			'utf8'
		));
		expect(journey.stage).toBe('writing');
		expect(journey.storyOutline?.status).toBe('confirmed');
		expect(journey.directions).toHaveLength(3);
		expect(journey.selectedDirectionIds).toEqual([
			'journey-direction:ethical-techno-mystery'
		]);
		expect(journey.outline.filter(node => node.type === 'chapter')).toHaveLength(12);
		expect(journey.outline.filter(node => node.type === 'scene')).toHaveLength(24);
		expect(journey.outline.filter(node => node.type === 'story_beat')).toHaveLength(6);
		expect(journey.stale).toEqual({
			directions: false,
			outline: false,
			chapters: false
		});
	});

	it('resolves the central hook and finishes with unmediated sound', () => {
		const finale = readFileSync(
			resolve(projectRoot, 'chapters', '12-回声尽头.md'),
			'utf8'
		);
		expect(finale).toContain('顾言保留原始文件，删除了工作副本');
		expect(finale).toContain('没有迟到五年的来电');
		expect(finale).toContain('她终于听见，海原来一直这么响');
	});
});
