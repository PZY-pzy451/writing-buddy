import projectScenarioData from './fixtures/project-scenarios.json';
import { FakeFileSystem, fakeFileHash, type FakeFileSystemOperation, type FakeFileSystemSeed } from './index';

export const DETERMINISTIC_PROJECT_FIXTURE_VERSION = 'qa-project-fixture-v1';
export type DeterministicProjectScenarioId = typeof projectScenarioData[number]['id'];
export const deterministicProjectScenarios = projectScenarioData as readonly {
	readonly id: DeterministicProjectScenarioId;
	readonly expectedOutcome: string;
}[];

function manifest(schemaVersion = 1): string {
	return JSON.stringify({
		schemaVersion,
		projectId: 'qa-project-0001',
		title: '脱敏 QA 作品',
		volumes: [{
			id: 'qa-volume-0001',
			title: '测试卷',
			chapters: [{
				id: 'qa-chapter-0001', title: '测试章', file: 'chapters/chapter-001.md',
				status: 'draft', targetWords: 1000
			}]
		}]
	}, undefined, 2);
}

function seedsFor(root: string, scenarioId: DeterministicProjectScenarioId): readonly FakeFileSystemSeed[] {
	const manuscript = scenarioId === 'long_manuscript'
		? '这是脱敏压力测试句子。'.repeat(10_000)
		: '这是脱敏测试正文，不属于任何真实作者。';
	return [
		{
			projectRoot: root,
			relativePath: '.writing-buddy/project.json',
			content: scenarioId === 'corrupt_manifest' ? '{invalid' : manifest(scenarioId === 'legacy_schema' ? 0 : 1)
		},
		{ projectRoot: root, relativePath: 'chapters/chapter-001.md', content: manuscript }
	];
}

export class DeterministicProjectFixture {
	readonly version = DETERMINISTIC_PROJECT_FIXTURE_VERSION;
	readonly root: string;
	readonly fileSystem = new FakeFileSystem();
	readonly readOnly: boolean;
	readonly dirty: boolean;
	readonly initialChapterHash: string;
	private disposed = false;

	constructor(readonly scenarioId: DeterministicProjectScenarioId = 'clean_minimal') {
		if (!deterministicProjectScenarios.some(scenario => scenario.id === scenarioId)) throw new Error('unknownQaProjectScenario');
		this.root = `qa-fixture/${scenarioId}`;
		this.readOnly = scenarioId === 'read_only';
		this.dirty = scenarioId === 'dirty_manuscript';
		this.initialChapterHash = fakeFileHash(seedsFor(this.root, scenarioId).find(seed => seed.relativePath === 'chapters/chapter-001.md')?.content ?? '');
		this.reset();
	}

	reset(): void {
		this.disposed = false;
		this.fileSystem.reset(seedsFor(this.root, this.scenarioId));
		if (this.scenarioId === 'external_conflict') {
			this.fileSystem.add(this.root, 'chapters/chapter-001.md', '这是脱敏测试正文。外部进程已修改。');
		}
		if (this.scenarioId === 'save_failure') this.failNext('writeTextAtomic', 'qaSaveFailure');
	}

	failNext(operation: FakeFileSystemOperation, errorCode: string): void {
		this.fileSystem.failNext(operation, errorCode);
	}

	dump(): readonly FakeFileSystemSeed[] {
		return this.fileSystem.dump();
	}

	dispose(): void {
		this.fileSystem.dispose();
		this.disposed = true;
	}

	isDisposed(): boolean {
		return this.disposed;
	}
}
