import { resolveAnchor } from '@writing-buddy/review';
import type {
	StoryRepository,
	StoryResource
} from '@writing-buddy/story-kernel';
import type { MentionService } from '../story/manuscript/MentionService';
import type { QuickCapture } from './QuickCaptureModel';

export type QuickCaptureConversionTarget =
	| 'character'
	| 'location'
	| 'item'
	| 'foreshadowing'
	| 'worldRule';

export interface QuickCaptureConversionResult {
	readonly resource: StoryResource;
	readonly sourceLinked: boolean;
}

interface ManuscriptSource {
	readonly content: string;
	readonly textRevision: number;
}

type SourceLoader = (chapterId: string) => Promise<ManuscriptSource>;

const idPrefixes: Readonly<Record<QuickCaptureConversionTarget, string>> = {
	character: 'character',
	location: 'location',
	item: 'item',
	foreshadowing: 'foreshadowing',
	worldRule: 'world-rule'
};

function resourceId(capture: QuickCapture, target: QuickCaptureConversionTarget): string {
	const leaf = capture.id
		.slice('capture:'.length)
		.toLocaleLowerCase('en-US')
		.replace(/[^a-z0-9-]+/gu, '-')
		.replace(/^-+|-+$/gu, '');
	if (!leaf) throw new Error('quickCaptureConversionIdInvalid');
	return `${idPrefixes[target]}:from-capture-${leaf}`;
}

function titleFromCapture(capture: QuickCapture): string {
	const title = capture.text
		.split(/\r?\n/u)
		.map(line => line.trim())
		.find(Boolean)
		?.slice(0, 160);
	if (!title) throw new Error('quickCaptureConversionTitleInvalid');
	return title;
}

function buildResource(
	capture: QuickCapture,
	target: QuickCaptureConversionTarget,
	now: string
): unknown {
	const title = titleFromCapture(capture);
	const summary = capture.text.slice(0, 10_000);
	const base = {
		id: resourceId(capture, target),
		type: target,
		title,
		aliases: [],
		summary,
		tags: ['快速记录', capture.id],
		schemaVersion: 1 as const,
		createdAt: now,
		updatedAt: now,
		revision: 0
	};
	if (target === 'character') {
		return {
			...base,
			factionIds: [],
			goals: [],
			desires: [],
			fears: [],
			values: [],
			secrets: [],
			evidenceIds: []
		};
	}
	if (target === 'location') {
		return {
			...base,
			travelLinks: [],
			factionIds: [],
			rules: [],
			evidenceIds: []
		};
	}
	if (target === 'item') {
		return {
			...base,
			description: summary,
			unique: true,
			restrictions: [],
			evidenceIds: []
		};
	}
	if (target === 'foreshadowing') {
		return {
			...base,
			status: 'planted',
			surfaceMeaning: capture.text.slice(0, 5_000),
			reminderPositions: [],
			readerVisibility: 0,
			plotThreadIds: [],
			evidenceIds: []
		};
	}
	return {
		...base,
		category: 'other',
		statement: summary,
		exceptions: [],
		consequences: [],
		evidenceIds: []
	};
}

export class QuickCaptureConversionService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly mentions: Pick<MentionService, 'listBacklinks' | 'linkSelection'>,
		private readonly now: () => string = () => new Date().toISOString()
	) {}

	async convert(
		capture: QuickCapture,
		target: QuickCaptureConversionTarget,
		loadSource?: SourceLoader
	): Promise<QuickCaptureConversionResult> {
		const id = resourceId(capture, target);
		let resource = await this.repository.get(target, id);
		if (resource) {
			if (resource.type !== target || !resource.tags.includes(capture.id)) {
				throw new Error('quickCaptureConversionCollision');
			}
		} else {
			const [saved] = await this.repository.commit([{
				resource: buildResource(capture, target, this.now()),
				expectedAbsent: true
			}]);
			if (!saved) throw new Error('quickCaptureConversionFailed');
			resource = saved;
		}

		let sourceLinked = false;
		if (capture.chapterId && capture.anchor && loadSource) {
			const source = await loadSource(capture.chapterId);
			const range = resolveAnchor(source.content, capture.anchor);
			if (range) {
				const backlinks = await this.mentions.listBacklinks(resource.id);
				const existing = backlinks.some(link => (
					link.status === 'active'
					&& link.chapterId === capture.chapterId
					&& link.anchor.start === range.start
					&& link.anchor.end === range.end
					&& link.anchor.quote === source.content.slice(range.start, range.end)
				));
				if (!existing) {
					await this.mentions.linkSelection({
						resourceId: resource.id,
						chapterId: capture.chapterId,
						...(capture.sceneId ? { sceneId: capture.sceneId } : {}),
						manuscript: source.content,
						start: range.start,
						end: range.end,
						textRevision: source.textRevision
					});
				}
				sourceLinked = true;
			}
		}
		return { resource, sourceLinked };
	}
}
