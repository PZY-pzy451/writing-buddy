import type { TextFile } from '@writing-buddy/domain';
import type { AtomicWriteResult } from '@writing-buddy/platform-ports';
import {
	createCreationJourneyState,
	parseCreationJourneyState,
	serializeCreationJourneyState,
	type CreationStartRoute,
	type CreationJourneyState
} from './CreationJourneyModel';

export interface CreationJourneyStorageGateway {
	readCreationJourneyState(projectRoot: string): Promise<TextFile | undefined>;
	writeCreationJourneyState(
		projectRoot: string,
		content: string,
		expectedHash: string
	): Promise<AtomicWriteResult>;
}

export interface LoadedCreationJourney {
	readonly state: CreationJourneyState;
	readonly hash: string;
}

export class CreationJourneyStore {
	constructor(
		private readonly projectRoot: string,
		private readonly projectId: string,
		private readonly gateway: CreationJourneyStorageGateway,
		private readonly now: () => string = () => new Date().toISOString(),
		private readonly preferredStartRoute?: CreationStartRoute
	) {}

	async load(): Promise<LoadedCreationJourney> {
		const file = await this.gateway.readCreationJourneyState(this.projectRoot);
		if (!file) {
			return {
				state: createCreationJourneyState(this.projectId, {
					now: this.now,
					startRoute: this.preferredStartRoute
				}),
				hash: ''
			};
		}
		const state = parseCreationJourneyState(file.content);
		if (state.projectId !== this.projectId) {
			throw new Error('creationJourneyProjectMismatch');
		}
		return { state, hash: file.hash };
	}

	async save(
		current: LoadedCreationJourney,
		state: CreationJourneyState
	): Promise<LoadedCreationJourney> {
		if (
			state.projectId !== this.projectId
			|| state.revision < current.state.revision
		) {
			throw new Error('creationJourneyProjectMismatch');
		}
		const content = serializeCreationJourneyState(state);
		const result = await this.gateway.writeCreationJourneyState(
			this.projectRoot,
			content,
			current.hash
		);
		return { state, hash: result.hash };
	}
}
