import type { ResourceDescriptor } from '@writing-buddy/domain';
import type { ResourceTabManager } from '@writing-buddy/project';
import type {
	StoryRepository,
	StoryResource,
	StoryResourceType
} from '@writing-buddy/story-kernel';
import {
	buildStoryRoute,
	buildStoryTabKey,
	getStoryResourceRegistration,
	parseStoryTabKey,
	type StoryResourceRegistration
} from './StoryResourceRegistry';

export interface StoryResourceReference {
	readonly type: StoryResourceType;
	readonly id: string;
}

export interface StoryTabDescriptor extends ResourceDescriptor {
	readonly type: 'story';
	readonly storyType: StoryResourceType;
	readonly storyId: string;
	readonly route: string;
}

interface StoryOpenResultBase {
	readonly reference: StoryResourceReference;
	readonly registration: StoryResourceRegistration;
	readonly tab: StoryTabDescriptor;
}

export interface ReadyStoryOpenResult extends StoryOpenResultBase {
	readonly status: 'ready';
	readonly resource: StoryResource;
}

export interface MissingStoryOpenResult extends StoryOpenResultBase {
	readonly status: 'missing';
}

export interface UnavailableStoryOpenResult extends StoryOpenResultBase {
	readonly status: 'unavailable';
	readonly errorCode: 'storyResourceReadFailed' | 'storyRestoreVerificationFailed';
}

export type StoryOpenResult =
	| ReadyStoryOpenResult
	| MissingStoryOpenResult
	| UnavailableStoryOpenResult;

export class StoryResourceOpenService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly tabs: ResourceTabManager,
		private readonly projectId: string
	) {}

	async loadStoryResource(reference: StoryResourceReference): Promise<StoryOpenResult> {
		const registration = getStoryResourceRegistration(reference.type);
		try {
			const resource = await this.repository.get(reference.type, reference.id);
			const tab = this.createTab(reference, resource?.title ?? '资源不存在');
			return resource
				? { status: 'ready', reference, registration, tab, resource }
				: { status: 'missing', reference, registration, tab };
		} catch {
			return {
				status: 'unavailable',
				errorCode: 'storyResourceReadFailed',
				reference,
				registration,
				tab: this.createTab(reference, '资料暂不可用')
			};
		}
	}

	async openStoryResource(reference: StoryResourceReference): Promise<StoryOpenResult> {
		const result = await this.loadStoryResource(reference);
		this.tabs.open(result.tab);
		return result;
	}

	async restoreStoryResources(
		tabKeys: readonly string[],
		activeTabKey?: string
	): Promise<readonly StoryOpenResult[]> {
		const results: StoryOpenResult[] = [];
		for (const tabKey of tabKeys) {
			const reference = parseStoryTabKey(tabKey);
			if (reference) {
				results.push(await this.openStoryResource(reference));
			}
		}
		if (activeTabKey && parseStoryTabKey(activeTabKey)) {
			this.tabs.activate(activeTabKey);
		}
		return results;
	}

	async restoreFromTrash(reference: StoryResourceReference): Promise<StoryOpenResult> {
		await this.repository.restoreFromTrash(reference.type, reference.id);
		const result = await this.loadStoryResource(reference);
		if (result.status === 'missing') {
			return {
				status: 'unavailable',
				errorCode: 'storyRestoreVerificationFailed',
				reference,
				registration: result.registration,
				tab: this.createTab(reference, '资料暂不可用')
			};
		}
		return result;
	}

	private createTab(
		reference: StoryResourceReference,
		title: string
	): StoryTabDescriptor {
		return {
			id: buildStoryTabKey(reference.type, reference.id),
			type: 'story',
			title,
			projectId: this.projectId,
			storyType: reference.type,
			storyId: reference.id,
			route: buildStoryRoute(reference.type, reference.id)
		};
	}
}
