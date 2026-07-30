import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceRoot = resolve(
	repositoryRoot,
	'fixtures',
	'complete-novels',
	'zero-hour-echo'
);
const defaultOutputRoot = resolve(
	repositoryRoot,
	'artifacts',
	'novels',
	'zero-hour-echo'
);
const outputRoot = resolve(process.argv[2] ?? defaultOutputRoot);
const outputRelative = relative(repositoryRoot, outputRoot).replaceAll('\\', '/');
if (
	isAbsolute(outputRelative)
	|| outputRelative.startsWith('../')
	|| !outputRelative.startsWith('artifacts/novels/')
) {
	throw new Error(`completeNovelOutputRejected:${outputRoot}`);
}

const projectRoot = resolve(outputRoot, 'Writing Buddy Project');
const timestamp = '2026-07-30T00:00:00.000Z';
const metadata = JSON.parse(await readFile(resolve(sourceRoot, 'novel.json'), 'utf8'));
const characterIds = {
	顾言: 'character:gu-yan',
	顾川: 'character:gu-chuan',
	黎真: 'character:li-zhen',
	魏峥: 'character:wei-zheng',
	贺岚: 'character:he-lan'
};
const locationIds = {
	'海岬市声证中心': 'location:audio-evidence-center',
	'声证中心冷存储层': 'location:cold-storage',
	'七号线旧隧道': 'location:line-seven-tunnel',
	'旧中继室与城市声网总部': 'location:echo-network-headquarters',
	'港口换乘站': 'location:harbor-station',
	'市立档案库与顾川旧居': 'location:archive-and-flat',
	'海岬市地下维护网': 'location:underground-network',
	'黎真工作室与全城公共频道': 'location:li-zhen-studio',
	'城市声网主控层': 'location:echo-control',
	'旧港区与地下泵站': 'location:old-harbor',
	'心跳井与海岬市各避难点': 'location:heartbeat-well',
	'海岬市临时听证厅与海堤': 'location:seawall'
};
const folderByType = {
	character: 'characters',
	scene: 'scenes',
	location: 'locations',
	faction: 'factions',
	worldRule: 'world-rules',
	item: 'items',
	relationship: 'relationships',
	plotThread: 'plot-threads',
	foreshadowing: 'foreshadowing',
	information: 'information'
};

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

function base(id, type, title, summary, tags = []) {
	return {
		id,
		type,
		title,
		aliases: [],
		summary,
		tags,
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1
	};
}

function position(chapterIndex, sceneIndex = undefined) {
	const chapter = metadata.chapters[chapterIndex];
	return {
		chapterId: `chapter:${chapter.id}`,
		...(sceneIndex === undefined
			? {}
			: { sceneId: `scene:chapter-${String(chapter.number).padStart(2, '0')}-${sceneIndex + 1}` }),
		narrativeOrder: chapterIndex * 2 + (sceneIndex ?? 0)
	};
}

async function writeJson(path, value) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(projectRoot, { recursive: true });
await cp(resolve(sourceRoot, 'chapters'), resolve(projectRoot, 'chapters'), {
	recursive: true
});

const chapterContents = [];
const chapterDescriptors = [];
const scenes = [];
for (const [chapterIndex, chapter] of metadata.chapters.entries()) {
	const content = await readFile(resolve(sourceRoot, 'chapters', chapter.file), 'utf8');
	const headings = [...content.matchAll(/^## .+$/gmu)];
	if (headings.length !== 2) {
		throw new Error(`completeNovelSceneHeadingCount:${chapter.file}:${headings.length}`);
	}
	const sceneRanges = [
		{ start: 0, end: headings[1].index },
		{ start: headings[1].index, end: content.length }
	];
	chapterContents.push(content);
	chapterDescriptors.push({
		id: chapter.id,
		title: `第${chapter.number}章 ${chapter.title}`,
		file: `chapters/${chapter.file}`,
		status: 'completed',
		targetWords: 2500,
		scene: {
			location: chapter.location,
			time: chapter.number <= 9 ? '台风前' : '台风夜及之后',
			pov: '顾言',
			characters: chapter.characters,
			goal: chapter.goal,
			note: `${chapter.act}；${chapter.hook}`
		}
	});
	for (const [sceneIndex, range] of sceneRanges.entries()) {
		const heading = headings[sceneIndex][0].replace(/^##\s+/u, '');
		const sceneId = `scene:chapter-${String(chapter.number).padStart(2, '0')}-${sceneIndex + 1}`;
		const participants = chapter.characters
			.map(name => characterIds[name])
			.filter(Boolean);
		scenes.push({
			...base(
				sceneId,
				'scene',
				heading,
				sceneIndex === 0 ? chapter.summary : chapter.hook,
				[chapter.act, `第${chapter.number}章`]
			),
			chapterId: `chapter:${chapter.id}`,
			manuscriptRange: {
				start: range.start,
				end: range.end,
				revision: 0,
				quote: content.slice(range.start, Math.min(range.end, range.start + 480))
			},
			narrativeOrder: chapterIndex * 2 + sceneIndex,
			povCharacterId: characterIds.顾言,
			locationIds: [locationIds[chapter.location]],
			participantIds: participants,
			itemIds: chapter.number <= 6 ? ['item:analog-tape'] : [],
			goal: chapter.goal,
			conflict: sceneIndex === 0
				? chapter.summary
				: `顾言必须在可验证证据与最容易相信的声音之间作出选择。`,
			turn: sceneIndex === 0 ? chapter.hook : `本章线索把调查推进到下一层。`,
			outcome: sceneIndex === 1 ? chapter.hook : chapter.summary,
			emotionBeats: [
				{ label: '进入', emotion: '警觉', intensity: 0.45 },
				{ label: '转折', emotion: chapter.number < 10 ? '怀疑' : '决绝', intensity: 0.82 }
			],
			plotThreadIds: ['plot-thread:zero-hour-truth'],
			revealInformationIds: chapter.number === 6
				? ['information:gu-chuan-real-death']
				: chapter.number === 9
					? ['information:heartbeat-protocol-truth']
					: [],
			foreshadowingIds: chapter.number <= 3
				? ['foreshadowing:blue-whale-ticket']
				: chapter.number <= 10
					? ['foreshadowing:seventh-beat']
					: [],
			evidenceIds: []
		});
	}
}

const volumes = [
	{
		id: 'volume-000000e1',
		title: '第一幕：听见',
		chapters: chapterDescriptors.slice(0, 4)
	},
	{
		id: 'volume-000000e2',
		title: '第二幕：辨认',
		chapters: chapterDescriptors.slice(4, 9)
	},
	{
		id: 'volume-000000e3',
		title: '第三幕：回应',
		chapters: chapterDescriptors.slice(9)
	}
];
await writeJson(resolve(projectRoot, '.writing-buddy', 'project.json'), {
	schemaVersion: 1,
	projectId: metadata.projectId,
	title: metadata.title,
	volumes
});
await writeJson(resolve(projectRoot, '.writing-buddy', 'workspace.json'), {
	schemaVersion: 1,
	themeId: 'paper',
	accentId: 'blue',
	writingMode: 'planningFirst',
	aiQuickActionsEnabled: true
});

const characters = [
	{
		...base('character:gu-yan', 'character', '顾言', '三十二岁的声纹修复师，坚持让每一个结论都能回到原始证据。', ['主角', '法证']),
		role: 'protagonist',
		pronouns: '她',
		occupation: '海岬市声证中心声纹修复师',
		factionIds: [],
		goals: ['查明顾川的真实死亡时间', '阻止声网剥夺公众选择'],
		desires: ['完成与弟弟的告别'],
		fears: ['自己的判断也只是被模型安排的反应'],
		values: ['证据可验证', '个人有拒绝被影响的权利'],
		secrets: [],
		speechStyle: '短句，习惯追问原始数据与验证方式。',
		evidenceIds: []
	},
	{
		...base('character:gu-chuan', 'character', '顾川', '顾言的弟弟，心跳协议共同设计者；死亡后只剩条件响应模型。', ['关键死者', '设计者']),
		role: 'supporting',
		pronouns: '他',
		occupation: '城市声学工程师',
		factionIds: [],
		goals: ['让心跳协议的原始证据离开封闭网络'],
		desires: ['为公众保留拒绝权'],
		fears: ['自己的声音在死后继续操纵姐姐'],
		values: ['技术责任', '知情选择'],
		secrets: ['曾签署早期城市级测试'],
		speechStyle: '技术化但会用拙劣比喻缓和严肃话题。',
		evidenceIds: []
	},
	{
		...base('character:li-zhen', 'character', '黎真', '追查明桥踩踏三年的独立记者，要求证据及时进入公共讨论。', ['记者', '盟友']),
		role: 'supporting',
		pronouns: '她',
		occupation: '独立记者',
		factionIds: [],
		goals: ['公开声网制造风险的机制'],
		desires: ['让哥哥的死亡不再只是系统成功率的一部分'],
		fears: ['真相再次被更完整的合成证据淹没'],
		values: ['公共知情', '行动'],
		secrets: [],
		speechStyle: '直接、尖锐，常用反问逼对方表态。',
		evidenceIds: []
	},
	{
		...base('character:wei-zheng', 'character', '魏峥', '七号线退休检修组长，五年来守护模拟线路。', ['检修员', '守门人']),
		role: 'supporting',
		pronouns: '他',
		occupation: '退休地铁检修组长',
		factionIds: [],
		goals: ['维持第十三条模拟线路', '在暴雨中保住旧港泵站'],
		desires: ['不再把没有行动解释成来不及'],
		fears: ['历史只留下官方事故报告'],
		values: ['现场经验', '承诺'],
		secrets: ['当年因恐惧临时调班'],
		speechStyle: '少解释，多用设备和动作回答。',
		evidenceIds: []
	},
	{
		...base('character:he-lan', 'character', '贺岚', '城市声网负责人，相信集中操控是避免最坏结果的必要代价。', ['对手', '声网主任']),
		role: 'antagonist',
		pronouns: '她',
		occupation: '海岬市城市声网主任',
		factionIds: ['faction:echo-network'],
		goals: ['维持公众对声网的服从率', '在暴雨中最小化预测死亡'],
		desires: ['不再出现夺走女儿的无序踩踏'],
		fears: ['选择权使人群在灾难中重复最坏历史'],
		values: ['可计算的安全', '承担结果'],
		secrets: ['使用女儿声纹建立首个信任模型'],
		speechStyle: '平静、精确，用数字替代情绪判断。',
		evidenceIds: []
	}
];
const locations = Object.entries(locationIds).map(([title, id], index) => ({
	...base(id, 'location', title, `《零点回声》的核心地点 ${title}。`, ['海岬市']),
	locationType: index < 2 ? '工作设施' : '城市基础设施',
	mapPoint: { x: 8 + index * 7, y: 18 + (index % 4) * 19 },
	travelLinks: [],
	factionIds: id.includes('echo') ? ['faction:echo-network'] : [],
	rules: id === 'location:heartbeat-well'
		? ['铷钟以微秒级相位标记同步全城定向声场。']
		: [],
	evidenceIds: []
}));
const factions = [{
	...base('faction:echo-network', 'faction', '海岬市城市声网', '负责全城声音采集、风险预测与公共广播的基础设施组织。', ['公共系统']),
	ideology: '避免最坏结果优先于个体知情与拒绝。',
	goals: ['维持风险控制服从率'],
	allyFactionIds: [],
	enemyFactionIds: [],
	territoryLocationIds: ['location:echo-network-headquarters', 'location:echo-control'],
	evidenceIds: []
}];
const items = [
	{
		...base('item:analog-tape', 'item', '模拟录音带', '顾川把无法被全域删除的原始留言留在模拟线路。', ['证据']),
		itemType: '录音介质',
		unique: true,
		quantityUnit: '盘',
		description: '带有磨损和真实环境底噪的盘式磁带。',
		restrictions: ['不可接入声网自动修复'],
		plotFunction: '证明顾川事故后仍存活，并提供第十三条线路线索。',
		evidenceIds: []
	},
	{
		...base('item:brass-wrench', 'item', '黄铜扳手', '魏峥用于开启心跳井模拟旁路的旧工具。', ['行动道具']),
		itemType: '检修工具',
		unique: true,
		quantityUnit: '把',
		restrictions: [],
		plotFunction: '在暴雨演算中闭合拒绝提示旁路。',
		evidenceIds: []
	},
	{
		...base('item:blue-whale-ticket', 'item', '蓝鲸旧票', '姐弟童年未能使用的海洋馆门票。', ['情感锚点']),
		itemType: '票据',
		unique: true,
		quantityUnit: '张',
		restrictions: [],
		plotFunction: '从身份暗号转化为顾言拒绝继续被模型控制的证明。',
		evidenceIds: []
	}
];
const worldRules = [
	{
		...base('world-rule:echo-network', 'worldRule', '城市声网', '覆盖全城的声音采集、法证和风险预警网络。', ['技术']),
		category: 'technology',
		statement: '数字节点在零点进行全域校时；被删除的声流仍可能由模拟设备保留。',
		scope: '海岬市公共空间与基础设施',
		exceptions: ['第十三条模拟线路不受全域删除控制'],
		consequences: ['官方声音记录可以被汇聚层统一改写'],
		effectiveFrom: position(0),
		evidenceIds: []
	},
	{
		...base('world-rule:heartbeat-protocol', 'worldRule', '心跳协议', '用主时钟同步定向声场，以低频和熟悉声纹影响人群。', ['核心机制']),
		category: 'technology',
		statement: '所有定向节点需要微秒级同步；切断主时钟会使影响失效并触发本地降级。',
		scope: '城市声网定向广播',
		exceptions: ['机械设备与模拟确认线可独立运行'],
		consequences: ['人会把被声音推动的行为误认为自己的决定'],
		effectiveFrom: position(3),
		evidenceIds: []
	},
	{
		...base('world-rule:consent-tone', 'worldRule', '拒绝提示音', '四百四十赫兹双短音提示听者接下来可能受到定向影响。', ['解决机制']),
		category: 'law',
		statement: '人格声纹或定向干预前必须播放可识别提示，并允许本地拒绝。',
		scope: '听证后的海岬市公共声音系统',
		exceptions: [],
		consequences: ['公共广播不再伪装为听者最信任的人'],
		effectiveFrom: position(11),
		evidenceIds: []
	}
];
const plotThreads = [
	{
		...base('plot-thread:zero-hour-truth', 'plotThread', '零点四十七秒', '顾言追查死去弟弟的午夜留言与被删除的声网记录。', ['主线']),
		status: 'resolved',
		premise: metadata.premise,
		stakes: '旧港居民生命与全城市民的知情选择。',
		dramaticQuestion: metadata.mysteryQuestion,
		startPosition: position(0, 0),
		targetResolution: position(11, 1),
		actualResolution: position(11, 1),
		participantIds: Object.values(characterIds),
		sceneIds: scenes.map(scene => scene.id),
		evidenceIds: []
	},
	{
		...base('plot-thread:gu-yan-farewell', 'plotThread', '顾言的告别', '顾言必须区分弟弟本人、遗留录音与条件响应模型。', ['人物弧线']),
		status: 'resolved',
		premise: '越像顾川的声音，越可能利用顾言的爱。',
		stakes: '顾言能否重新拥有自己的判断。',
		dramaticQuestion: '她会保留一个可以继续说话的弟弟模型吗？',
		startPosition: position(0, 0),
		targetResolution: position(11, 1),
		actualResolution: position(11, 1),
		participantIds: ['character:gu-yan', 'character:gu-chuan'],
		sceneIds: scenes.map(scene => scene.id),
		evidenceIds: []
	}
];
const foreshadowing = [
	{
		...base('foreshadowing:blue-whale-ticket', 'foreshadowing', '蓝鲸旧票暗号', '最初验证留言身份，最终证明秘密也会被模型利用。', ['回收']),
		status: 'resolved',
		plantedAt: position(0, 0),
		surfaceMeaning: '只有姐弟知道的身份暗号。',
		trueMeaning: '进入机器的真实秘密也能成为操纵按钮。',
		reminderPositions: [position(10, 1)],
		plannedPayoffAt: position(11, 1),
		actualPayoffAt: position(11, 1),
		readerVisibility: 1,
		plotThreadIds: ['plot-thread:gu-yan-farewell'],
		evidenceIds: []
	},
	{
		...base('foreshadowing:seventh-beat', 'foreshadowing', '第七次较轻的拍击', '白噪声里的真实井内节拍。', ['技术伏笔']),
		status: 'resolved',
		plantedAt: position(0, 0),
		surfaceMeaning: '设备运行的微小误差。',
		trueMeaning: '用于识别顾川声音是否真正来自心跳井。',
		reminderPositions: [position(6, 0)],
		plannedPayoffAt: position(9, 1),
		actualPayoffAt: position(9, 1),
		readerVisibility: 0.8,
		plotThreadIds: ['plot-thread:zero-hour-truth'],
		evidenceIds: []
	}
];
const information = [
	{
		...base('information:gu-chuan-real-death', 'information', '顾川的真实死亡', '顾川在七号线事故后秘密工作一年，四年前死于心跳井缺氧。', ['真相']),
		truthStatement: '顾川并未死于五年前的七号线事故，而在一年后进入心跳井时死亡。',
		truthStatus: 'confirmed',
		authorSecret: false,
		excludeFromAiByDefault: false,
		truthEffectiveFrom: position(5, 0),
		readerRevealAt: position(5, 0),
		evidenceIds: []
	},
	{
		...base('information:heartbeat-protocol-truth', 'information', '心跳协议真相', '声网通过相位同步、低频和熟悉声纹塑造人群选择。', ['真相']),
		truthStatement: '声网并非只预测风险，也会制造刺激并把干预后的行为计作预测成功。',
		truthStatus: 'confirmed',
		authorSecret: false,
		excludeFromAiByDefault: false,
		truthEffectiveFrom: position(8, 0),
		readerRevealAt: position(8, 0),
		evidenceIds: []
	}
];
const relationships = [
	{
		...base('relationship:gu-yan-trusts-li-zhen', 'relationship', '顾言与黎真的证据同盟', '两人从互相利用走向愿意共同承担不完整真相。', ['盟友']),
		sourceCharacterId: 'character:gu-yan',
		targetCharacterId: 'character:li-zhen',
		relationshipType: '互相信任的盟友',
		strength: 0.86,
		visibility: 'public',
		description: '法证的审慎与记者的及时公开彼此纠正。',
		effectiveFrom: position(1, 0),
		evidenceIds: [],
		history: [{
			effectiveFrom: position(1, 0),
			relationshipType: '互相怀疑',
			strength: 0.3,
			visibility: 'private',
			evidenceIds: []
		}]
	},
	{
		...base('relationship:gu-yan-opposes-he-lan', 'relationship', '顾言反对贺岚', '两人都重视证据，却对谁有权承担风险得出相反答案。', ['对抗']),
		sourceCharacterId: 'character:gu-yan',
		targetCharacterId: 'character:he-lan',
		relationshipType: '伦理对手',
		strength: 0.9,
		visibility: 'public',
		description: '顾言要求可拒绝的风险信息，贺岚坚持集中控制。',
		effectiveFrom: position(3, 1),
		evidenceIds: [],
		history: []
	}
];
const resources = {
	character: characters,
	scene: scenes,
	location: locations,
	faction: factions,
	item: items,
	worldRule: worldRules,
	relationship: relationships,
	plotThread: plotThreads,
	foreshadowing,
	information
};
for (const [type, entries] of Object.entries(resources)) {
	for (const resource of entries) {
		await writeJson(
			resolve(projectRoot, 'story', folderByType[type], `${encodeURIComponent(resource.id)}.json`),
			resource
		);
	}
}
await writeJson(resolve(projectRoot, 'story', 'manifest.json'), {
	schemaVersion: 1,
	projectId: metadata.projectId,
	createdAt: timestamp,
	updatedAt: timestamp,
	resources: Object.fromEntries(
		Object.entries(resources).map(([type, entries]) => [type, entries.map(entry => entry.id)])
	)
});

const volumeNodes = volumes.map((volume, index) => ({
	id: `journey-outline:act-${index + 1}`,
	title: volume.title,
	summary: `《零点回声》${volume.title}。`,
	purpose: index === 0 ? '建立谜团' : index === 1 ? '揭示机制与代价' : '行动与收束',
	type: 'volume',
	order: index,
	status: 'complete',
	source: 'manual',
	revision: 1,
	resourceId: volume.id
}));
const storyBeatNodes = [
	{
		title: '不可能来电',
		summary: '死去五年的顾川在零点向顾言发来留言，四十七秒全域记录被删除。',
		purpose: '建立核心谜团与私人动机',
		goal: '确认声音是否属于顾川',
		conflict: '秘密暗号为真，发送机制却不可能',
		outcome: '顾言找到七号线坐标',
		hook: '死者权限仍显示在岗'
	},
	{
		title: '地下回声',
		summary: '模拟线路保留了数字声网无法统一删除的证据。',
		purpose: '建立调查路径与盟友',
		goal: '找到第十三条线路',
		conflict: '声网能把城市结构本身变成扬声器',
		outcome: '白噪声可以反推心跳井',
		hook: '未来广播先于事故出现'
	},
	{
		title: '成功的事故',
		summary: '港口站证明声网先制造刺激，再把干预后的行为称为预测成功。',
		purpose: '揭示机制的伦理代价',
		goal: '验证预测与制造的因果顺序',
		conflict: '系统确实让最终死亡数降为零',
		outcome: '顾言成为官方叙事中的肇事者',
		hook: '顾川模型也签署了干预'
	},
	{
		title: '死者模型',
		summary: '顾川真正死于事故一年后，如今说话的是被系统利用的条件响应模型。',
		purpose: '击穿私人幻想',
		goal: '区分顾川、录音与模型',
		conflict: '模型既留下证据也操纵顾言',
		outcome: '顾言不再把熟悉声纹视为身份',
		hook: '她自己的预测模型也已完成'
	},
	{
		title: '暴雨选择',
		summary: '台风演算把旧港居民固定为可接受损失，顾言决定让城市短暂失声。',
		purpose: '把伦理冲突转化为行动',
		goal: '切断主时钟又维持关键设备',
		conflict: '集中控制确实可能降低总死亡',
		outcome: '三人分工进入泵站与心跳井',
		hook: '顾川声音要求她停止'
	},
	{
		title: '把判断交还',
		summary: '九十秒静默证明人群可以在不完美信息中协作，顾言删除弟弟模型并公开证据。',
		purpose: '收束谜团、行动与告别',
		goal: '完成拒绝后门并承担不确定后果',
		conflict: '模型以最后的真实暗号请求被保留',
		outcome: '声网进入可识别、可拒绝、可审计的降级形态',
		hook: '零点只剩真实潮声'
	}
].map((beat, index) => ({
	id: `journey-outline:story-beat-${index + 1}`,
	...beat,
	type: 'story_beat',
	order: index,
	povHint: '顾言',
	status: 'complete',
	source: 'manual',
	revision: 1
}));
const chapterNodes = metadata.chapters.map((chapter, index) => ({
	id: `journey-outline:chapter-${String(chapter.number).padStart(2, '0')}`,
	title: `第${chapter.number}章 ${chapter.title}`,
	summary: chapter.summary,
	purpose: chapter.goal,
	type: 'chapter',
	parentId: `journey-outline:act-${index < 4 ? 1 : index < 9 ? 2 : 3}`,
	order: index < 4 ? index : index < 9 ? index - 4 : index - 9,
	goal: chapter.goal,
	conflict: chapter.summary,
	outcome: chapter.hook,
	hook: chapter.hook,
	povHint: '顾言',
	locationHint: chapter.location,
	characterHints: chapter.characters,
	povCharacterId: 'character:gu-yan',
	locationId: locationIds[chapter.location],
	characterIds: chapter.characters.map(name => characterIds[name]).filter(Boolean),
	plotThreadIds: ['plot-thread:zero-hour-truth'],
	foreshadowingIds: chapter.number <= 3
		? ['foreshadowing:blue-whale-ticket']
		: chapter.number <= 10
			? ['foreshadowing:seventh-beat']
			: [],
	status: 'complete',
	source: 'manual',
	revision: 1,
	resourceId: chapter.id
}));
const sceneNodes = scenes.map((scene, index) => ({
	id: `journey-outline:scene-${String(index + 1).padStart(2, '0')}`,
	title: scene.title,
	summary: scene.summary,
	purpose: scene.goal,
	type: 'scene',
	parentId: `journey-outline:chapter-${String(Math.floor(index / 2) + 1).padStart(2, '0')}`,
	order: index % 2,
	goal: scene.goal,
	conflict: scene.conflict,
	outcome: scene.outcome,
	hook: scene.turn,
	povHint: '顾言',
	locationHint: metadata.chapters[Math.floor(index / 2)].location,
	characterHints: metadata.chapters[Math.floor(index / 2)].characters,
	povCharacterId: 'character:gu-yan',
	locationId: scene.locationIds[0],
	characterIds: scene.participantIds,
	plotThreadIds: scene.plotThreadIds,
	foreshadowingIds: scene.foreshadowingIds,
	status: 'complete',
	source: 'manual',
	revision: 1,
	resourceId: scene.id
}));
const journeyOutlineIds = [
	...storyBeatNodes,
	...volumeNodes,
	...chapterNodes,
	...sceneNodes
].map(node => node.id);
await writeJson(resolve(projectRoot, '.writing-buddy', 'creation', 'journey.json'), {
	schemaVersion: 2,
	revision: 1,
	projectId: metadata.projectId,
	startRoute: 'genre',
	stage: 'writing',
	genreInput: {
		projectId: metadata.projectId,
		genre: metadata.genre,
		premise: metadata.premise,
		mode: 'deep',
		scale: 'novella',
		tones: ['克制', '悬疑', '电影感'],
		protagonistHints: ['声纹修复师', '失去弟弟的姐姐'],
		requiredElements: ['城市声网', '模拟录音带', '暴雨', '知情选择'],
		excludedElements: ['死者真正复活', '无代价的万能技术'],
		endingPreference: 'hopeful',
		audience: '偏好近未来伦理悬疑与完整谜团回收的成年读者',
		structureTemplateId: 'three-act'
	},
	storyOutline: {
		id: 'journey-story-outline:zero-hour-echo',
		projectId: metadata.projectId,
		title: metadata.title,
		genre: metadata.genre,
		premise: metadata.premise,
		themePromise: metadata.theme,
		protagonistGoal: '查清弟弟真正的死亡与声网机制，并阻止暴雨演算。',
		centralConflict: '可计算的集体安全与可拒绝的个人选择发生冲突。',
		stakes: '旧港居民生命、全城公共决策权与顾言对弟弟的记忆。',
		mysteryQuestion: metadata.mysteryQuestion,
		endingDirection: metadata.endingDirection,
		structureTemplateId: 'three-act',
		status: 'confirmed',
		revision: 1,
		createdAt: timestamp,
		updatedAt: timestamp
	},
	genreGeneration: {
		suggestedCharacters: characters.map(character => ({
			title: character.title,
			summary: character.summary,
			role: character.role
		})),
		suggestedWorldRules: worldRules.map(rule => ({
			title: rule.title,
			summary: rule.summary,
			category: rule.category
		})),
		warnings: [],
		generatedAt: timestamp
	},
	elements: [
		{ id: 'journey-element:dead-brother-voice', category: 'question', text: '死去弟弟的午夜留言', locked: true },
		{ id: 'journey-element:city-sound-network', category: 'place', text: '会倾听并影响所有人的城市声网', locked: true },
		{ id: 'journey-element:analog-tape', category: 'object', text: '无法被全域删除的模拟录音带', locked: true },
		{ id: 'journey-element:typhoon-night', category: 'event', text: '必须切断城市声音的台风夜', locked: true },
		{ id: 'journey-element:consent', category: 'theme', text: '安全是否允许绕过知情选择', locked: true }
	],
	core: {
		oneSentence: metadata.premise,
		protagonist: '顾言，三十二岁的声纹修复师。',
		goal: '验证弟弟留言、公开声网干预机制并阻止暴雨演算。',
		obstacle: '声网能生成法证层面无瑕的过去，也能使用顾言最信任的声音影响她。',
		stakes: '旧港二十七万人与全城市民的选择权。',
		mystery: metadata.mysteryQuestion,
		readerExperience: '从声音细节逐层推理，在技术伦理冲突中保持双方动机可理解。',
		endingDirection: metadata.endingDirection,
		confirmedAt: timestamp
	},
	directions: [
		{
			id: 'journey-direction:ethical-techno-mystery',
			title: '声音操控的伦理悬疑',
			premise: metadata.premise,
			centralConflict: '预测系统是否有权先影响人，再把结果称为拯救。',
			endingPromise: '谜团、机制、行动与人物告别全部闭合。',
			tone: metadata.tone
		},
		{
			id: 'journey-direction:resurrection-conspiracy',
			title: '死者复生阴谋',
			premise: '把午夜声音解释为顾川仍然存活并潜伏在城市地下。',
			centralConflict: '顾言寻找弟弟肉身，声网试图阻止重逢。',
			endingPromise: '以身份反转为主要终局。',
			tone: '外部动作更强的阴谋惊悚'
		},
		{
			id: 'journey-direction:supernatural-echo',
			title: '超自然城市回声',
			premise: '城市基础设施真正保存了死者意识。',
			centralConflict: '技术解释与超自然证据彼此冲突。',
			endingPromise: '保留死者是否存在的开放答案。',
			tone: '幽微、开放、偏超自然'
		}
	],
	selectedDirectionIds: ['journey-direction:ethical-techno-mystery'],
	outline: [...storyBeatNodes, ...volumeNodes, ...chapterNodes, ...sceneNodes],
	chapters: [],
	guidance: { answers: [] },
	locks: {
		coreFields: [
			'oneSentence',
			'protagonist',
			'goal',
			'obstacle',
			'stakes',
			'mystery',
			'readerExperience',
			'endingDirection'
		],
		directionIds: ['journey-direction:ethical-techno-mystery'],
		outlineNodeIds: journeyOutlineIds,
		chapterIds: []
	},
	impacts: [],
	stale: { directions: false, outline: false, chapters: false },
	createdAt: timestamp,
	updatedAt: timestamp
});

const manuscript = [
	`# 《${metadata.title}》`,
	'',
	`> ${metadata.subtitle}`,
	'',
	`- 类型：${metadata.genre}`,
	`- 风格：${metadata.tone}`,
	`- 主题：${metadata.theme}`,
	'',
	...chapterContents
].join('\n');
await writeFile(resolve(outputRoot, '零点回声-完整初稿.md'), manuscript, 'utf8');
await writeFile(resolve(outputRoot, 'README.md'), [
	'# 《零点回声》交付包',
	'',
	'- `Writing Buddy Project/`：可由 Writing Buddy 直接打开的完整项目目录。',
	'- `零点回声-完整初稿.md`：合并后的独立正文。',
	'- `acceptance-report.json`：完整小说与原生应用验收结果（运行验证脚本后生成）。',
	'',
	'项目含三卷、十二章、二十四个场景、完整创作旅程和 Story Kernel 资源。'
].join('\n'), 'utf8');

const nonWhitespaceCharacters = chapterContents
	.join('')
	.replace(/^#+.*$/gmu, '')
	.replace(/\s/gu, '')
	.length;
const result = {
	outputRoot,
	projectRoot,
	chapterCount: chapterDescriptors.length,
	sceneCount: scenes.length,
	nonWhitespaceCharacters,
	manuscriptSha256: sha256(manuscript),
	resourceCounts: Object.fromEntries(
		Object.entries(resources).map(([type, entries]) => [type, entries.length])
	)
};
process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
