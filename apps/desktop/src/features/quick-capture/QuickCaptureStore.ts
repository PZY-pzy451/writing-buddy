import type { TextFile } from '@writing-buddy/domain';
import type { AtomicWriteResult } from '@writing-buddy/platform-ports';
import {
	createQuickCapture,
	parseQuickCaptureState,
	serializeQuickCaptureState,
	type QuickCapture,
	type QuickCaptureDraft,
	type QuickCaptureState,
	type QuickCaptureStatus
} from './QuickCaptureModel';

export interface QuickCaptureStorageGateway {
	readQuickCaptureState(projectRoot: string): Promise<TextFile | undefined>;
	writeQuickCaptureState(
		projectRoot: string,
		content: string,
		expectedHash: string
	): Promise<AtomicWriteResult>;
}

export interface LoadedQuickCaptures {
	readonly state: QuickCaptureState;
	readonly hash: string;
}

export class QuickCaptureStore {
	constructor(
		private readonly projectRoot: string,
		private readonly gateway: QuickCaptureStorageGateway,
		private readonly createId: () => string = () => `capture:${globalThis.crypto.randomUUID()}`,
		private readonly now: () => string = () => new Date().toISOString()
	) {}

	async load(): Promise<LoadedQuickCaptures> {
		const file = await this.gateway.readQuickCaptureState(this.projectRoot);
		return file
			? { state: parseQuickCaptureState(file.content), hash: file.hash }
			: { state: { schemaVersion: 1, captures: [] }, hash: '' };
	}

	async add(
		current: LoadedQuickCaptures,
		draft: QuickCaptureDraft
	): Promise<LoadedQuickCaptures> {
		const capture = createQuickCapture(draft, {
			id: this.createId,
			now: this.now
		});
		return this.persist(current, {
			schemaVersion: 1,
			captures: [capture, ...current.state.captures]
		});
	}

	async setStatus(
		current: LoadedQuickCaptures,
		id: string,
		status: QuickCaptureStatus,
		convertedResourceId?: string
	): Promise<LoadedQuickCaptures> {
		let found = false;
		const captures = current.state.captures.map(capture => {
			if (capture.id !== id) return capture;
			found = true;
			return {
				...capture,
				status,
				updatedAt: this.now(),
				...(convertedResourceId ? { convertedResourceId } : {})
			} satisfies QuickCapture;
		});
		if (!found) {
			throw new Error('quickCaptureNotFound');
		}
		return this.persist(current, { schemaVersion: 1, captures });
	}

	private async persist(
		current: LoadedQuickCaptures,
		state: QuickCaptureState
	): Promise<LoadedQuickCaptures> {
		const content = serializeQuickCaptureState(state);
		const result = await this.gateway.writeQuickCaptureState(
			this.projectRoot,
			content,
			current.hash
		);
		return { state, hash: result.hash };
	}
}
