import {
	commitStoryResourceV0ToV1,
	rollbackStoryResourceV0ToV1,
	stageStoryResourceV0ToV1
} from './v0-to-v1';

const timestamp = '2026-07-27T00:00:00.000Z';

describe('Story Resource v0 to v1 migration', () => {
	it('stages legacy names and base defaults without mutating author data', () => {
		const legacy = {
			schemaVersion: 0,
			id: 'character:lin',
			type: 'character',
			name: '林越',
			role: 'protagonist',
			factionIds: [],
			goals: ['找回笔记'],
			desires: [],
			fears: [],
			values: [],
			secrets: []
		};
		const before = structuredClone(legacy);
		const plan = stageStoryResourceV0ToV1(legacy, timestamp);

		expect(legacy).toEqual(before);
		expect(plan.staged).toMatchObject({
			schemaVersion: 1,
			id: 'character:lin',
			title: '林越',
			aliases: [],
			tags: [],
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			evidenceIds: []
		});
		expect(plan.changes).toContain('name→title');
	});

	it('commits a validated copy and can roll back to the exact v0 object', () => {
		const legacy = {
			id: 'item:notebook',
			type: 'item',
			title: '遗失的笔记',
			unique: true,
			restrictions: ['不可复制']
		};
		const plan = stageStoryResourceV0ToV1(legacy, timestamp);
		const committed = commitStoryResourceV0ToV1(plan);
		const rolledBack = rollbackStoryResourceV0ToV1(plan);

		expect(committed).toMatchObject({
			schemaVersion: 1,
			id: 'item:notebook',
			revision: 0
		});
		expect(rolledBack).toEqual(legacy);
		expect(rolledBack).not.toBe(plan.original);
	});

	it('preserves author-secret policy while adding formal version fields', () => {
		const plan = stageStoryResourceV0ToV1({
			id: 'information:identity',
			type: 'information',
			title: '真实身份',
			truthStatement: '沈青使用了化名。',
			authorSecret: true
		}, timestamp);

		expect(plan.staged).toMatchObject({
			authorSecret: true,
			schemaVersion: 1
		});
	});

	it('rejects unsupported or invalid resources before a commit exists', () => {
		const unsupported = {
			schemaVersion: 2,
			id: 'character:lin',
			type: 'character',
			title: '林越'
		};
		expect(() => stageStoryResourceV0ToV1(unsupported, timestamp))
			.toThrow('unsupportedStoryResourceSchema');
		expect(unsupported.schemaVersion).toBe(2);
		expect(() => stageStoryResourceV0ToV1({
			id: 'item:broken',
			type: 'item',
			title: '缺少唯一性字段'
		}, timestamp)).toThrow();
		expect(() => stageStoryResourceV0ToV1({
			id: 'item:broken-time',
			type: 'item',
			title: '无效时间',
			unique: false
		}, 'not-a-date')).toThrow('invalidMigrationTimestamp');
	});
});
