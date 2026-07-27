import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const targetRoot = resolve(process.argv[2] ?? 'tmp/storyforge-gate-c-project-20260727');
const timestamp = '2026-07-27T00:00:00.000Z';

await import('./prepare-storyforge-gate-b-project.mjs');

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

async function sha256(path) {
	const bytes = await readFile(path);
	return createHash('sha256').update(bytes).digest('hex');
}

async function markdownHashes(root) {
	const chapterRoot = resolve(root, 'chapters');
	const names = (await readdir(chapterRoot)).filter(name => name.endsWith('.md')).sort();
	return Object.fromEntries(await Promise.all(names.map(async name => [
		name,
		await sha256(resolve(chapterRoot, name))
	])));
}

const characters = [{
	...base('character:lin-mo', 'character', '林墨', ['主角', '调查者']),
	role: 'protagonist',
	pronouns: '他',
	occupation: '自由撰稿人',
	summary: '追查遗失笔记与旧车站停摆时钟的真相。',
	factionIds: [],
	goals: ['找回遗失的笔记'],
	desires: ['确认父亲失踪的真相'],
	fears: ['自己的记忆并不可靠'],
	values: ['证据优先'],
	secrets: [],
	speechStyle: '句子简短，追问时会重复对方的关键词。',
	evidenceIds: ['evidence:lin-intro']
}, {
	...base('character:shen-qing', 'character', '沈青', ['关键人物', '守护者']),
	role: 'supporting',
	pronouns: '她',
	occupation: '旧站档案管理员',
	summary: '掌握车站停运前最后一夜的部分记录。',
	factionIds: [],
	goals: ['阻止林墨接近封存站台'],
	desires: ['保护仍在站内的人'],
	fears: ['秘密提前暴露'],
	values: ['承诺'],
	secrets: ['知道 23:17 的真正含义'],
	speechStyle: '克制，避免直接回答涉及站台的问题。',
	evidenceIds: ['evidence:shen-intro']
}, {
	...base('character:xu-qing', 'character', '徐青', ['失踪者']),
	role: 'supporting',
	pronouns: '他',
	occupation: '铁路信号员',
	summary: '遗失笔记的原持有人，七年前在旧车站失踪。',
	factionIds: [],
	goals: [],
	desires: [],
	fears: [],
	values: [],
	secrets: [],
	evidenceIds: ['evidence:notebook-owner']
}];

const relationships = [{
	...base('relationship:lin-doubts-shen', 'relationship', '林墨怀疑沈青', ['紧张']),
	sourceCharacterId: 'character:lin-mo',
	targetCharacterId: 'character:shen-qing',
	relationshipType: '怀疑',
	strength: 0.72,
	visibility: 'private',
	description: '林墨认为沈青隐瞒了封存站台的信息。',
	effectiveFrom: {
		chapterId: 'chapter:chapter-000000a1',
		sceneId: 'scene:station-rain',
		narrativeOrder: 1
	},
	evidenceIds: ['evidence:rain-dialogue'],
	history: [{
		effectiveFrom: {
			chapterId: 'chapter:chapter-000000a1',
			sceneId: 'scene:station-rain',
			narrativeOrder: 1
		},
		relationshipType: '戒备',
		strength: 0.45,
		visibility: 'private',
		evidenceIds: ['evidence:first-meeting']
	}]
}, {
	...base('relationship:shen-protects-lin', 'relationship', '沈青保护林墨', ['秘密']),
	sourceCharacterId: 'character:shen-qing',
	targetCharacterId: 'character:lin-mo',
	relationshipType: '保护',
	strength: 0.88,
	visibility: 'secret',
	description: '沈青没有向林墨说明保护他的真正理由。',
	effectiveFrom: {
		chapterId: 'chapter:chapter-000000a1',
		sceneId: 'scene:station-rain',
		narrativeOrder: 2
	},
	evidenceIds: ['evidence:station-rescue'],
	history: []
}, {
	...base('relationship:xu-trusts-lin', 'relationship', '徐青信任林墨', ['过去']),
	sourceCharacterId: 'character:xu-qing',
	targetCharacterId: 'character:lin-mo',
	relationshipType: '信任',
	strength: 0.8,
	visibility: 'public',
	effectiveFrom: {
		chapterId: 'chapter:chapter-000000a2',
		narrativeOrder: 0
	},
	effectiveUntil: {
		chapterId: 'chapter:chapter-000000a4',
		narrativeOrder: 4
	},
	evidenceIds: ['evidence:old-letter'],
	history: []
}];

const timelineEvents = [{
	...base('timeline-event:childhood-clock', 'timelineEvent', '童年时钟停摆', ['回忆']),
	storyStart: '2012-04-03T08:00:00.000Z',
	storyTimeKind: 'exact',
	narrativePosition: {
		chapterId: 'chapter:chapter-000000a5',
		narrativeOrder: 5
	},
	eventType: '背景',
	participantIds: ['character:lin-mo'],
	locationIds: ['location:old-station'],
	itemIds: [],
	predecessorIds: [],
	consequenceIds: ['timeline-event:station-meeting'],
	plotThreadIds: ['plot-thread:missing-notebook'],
	informationIds: [],
	evidenceIds: ['evidence:childhood-memory']
}, {
	...base('timeline-event:letter-arrives', 'timelineEvent', '匿名来信抵达', ['线索']),
	storyStart: '2026-07-26T10:00:00.000Z',
	storyTimeKind: 'exact',
	narrativePosition: {
		chapterId: 'chapter:chapter-000000a3',
		narrativeOrder: 3
	},
	eventType: '线索',
	participantIds: ['character:lin-mo'],
	locationIds: [],
	itemIds: [],
	predecessorIds: [],
	consequenceIds: ['timeline-event:station-meeting'],
	plotThreadIds: ['plot-thread:missing-notebook'],
	informationIds: [],
	evidenceIds: ['evidence:anonymous-letter']
}, {
	...base('timeline-event:station-meeting', 'timelineEvent', '雨夜车站相遇', ['主线']),
	storyStart: '2026-07-27T23:17:00.000Z',
	storyEnd: '2026-07-27T23:32:00.000Z',
	storyTimeKind: 'exact',
	narrativePosition: {
		chapterId: 'chapter:chapter-000000a1',
		sceneId: 'scene:station-rain',
		narrativeOrder: 1
	},
	eventType: '会面',
	participantIds: ['character:lin-mo', 'character:shen-qing'],
	locationIds: ['location:old-station'],
	itemIds: [],
	predecessorIds: ['timeline-event:letter-arrives'],
	consequenceIds: [],
	plotThreadIds: ['plot-thread:missing-notebook'],
	informationIds: ['information:clock-stopped'],
	evidenceIds: ['evidence:station-meeting']
}];

const stateRecords = [{
	id: 'state:lin-location-station',
	characterId: 'character:lin-mo',
	kind: 'location',
	value: '旧车站',
	effectiveFrom: {
		chapterId: 'chapter:chapter-000000a1',
		sceneId: 'scene:station-rain',
		narrativeOrder: 1
	},
	evidenceIds: ['evidence:station-arrival'],
	confirmation: 'confirmed',
	revision: 0
}, {
	id: 'state:lin-goal-notebook',
	characterId: 'character:lin-mo',
	kind: 'currentGoal',
	value: '找回遗失的笔记',
	effectiveFrom: {
		chapterId: 'chapter:chapter-000000a1',
		narrativeOrder: 1
	},
	evidenceIds: ['evidence:chapter-goal'],
	confirmation: 'confirmed',
	revision: 0
}, {
	id: 'state:lin-emotion-alert',
	characterId: 'character:lin-mo',
	kind: 'emotion',
	value: '警觉',
	effectiveFrom: {
		chapterId: 'chapter:chapter-000000a1',
		narrativeOrder: 1
	},
	evidenceIds: ['evidence:rain-dialogue'],
	confirmation: 'pending',
	revision: 0
}, {
	id: 'state:lin-location-conflict',
	characterId: 'character:lin-mo',
	kind: 'location',
	value: '临江旅社',
	effectiveFrom: {
		chapterId: 'chapter:chapter-000000a1',
		narrativeOrder: 1
	},
	evidenceIds: ['evidence:hotel-register'],
	confirmation: 'pending',
	revision: 0
}];

for (const character of characters) {
	await writeJson(
		resolve(targetRoot, 'story', 'characters', `${encodeURIComponent(character.id)}.json`),
		character
	);
}
for (const relationship of relationships) {
	await writeJson(
		resolve(targetRoot, 'story', 'relationships', `${encodeURIComponent(relationship.id)}.json`),
		relationship
	);
}
for (const timelineEvent of timelineEvents) {
	await writeJson(
		resolve(targetRoot, 'story', 'events', `${encodeURIComponent(timelineEvent.id)}.json`),
		timelineEvent
	);
}
await writeJson(resolve(targetRoot, 'story', 'states', 'character-states.json'), stateRecords);

const manifestPath = resolve(targetRoot, 'story', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.updatedAt = timestamp;
manifest.resources.character = characters.map(character => character.id);
manifest.resources.relationship = relationships.map(relationship => relationship.id);
manifest.resources.timelineEvent = timelineEvents.map(event => event.id);
await writeJson(manifestPath, manifest);

const sourceHashes = await markdownHashes(resolve('fixtures/legacy-projects/10-full'));
const targetHashes = await markdownHashes(targetRoot);
const markdownUnchanged = JSON.stringify(sourceHashes) === JSON.stringify(targetHashes);
if (!markdownUnchanged) {
	throw new Error('Markdown changed while preparing Gate C acceptance copy.');
}

process.stdout.write(`${JSON.stringify({
	targetRoot,
	characterCount: characters.length,
	stateCount: stateRecords.length,
	relationshipCount: relationships.length,
	timelineEventCount: timelineEvents.length,
	markdownUnchanged,
	markdownHashes: targetHashes
}, undefined, 2)}\n`);
