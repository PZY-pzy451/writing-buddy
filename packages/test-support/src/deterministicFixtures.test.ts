import { describe, expect, it } from 'vitest';
import {
	DeterministicAiMockProvider,
	DeterministicProjectFixture,
	STORY_KERNEL_SCHEMA_MUTATION_MATRIX_RESPONSE,
	STORY_KERNEL_UNSELECTED_MALFORMED_RELATIONSHIP_RESPONSE,
	deterministicAiScenarios,
	deterministicProjectScenarios
} from './index';

describe('deterministic QA fixtures', () => {
	it('TC-QA-FIXTURE-001 exposes the complete AI and project scenario catalog', () => {
		expect(deterministicAiScenarios).toHaveLength(26);
		expect(new Set(deterministicAiScenarios.map(scenario => scenario.id)).size).toBe(26);
		expect(deterministicProjectScenarios).toHaveLength(8);
	});

	it('TC-QA-FIXTURE-002 replays identical streams and retains no request content', () => {
		const provider = new DeterministicAiMockProvider();
		const first = provider.createRun('qa-job', 'success_stream').drain();
		provider.reset();
		const second = provider.createRun('qa-job', 'success_stream').drain();
		expect(second).toEqual(first);
		expect(provider.callLog()).toEqual([{ jobId: 'qa-job', scenarioId: 'success_stream' }]);
	});

	it('TC-QA-FIXTURE-003 advances slow streams manually and cancels without timers', () => {
		const run = new DeterministicAiMockProvider().createRun('qa-slow', 'slow_stream');
		expect(run.next()).toMatchObject({ type: 'job_started' });
		expect(run.cancel()).toEqual({ type: 'cancelled', jobId: 'qa-slow' });
		expect(run.next()).toBeUndefined();
	});

	it('TC-QA-FIXTURE-004 covers deterministic provider and transport failures', () => {
		const provider = new DeterministicAiMockProvider();
		for (const id of ['timeout', 'connection_reset', 'rate_limit', 'unauthorized', 'forbidden', 'server_error', 'empty_response'] as const) {
			expect(provider.createRun(`job-${id}`, id).drain().at(-1)?.type).toBe('failed');
		}
	});

	it('TC-QA-FIXTURE-005 resets mutation and one-shot failure state between tests', async () => {
		const fixture = new DeterministicProjectFixture('clean_minimal');
		const original = await fixture.fileSystem.readText(fixture.root, 'chapters/chapter-001.md');
		await fixture.fileSystem.writeTextAtomic({
			projectRoot: fixture.root, relativePath: 'chapters/chapter-001.md', content: 'mutated',
			expectedHash: original.hash, eol: 'lf', hasBom: false
		});
		fixture.failNext('readText', 'qaReadFailure');
		await expect(fixture.fileSystem.readText(fixture.root, 'chapters/chapter-001.md')).rejects.toThrow('qaReadFailure');
		fixture.reset();
		expect((await fixture.fileSystem.readText(fixture.root, 'chapters/chapter-001.md')).content).toBe(original.content);
	});

	it('TC-QA-FIXTURE-006 disposes every in-memory file without touching disk', () => {
		const fixture = new DeterministicProjectFixture('long_manuscript');
		expect(fixture.dump().length).toBeGreaterThan(0);
		fixture.dispose();
		expect(fixture.isDisposed()).toBe(true);
		expect(fixture.dump()).toEqual([]);
	});

	it('TC-QA-FIXTURE-007 models read-only and external-conflict preconditions explicitly', async () => {
		expect(new DeterministicProjectFixture('read_only').readOnly).toBe(true);
		const conflict = new DeterministicProjectFixture('external_conflict');
		await expect(conflict.fileSystem.writeTextAtomic({
			projectRoot: conflict.root,
			relativePath: 'chapters/chapter-001.md',
			content: 'candidate',
			expectedHash: conflict.initialChapterHash,
			eol: 'lf',
			hasBom: false
		})).rejects.toThrow('externalChange');
	});

	it('TC-QA-FIXTURE-008 replays an unselected malformed relationship without real provider data', () => {
		const events = new DeterministicAiMockProvider()
			.createRun('qa-story-kernel-boundary', 'story_kernel_unselected_malformed_relationship')
			.drain();
		const response = events
			.map(event => event.type === 'content_delta' ? event.text : '')
			.join('');

		expect(response).toBe(STORY_KERNEL_UNSELECTED_MALFORMED_RELATIONSHIP_RESPONSE);
		expect(JSON.parse(response)).toMatchObject({
			candidates: [
				{},
				{},
				{},
				{
					resource: {
						type: 'relationship',
						effectiveFrom: 'childhood',
						history: '童年时期共同经历过一次脱敏 QA 事件。'
					}
				}
			]
		});
	});

	it('TC-QA-FIXTURE-009 replays one explicit schema mutation for every generatable type', () => {
		const response = new DeterministicAiMockProvider()
			.createRun('qa-story-kernel-matrix', 'story_kernel_schema_mutation_matrix')
			.drain()
			.map(event => event.type === 'content_delta' ? event.text : '')
			.join('');
		const parsed = JSON.parse(response) as {
			readonly candidates: readonly {
				readonly resource: { readonly type: string };
			}[];
		};

		expect(response).toBe(STORY_KERNEL_SCHEMA_MUTATION_MATRIX_RESPONSE);
		expect(parsed.candidates).toHaveLength(12);
		expect(new Set(parsed.candidates.slice(1).map(candidate => candidate.resource.type)))
			.toEqual(new Set([
				'character',
				'scene',
				'location',
				'faction',
				'item',
				'worldRule',
				'timelineEvent',
				'relationship',
				'plotThread',
				'foreshadowing',
				'information'
			]));
	});
});
