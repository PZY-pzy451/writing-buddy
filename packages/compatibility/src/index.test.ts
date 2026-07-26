import { parseProjectManifest, serializeProjectManifest } from './index';

const project = {
	schemaVersion: 1,
	projectId: 'project-a11ce001',
	title: '停摆的时钟',
	volumes: [{
		id: 'volume-a11ce001',
		title: '第一卷',
		chapters: [{
			id: 'chapter-a11ce001',
			title: '第一章',
			file: 'chapters/chapter-001.md',
			scene: { location: '旧车站', time: '23:17', pov: '林墨', characters: ['林墨'], goal: '', note: '' }
		}]
	}]
};

describe('compatibility kernel', () => {
	it('parses and canonically serializes the current Legacy manifest', () => {
		const parsed = parseProjectManifest(project);
		expect(parsed).toMatchObject({ kind: 'current', issues: [], project: { projectId: 'project-a11ce001' } });
		expect(serializeProjectManifest(parsed.project!)).toContain('"chapters"');
	});

	it('detects an early directory manifest without rewriting it', () => {
		expect(parseProjectManifest({ schemaVersion: 1, id: 'old-project', title: '旧项目' })).toMatchObject({
			kind: 'early-directory',
			issues: [{ code: 'earlyDirectorySchema', severity: 'warning' }]
		});
	});

	it('rejects unsafe paths', () => {
		const unsafe = structuredClone(project);
		unsafe.volumes[0].chapters[0].file = '../outside.md';
		expect(parseProjectManifest(unsafe).issues).toEqual([
			expect.objectContaining({ code: 'unsafePath', severity: 'error' })
		]);
	});
});
