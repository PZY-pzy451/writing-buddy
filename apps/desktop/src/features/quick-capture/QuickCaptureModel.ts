import { createTextAnchor, type TextAnchor } from '@writing-buddy/review';
import { z } from 'zod';

export const quickCaptureTypes = [
	'idea',
	'revision',
	'foreshadowing',
	'character',
	'world'
] as const;

export const quickCaptureStatuses = [
	'inbox',
	'later',
	'converted',
	'dismissed'
] as const;

export type QuickCaptureType = typeof quickCaptureTypes[number];
export type QuickCaptureStatus = typeof quickCaptureStatuses[number];

export interface QuickCapture {
	readonly id: string;
	readonly projectId: string;
	readonly type: QuickCaptureType;
	readonly text: string;
	readonly chapterId?: string;
	readonly sceneId?: string;
	readonly anchor?: TextAnchor;
	readonly status: QuickCaptureStatus;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly convertedResourceId?: string;
}

export interface QuickCaptureState {
	readonly schemaVersion: 1;
	readonly captures: readonly QuickCapture[];
}

export interface QuickCaptureDraft {
	readonly projectId: string;
	readonly type: QuickCaptureType;
	readonly text: string;
	readonly chapterId?: string;
	readonly sceneId?: string;
	readonly anchor?: TextAnchor;
}

const utcTimestamp = z.string().refine(value => {
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
});

const textAnchorSchema = z.object({
	start: z.number().int().min(0),
	end: z.number().int().positive(),
	before: z.string().max(64),
	target: z.string().min(1).max(2_000),
	after: z.string().max(64),
	sourceHash: z.string().regex(/^[a-f0-9]{8}$/u)
}).strict().refine(anchor => anchor.end > anchor.start, {
	message: 'invalidQuickCaptureAnchor'
});

const quickCaptureSchema = z.object({
	id: z.string().regex(/^capture:[a-z0-9][a-z0-9-]*$/u),
	projectId: z.string().trim().min(1).max(240),
	type: z.enum(quickCaptureTypes),
	text: z.string().trim().min(1).max(20_000),
	chapterId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u).optional(),
	sceneId: z.string().regex(/^scene:[a-z0-9][a-z0-9-]*$/u).optional(),
	anchor: textAnchorSchema.optional(),
	status: z.enum(quickCaptureStatuses),
	createdAt: utcTimestamp,
	updatedAt: utcTimestamp,
	convertedResourceId: z.string().regex(/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u).optional()
}).strict();

const quickCaptureStateSchema = z.object({
	schemaVersion: z.literal(1),
	captures: z.array(quickCaptureSchema).max(10_000)
}).strict();

function defaultCaptureId(): string {
	return `capture:${globalThis.crypto.randomUUID()}`;
}

export function captureAnchorForEditor(
	content: string,
	cursorOffset: number,
	selection?: { readonly start: number; readonly end: number }
): TextAnchor | undefined {
	if (selection) {
		if (
			!Number.isSafeInteger(selection.start)
			|| !Number.isSafeInteger(selection.end)
			|| selection.start < 0
			|| selection.end <= selection.start
			|| selection.end > content.length
			|| selection.end - selection.start > 2_000
		) {
			return undefined;
		}
		return createTextAnchor(content, selection.start, selection.end);
	}
	if (!Number.isSafeInteger(cursorOffset) || cursorOffset < 0 || cursorOffset > content.length) {
		return undefined;
	}
	const lineStart = content.lastIndexOf('\n', Math.max(0, cursorOffset - 1)) + 1;
	const nextBreak = content.indexOf('\n', cursorOffset);
	const lineEnd = nextBreak < 0 ? content.length : nextBreak;
	const line = content.slice(lineStart, lineEnd);
	const leading = line.length - line.trimStart().length;
	const trailing = line.length - line.trimEnd().length;
	const start = lineStart + leading;
	const end = lineEnd - trailing;
	if (end <= start || end - start > 2_000) {
		return undefined;
	}
	return createTextAnchor(content, start, end);
}

export function createQuickCapture(
	draft: QuickCaptureDraft,
	dependencies: {
		readonly id?: () => string;
		readonly now?: () => string;
	} = {}
): QuickCapture {
	const timestamp = (dependencies.now ?? (() => new Date().toISOString()))();
	const value = {
		id: (dependencies.id ?? defaultCaptureId)(),
		projectId: draft.projectId,
		type: draft.type,
		text: draft.text.trim(),
		...(draft.chapterId ? { chapterId: draft.chapterId } : {}),
		...(draft.sceneId ? { sceneId: draft.sceneId } : {}),
		...(draft.anchor ? { anchor: draft.anchor } : {}),
		status: 'inbox' as const,
		createdAt: timestamp,
		updatedAt: timestamp
	};
	const result = quickCaptureSchema.safeParse(value);
	if (!result.success) {
		throw new Error('quickCaptureInvalid');
	}
	return result.data;
}

export function parseQuickCaptureState(content: string): QuickCaptureState {
	try {
		const result = quickCaptureStateSchema.safeParse(JSON.parse(content));
		if (!result.success) {
			throw new Error('quickCaptureStateInvalid');
		}
		const ids = new Set<string>();
		for (const capture of result.data.captures) {
			if (ids.has(capture.id)) {
				throw new Error('quickCaptureStateInvalid');
			}
			ids.add(capture.id);
		}
		return result.data;
	} catch (error) {
		if (error instanceof Error && error.message === 'quickCaptureStateInvalid') {
			throw error;
		}
		throw new Error('quickCaptureStateInvalid');
	}
}

export function serializeQuickCaptureState(state: QuickCaptureState): string {
	const result = quickCaptureStateSchema.safeParse(state);
	if (!result.success) {
		throw new Error('quickCaptureStateInvalid');
	}
	return `${JSON.stringify(result.data, null, 2)}\n`;
}
