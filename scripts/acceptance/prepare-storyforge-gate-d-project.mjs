import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const targetRoot = resolve(process.argv[2] ?? 'tmp/storyforge-gate-d-project-20260727');
await import('./prepare-storyforge-gate-c-project.mjs');

const timestamp = '2026-07-27T00:00:00.000Z';
const position = (order, chapter = 'chapter:chapter-000000a1') => ({ chapterId: chapter, narrativeOrder: order });
const base = (id, type, title, tags = []) => ({
	id, type, title, aliases: [], tags, schemaVersion: 1,
	createdAt: timestamp, updatedAt: timestamp, revision: 1
});
const resources = {
	location: [
		{ ...base('location:gray-city', 'location', '灰城'), locationType: '城市', mapPoint: { x: 48, y: 44 }, travelLinks: [], factionIds: ['faction:railway-bureau'], rules: [], evidenceIds: [] },
		{ ...base('location:old-station', 'location', '旧火车站'), parentLocationId: 'location:gray-city', locationType: '车站', mapPoint: { x: 63, y: 58 }, travelLinks: [{ targetLocationId: 'location:signal-tower', minimumMinutes: 12, mode: '步行' }], factionIds: ['faction:railway-bureau'], rules: ['所有机械钟停在 23:17。'], evidenceIds: ['evidence:station-map'] },
		{ ...base('location:signal-tower', 'location', '信号塔'), parentLocationId: 'location:old-station', locationType: '设施', mapPoint: { x: 78, y: 31 }, travelLinks: [{ targetLocationId: 'location:old-station', minimumMinutes: 12, mode: '步行' }], factionIds: [], rules: [], evidenceIds: ['evidence:tower'] }
	],
	faction: [
		{ ...base('faction:railway-bureau', 'faction', '灰城铁路局'), ideology: '秩序高于个人知情权。', goals: ['封存旧站事故档案'], allyFactionIds: [], enemyFactionIds: [], territoryLocationIds: ['location:old-station'], evidenceIds: ['evidence:seal'] }
	],
	worldRule: [
		{ ...base('world-rule:stopped-clocks', 'worldRule', '停摆时钟法则'), category: 'other', statement: '旧站范围内的机械钟会在 23:17 停止。', exceptions: ['离开旧站十二小时后恢复。'], consequences: ['无法依赖机械钟判断时间。'], effectiveFrom: position(1), evidenceIds: ['evidence:clock-wall'] }
	],
	item: [
		{ ...base('item:missing-notebook', 'item', '遗失的笔记'), itemType: '文书', unique: true, quantityUnit: '本', description: '最后一页写着 23:17。', restrictions: ['不可复制'], plotFunction: '连接徐青失踪与旧站事故。', evidenceIds: ['evidence:notebook-owner'] },
		{ ...base('item:brass-key', 'item', '黄铜钥匙'), itemType: '钥匙', unique: true, quantityUnit: '枚', restrictions: [], plotFunction: '开启封存区域。', evidenceIds: ['evidence:key'] }
	],
	plotThread: [
		{ ...base('plot-thread:missing-notebook', 'plotThread', '遗失笔记'), status: 'active', premise: '林墨追查徐青留下的最后一本笔记。', stakes: '笔记可能证明事故并非意外。', dramaticQuestion: '谁拿走了笔记？', startPosition: position(1), targetResolution: position(12, 'chapter:chapter-000000a5'), participantIds: ['character:lin-mo'], sceneIds: ['scene:station-rain'], evidenceIds: ['evidence:anonymous-letter'] },
		{ ...base('plot-thread:station-secret', 'plotThread', '封存站台'), status: 'at-risk', premise: '被封存的第三站台仍在运行。', stakes: '秘密可能威胁灰城。', dramaticQuestion: '广播在呼叫谁？', startPosition: position(3), targetResolution: position(7, 'chapter:chapter-000000a4'), participantIds: ['character:shen-qing'], sceneIds: [], evidenceIds: ['evidence:broadcast'] }
	],
	foreshadowing: [
		{ ...base('foreshadowing:clock-2317', 'foreshadowing', '23:17 的停摆时钟'), status: 'reminded', plantedAt: position(1), surfaceMeaning: '设备老化。', trueMeaning: '事故时间被人为固定。', reminderPositions: [position(5, 'chapter:chapter-000000a3')], plannedPayoffAt: position(12, 'chapter:chapter-000000a5'), readerVisibility: 0.45, plotThreadIds: ['plot-thread:missing-notebook'], evidenceIds: ['evidence:clock-wall'] }
	],
	information: [
		{ ...base('information:clock-stopped', 'information', '时钟停摆真相'), truthStatement: '23:17 是徐青切断主信号的时刻。', truthStatus: 'confirmed', authorSecret: true, excludeFromAiByDefault: true, truthEffectiveFrom: position(6, 'chapter:chapter-000000a3'), readerRevealAt: position(12, 'chapter:chapter-000000a5'), evidenceIds: ['evidence:clock-note'] },
		{ ...base('information:notebook-owner', 'information', '笔记原持有人'), truthStatement: '遗失笔记属于徐青。', truthStatus: 'confirmed', authorSecret: false, excludeFromAiByDefault: false, truthEffectiveFrom: position(1), readerRevealAt: position(3, 'chapter:chapter-000000a2'), evidenceIds: ['evidence:notebook-owner'] }
	]
};
const folders = { location: 'locations', faction: 'factions', worldRule: 'world-rules', item: 'items', plotThread: 'plot-threads', foreshadowing: 'foreshadowing', information: 'information' };
async function writeJson(path, value) {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
}
for (const [type, entries] of Object.entries(resources)) {
	for (const resource of entries) {
		await writeJson(resolve(targetRoot, 'story', folders[type], `${encodeURIComponent(resource.id)}.json`), resource);
	}
}
const itemStates = [
	{ id: 'item-state:notebook-xu', itemId: 'item:missing-notebook', action: 'acquired', quantity: 1, holderCharacterId: 'character:xu-qing', condition: '受潮', effectiveFrom: position(0), effectiveUntil: position(3), evidenceIds: ['evidence:notebook-owner'], confirmation: 'confirmed', revision: 0 },
	{ id: 'item-state:notebook-lost', itemId: 'item:missing-notebook', action: 'lost', quantity: 1, locationId: 'location:old-station', condition: '下落不明', effectiveFrom: position(3), evidenceIds: ['evidence:anonymous-letter'], confirmation: 'confirmed', revision: 0 }
];
const knowledgeStates = [
	{ id: 'knowledge-state:reader-owner', informationId: 'information:notebook-owner', subject: 'reader', status: 'knows', effectiveFrom: position(3), evidenceIds: ['evidence:notebook-owner'], confirmation: 'confirmed', revision: 0 },
	{ id: 'knowledge-state:shen-clock', informationId: 'information:clock-stopped', subject: 'character:shen-qing', status: 'knows', effectiveFrom: position(1), evidenceIds: ['evidence:clock-note'], confirmation: 'confirmed', revision: 0 }
];
await writeJson(resolve(targetRoot, 'story/states/item-states.json'), itemStates);
await writeJson(resolve(targetRoot, 'story/states/knowledge-states.json'), knowledgeStates);
const manifestPath = resolve(targetRoot, 'story/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const [type, entries] of Object.entries(resources)) {
	manifest.resources[type] = entries.map(resource => resource.id);
}
manifest.updatedAt = timestamp;
await writeJson(manifestPath, manifest);
process.stdout.write(`${JSON.stringify({
	targetRoot,
	resourceCounts: Object.fromEntries(Object.entries(resources).map(([type, entries]) => [type, entries.length])),
	itemStateCount: itemStates.length,
	knowledgeStateCount: knowledgeStates.length,
	markdownUnchanged: true
}, undefined, 2)}\n`);
