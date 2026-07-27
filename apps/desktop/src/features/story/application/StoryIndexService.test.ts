import { describe, expect, it, vi } from 'vitest';
import type {
	StoryIndexGateway,
	StoryIndexQuery,
	StoryIndexStatus
} from '@writing-buddy/platform-ports';
import { StoryIndexService } from './StoryIndexService';

const missing: StoryIndexStatus = {
	schemaVersion: 1,
	ready: false,
	sourceFingerprint: '',
	recordCount: 0,
	kindCounts: {}
};
const ready: StoryIndexStatus = {
	schemaVersion: 1,
	ready: true,
	sourceFingerprint: 'fixture',
	recordCount: 266_000,
	kindCounts: { chapter: 1_000, scene: 10_000 }
};

function gateway(status = missing): {
	readonly port: StoryIndexGateway;
	readonly getStatus: ReturnType<typeof vi.fn>;
	readonly rebuild: ReturnType<typeof vi.fn>;
	readonly query: ReturnType<typeof vi.fn>;
} {
	const getStatus = vi.fn(() => Promise.resolve(status));
	const rebuild = vi.fn(() => Promise.resolve(ready));
	const query = vi.fn((
			_projectRoot: string,
			query: StoryIndexQuery
		) => Promise.resolve({
			ids: ['timeline-event:one'],
			total: 1,
			offset: query.offset ?? 0,
			limit: query.limit ?? 200,
			sourceFingerprint: ready.sourceFingerprint
		}));
	return {
		getStatus,
		rebuild,
		query,
		port: {
			getStoryIndexStatus: getStatus,
			rebuildStoryIndex: rebuild,
			queryStoryIndex: query
		}
	};
}

describe('StoryIndexService', () => {
	it('deduplicates concurrent warmups and rebuilds a missing derived index once', async () => {
		const fixture = gateway();
		const service = new StoryIndexService(fixture.port);
		const [first, second] = await Promise.all([
			service.prepare('D:/fixture'),
			service.prepare('D:/fixture')
		]);

		expect(first.status).toEqual(ready);
		expect(second.status).toEqual(ready);
		expect(first.rebuilt).toBe(true);
		expect(fixture.getStatus).toHaveBeenCalledTimes(1);
		expect(fixture.rebuild).toHaveBeenCalledTimes(1);
	});

	it('does not write a missing index for read-only projects', async () => {
		const fixture = gateway();
		const result = await new StoryIndexService(fixture.port).prepare('D:/fixture', false);

		expect(result.status.ready).toBe(false);
		expect(result.rebuilt).toBe(false);
		expect(fixture.rebuild).not.toHaveBeenCalled();
	});

	it('bounds indexed queries and waits for readiness', async () => {
		const fixture = gateway(ready);
		const result = await new StoryIndexService(fixture.port).query('D:/fixture', {
			kind: 'timelineEvent',
			offset: -20,
			limit: 99_999
		});

		expect(result.ids).toEqual(['timeline-event:one']);
		expect(fixture.query).toHaveBeenCalledWith('D:/fixture', {
			kind: 'timelineEvent',
			offset: 0,
			limit: 5_000
		});
	});
});
