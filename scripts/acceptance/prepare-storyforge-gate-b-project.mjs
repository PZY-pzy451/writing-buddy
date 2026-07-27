import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const sourceRoot = resolve('fixtures/legacy-projects/10-full');
const targetRoot = resolve(process.argv[2] ?? 'tmp/storyforge-gate-b-project-20260727');
const timestamp = '2026-07-27T00:00:00.000Z';

async function sha256(path) {
	const bytes = await readFile(path);
	return createHash('sha256').update(bytes).digest('hex');
}

async function markdownHashes(root) {
	const chapterRoot = resolve(root, 'chapters');
	const names = (await readdir(chapterRoot))
		.filter(name => name.endsWith('.md'))
		.sort();
	return Object.fromEntries(await Promise.all(names.map(async name => [
		name,
		await sha256(resolve(chapterRoot, name))
	])));
}

function base(id, type, title, tags = []) {
	return {
		id,
		type,
		title,
		aliases: [],
		tags,
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1
	};
}

async function writeJson(path, value) {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
}

const character = {
	...base('character:lin-mo', 'character', '林墨', ['主角']),
	role: 'protagonist',
	evidenceIds: []
};
const location = {
	...base('location:old-station', 'location', '旧车站', ['核心场景']),
	evidenceIds: []
};
const item = {
	...base('item:missing-notebook', 'item', '遗失的笔记', ['线索']),
	unique: true,
	restrictions: [],
	evidenceIds: []
};
const plotThread = {
	...base('plot-thread:missing-notebook', 'plotThread', '寻找遗失的笔记', ['active']),
	evidenceIds: []
};
const information = {
	...base('information:clock-stopped', 'information', '机械钟停在 23:17', ['pending-confirmation']),
	evidenceIds: []
};
const scenes = [
	{
		...base('scene:station-rain', 'scene', '雨夜抵达'),
		chapterId: 'chapter:chapter-000000a1',
		manuscriptRange: {
			start: 0,
			end: 13,
			revision: 0,
			quote: '夜雨落在旧车站的玻璃顶上。'
		},
		narrativeOrder: 0,
		locationIds: ['location:old-station'],
		participantIds: ['character:lin-mo'],
		plotThreadIds: ['plot-thread:missing-notebook'],
		revealInformationIds: [],
		foreshadowingIds: [],
		evidenceIds: []
	},
	{
		...base('scene:chapter-purpose', 'scene', '章节用途'),
		chapterId: 'chapter:chapter-000000a1',
		manuscriptRange: {
			start: 15,
			end: 39,
			revision: 0,
			quote: '这是脱敏章节 1，用于验证中文、标点和写作字数。'
		},
		narrativeOrder: 1,
		locationIds: [],
		participantIds: [],
		plotThreadIds: [],
		revealInformationIds: ['information:clock-stopped'],
		foreshadowingIds: [],
		evidenceIds: []
	}
];
const mentions = [
	{
		id: 'mention:old-station',
		resourceId: 'location:old-station',
		chapterId: 'chapter:chapter-000000a1',
		sceneId: 'scene:station-rain',
		anchor: {
			start: 4,
			end: 7,
			revision: 0,
			quote: '旧车站',
			before: '夜雨落在',
			after: '的玻璃顶上。'
		},
		displayText: '旧车站',
		status: 'active',
		revision: 1,
		createdAt: timestamp,
		updatedAt: timestamp
	},
	{
		id: 'mention:sanitized-chapter',
		resourceId: 'information:clock-stopped',
		chapterId: 'chapter:chapter-000000a1',
		sceneId: 'scene:chapter-purpose',
		anchor: {
			start: 17,
			end: 19,
			revision: 0,
			quote: '脱敏',
			before: '这是',
			after: '章节 1，用于验证'
		},
		displayText: '脱敏',
		status: 'active',
		revision: 1,
		createdAt: timestamp,
		updatedAt: timestamp
	},
	{
		id: 'mention:writing-purpose',
		resourceId: 'plot-thread:missing-notebook',
		chapterId: 'chapter:chapter-000000a1',
		sceneId: 'scene:chapter-purpose',
		anchor: {
			start: 34,
			end: 36,
			revision: 0,
			quote: '写作',
			before: '用于验证中文、标点和',
			after: '字数。'
		},
		displayText: '写作',
		status: 'active',
		revision: 1,
		createdAt: timestamp,
		updatedAt: timestamp
	}
];

const before = await markdownHashes(sourceRoot);
await cp(sourceRoot, targetRoot, { recursive: true, errorOnExist: true, force: false });

for (const [folder, resource] of [
	['characters', character],
	['locations', location],
	['items', item],
	['plot-threads', plotThread],
	['information', information]
]) {
	await writeJson(
		resolve(targetRoot, 'story', folder, `${encodeURIComponent(resource.id)}.json`),
		resource
	);
}
for (const scene of scenes) {
	await writeJson(
		resolve(targetRoot, 'story', 'scenes', `${encodeURIComponent(scene.id)}.json`),
		scene
	);
}
for (const mention of mentions) {
	await writeJson(
		resolve(targetRoot, 'story', 'mentions', `${encodeURIComponent(mention.id)}.json`),
		mention
	);
}
await writeJson(resolve(targetRoot, 'story', 'manifest.json'), {
	schemaVersion: 1,
	projectId: 'project-0000000a',
	createdAt: timestamp,
	updatedAt: timestamp,
	resources: {
		character: [character.id],
		location: [location.id],
		item: [item.id],
		plotThread: [plotThread.id],
		information: [information.id],
		scene: scenes.map(scene => scene.id)
	}
});

const after = await markdownHashes(targetRoot);
const markdownUnchanged = JSON.stringify(before) === JSON.stringify(after);
if (!markdownUnchanged) {
	throw new Error('Markdown changed while preparing Gate B acceptance copy.');
}

process.stdout.write(`${JSON.stringify({
	sourceRoot,
	targetRoot,
	resourceCount: 5,
	sceneCount: scenes.length,
	mentionCount: mentions.length,
	markdownUnchanged,
	markdownHashes: after
}, undefined, 2)}\n`);
