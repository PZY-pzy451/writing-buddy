import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtureRoot = join(repositoryRoot, 'fixtures');
const legacyRoot = join(fixtureRoot, 'legacy-projects');
const corruptedRoot = join(fixtureRoot, 'corrupted-projects');

const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalize = path => path.replaceAll('\\', '/');

async function writeText(root, relativePath, content, options = {}) {
	const path = join(root, ...relativePath.split('/'));
	await mkdir(dirname(path), { recursive: true });
	const eolContent = options.eol === 'crlf' ? content.replaceAll('\n', '\r\n') : content;
	const bytes = options.bom
		? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(eolContent, 'utf8')])
		: Buffer.from(eolContent, 'utf8');
	await writeFile(path, bytes);
	return sha256(bytes);
}

function manifest(index, chapters, volumeCount = 1) {
	const volumes = Array.from({ length: volumeCount }, (_, volumeIndex) => ({
		id: `volume-${index.toString(16).padStart(7, '0')}${volumeIndex + 1}`,
		title: `第${volumeIndex + 1}卷`,
		chapters: chapters
			.filter((_, chapterIndex) => chapterIndex % volumeCount === volumeIndex)
			.map(chapter => ({ ...chapter }))
	}));
	return {
		schemaVersion: 1,
		projectId: `project-${index.toString(16).padStart(8, '0')}`,
		title: `脱敏测试作品 ${index}`,
		volumes
	};
}

async function createLegacyFixture(index, options = {}) {
	const name = `${String(index).padStart(2, '0')}-${options.name ?? 'project'}`;
	const root = join(legacyRoot, name);
	const chapterCount = options.chapterCount ?? 3;
	const chapters = Array.from({ length: chapterCount }, (_, chapterIndex) => ({
		id: `chapter-${index.toString(16).padStart(7, '0')}${chapterIndex + 1}`,
		title: `第${chapterIndex + 1}章 示例`,
		file: options.unicodePaths && chapterIndex === 0
			? 'chapters/第一卷/第一章.md'
			: `chapters/chapter-${String(chapterIndex + 1).padStart(3, '0')}.md`,
		status: chapterIndex === 1 ? 'revision' : 'draft',
		targetWords: 3000,
		scene: {
			location: '旧车站',
			time: `23:${17 + chapterIndex}`,
			pov: '林墨',
			characters: ['林墨', '徐青'],
			goal: '找到遗失的笔记',
			note: '所有内容均为脱敏测试数据'
		}
	}));
	const project = manifest(index, chapters, options.volumeCount ?? 1);
	const hashes = {};
	hashes['.writing-buddy/project.json'] = await writeText(
		root,
		'.writing-buddy/project.json',
		`${JSON.stringify(project, undefined, 2)}\n`
	);
	for (const [chapterIndex, chapter] of chapters.entries()) {
		const body = `夜雨落在旧车站的玻璃顶上。\n\n这是脱敏章节 ${chapterIndex + 1}，用于验证中文、标点和写作字数。\n`;
		hashes[chapter.file] = await writeText(root, chapter.file, body, {
			eol: options.crlf ? 'crlf' : 'lf',
			bom: options.bom && chapterIndex === 0
		});
	}
	if (options.resources) {
		hashes['references/characters/lin-mo.json'] = await writeText(
			root,
			'references/characters/lin-mo.json',
			`${JSON.stringify({ schemaVersion: 1, id: 'lin-mo', name: '林墨', notes: '脱敏人物' }, undefined, 2)}\n`
		);
		hashes['references/worldbuilding/station/metadata.json'] = await writeText(
			root,
			'references/worldbuilding/station/metadata.json',
			`${JSON.stringify({ schemaVersion: 1, id: 'station', name: '旧车站', rules: '脱敏设定' }, undefined, 2)}\n`
		);
		hashes['references/worldbuilding/station/content.md'] = await writeText(root, 'references/worldbuilding/station/content.md', '这里是脱敏世界观正文。\n');
		hashes['references/timeline.json'] = await writeText(
			root,
			'references/timeline.json',
			`${JSON.stringify({ schemaVersion: 1, projectId: project.projectId, events: [] }, undefined, 2)}\n`
		);
		hashes['references/items/notebook.json'] = await writeText(
			root,
			'references/items/notebook.json',
			`${JSON.stringify({ schemaVersion: 1, id: 'notebook', name: '旧笔记' }, undefined, 2)}\n`
		);
		hashes['references/notes/创作笔记.md'] = await writeText(root, 'references/notes/创作笔记.md', '脱敏创作笔记。\n');
	}
	if (options.review) {
		hashes['.writing-buddy/review/issues.json'] = await writeText(
			root,
			'.writing-buddy/review/issues.json',
			`${JSON.stringify({ schemaVersion: 1, issues: [{ id: 'review-00000001', ruleId: 'duplicate-punctuation', status: 'open', chapterId: chapters[0].id, anchor: { start: 0, end: 2, excerpt: '夜雨' } }] }, undefined, 2)}\n`
		);
	}
	if (options.ai) {
		hashes['.writing-buddy/ai/settings.json'] = await writeText(
			root,
			'.writing-buddy/ai/settings.json',
			`${JSON.stringify({ schemaVersion: 1, provider: 'deepseek', model: 'deepseek-chat', sendWholeChapter: false }, undefined, 2)}\n`
		);
	}
	if (options.history) {
		hashes['.writing-buddy/history/manifest.json'] = await writeText(
			root,
			'.writing-buddy/history/manifest.json',
			`${JSON.stringify({ schemaVersion: 1, snapshots: [] }, undefined, 2)}\n`
		);
	}
	const expected = {
		fixture: name,
		projectId: project.projectId,
		title: project.title,
		volumeCount: project.volumes.length,
		chapterOrder: project.volumes.flatMap(volume => volume.chapters.map(chapter => chapter.id)),
		chapterPaths: project.volumes.flatMap(volume => volume.chapters.map(chapter => normalize(chapter.file))),
		hashes
	};
	await writeText(root, 'fixture.expected.json', `${JSON.stringify(expected, undefined, 2)}\n`);
}

async function createCorruptedFixtures() {
	const fixtures = [
		['01-invalid-json', '{ this is not JSON }\n'],
		['02-unsupported-schema', JSON.stringify({ schemaVersion: 99, projectId: 'project-00000001', title: 'Unsupported', volumes: [] })],
		['03-unsafe-path', JSON.stringify(manifest(30, [{ id: 'chapter-00001e01', title: 'Unsafe', file: '../outside.md' }]))],
		['04-duplicate-id', JSON.stringify(manifest(31, [
			{ id: 'chapter-00001f01', title: 'One', file: 'chapters/one.md' },
			{ id: 'chapter-00001f01', title: 'Two', file: 'chapters/two.md' }
		]))],
		['05-missing-chapter', JSON.stringify(manifest(32, [{ id: 'chapter-00002001', title: 'Missing', file: 'chapters/missing.md' }]))]
	];
	for (const [name, source] of fixtures) {
		const root = join(corruptedRoot, name);
		await writeText(root, '.writing-buddy/project.json', `${source}\n`);
		await writeText(root, 'fixture.expected-error.json', `${JSON.stringify({
			fixture: name,
			expected: name.replace(/^[0-9]+-/, '')
		}, undefined, 2)}\n`);
	}
}

await rm(fixtureRoot, { recursive: true, force: true });
await Promise.all([
	createLegacyFixture(1, { name: 'minimal-lf' }),
	createLegacyFixture(2, { name: 'crlf', crlf: true }),
	createLegacyFixture(3, { name: 'utf8-bom', bom: true }),
	createLegacyFixture(4, { name: 'unicode-paths', unicodePaths: true }),
	createLegacyFixture(5, { name: 'multiple-volumes', volumeCount: 2, chapterCount: 4 }),
	createLegacyFixture(6, { name: 'resources', resources: true }),
	createLegacyFixture(7, { name: 'review', review: true }),
	createLegacyFixture(8, { name: 'history', history: true }),
	createLegacyFixture(9, { name: 'ai-state', ai: true }),
	createLegacyFixture(10, { name: 'full', resources: true, review: true, history: true, ai: true, volumeCount: 2, chapterCount: 6 }),
	createCorruptedFixtures()
]);

console.log('Generated 10 legacy fixtures and 5 corrupted fixtures.');
