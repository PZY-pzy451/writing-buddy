export const DEFAULT_DAILY_WRITING_GOAL = 1_000;
export const MIN_DAILY_WRITING_GOAL = 100;
export const MAX_DAILY_WRITING_GOAL = 100_000;
const MAX_DAILY_PROGRESS_WORDS = 10_000_000;
const MAX_PROGRESS_DAYS = 120;
const MAX_PROGRESS_PROJECTS = 50;

export interface DailyWritingProgressEntry {
	readonly date: string;
	readonly words: number;
}

export interface ProjectWritingProgress {
	readonly goal: number;
	readonly days: readonly DailyWritingProgressEntry[];
}

export type WritingProgressMap = Readonly<Record<string, ProjectWritingProgress>>;

export interface TodayWritingProgress {
	readonly date: string;
	readonly goal: number;
	readonly words: number;
	readonly remaining: number;
	readonly percent: number;
	readonly completed: boolean;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
	const integer = Math.trunc(value);
	return integer >= minimum && integer <= maximum ? integer : undefined;
}

function validDateKey(value: unknown): value is string {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

export function localDateKey(date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function parseWritingProgressMap(value: unknown): WritingProgressMap {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const projects: Record<string, ProjectWritingProgress> = {};
	for (const [projectId, candidate] of Object.entries(value).slice(0, MAX_PROGRESS_PROJECTS)) {
		if (!projectId.trim() || projectId.length > 200 || !candidate || typeof candidate !== 'object') {
			continue;
		}
		const raw = candidate as { readonly goal?: unknown; readonly days?: unknown };
		const goal = boundedInteger(
			raw.goal,
			MIN_DAILY_WRITING_GOAL,
			MAX_DAILY_WRITING_GOAL
		) ?? DEFAULT_DAILY_WRITING_GOAL;
		const daysByDate = new Map<string, DailyWritingProgressEntry>();
		if (Array.isArray(raw.days)) {
			for (const entry of raw.days) {
				if (!entry || typeof entry !== 'object') continue;
				const day = entry as { readonly date?: unknown; readonly words?: unknown };
				const words = boundedInteger(day.words, 0, MAX_DAILY_PROGRESS_WORDS);
				if (!validDateKey(day.date) || words === undefined) continue;
				daysByDate.set(day.date, { date: day.date, words });
			}
		}
		projects[projectId] = {
			goal,
			days: [...daysByDate.values()]
				.sort((left, right) => left.date.localeCompare(right.date))
				.slice(-MAX_PROGRESS_DAYS)
		};
	}
	return projects;
}

export function setProjectDailyWritingGoal(
	progress: WritingProgressMap,
	projectId: string,
	goal: number
): WritingProgressMap {
	const normalizedGoal = boundedInteger(
		goal,
		MIN_DAILY_WRITING_GOAL,
		MAX_DAILY_WRITING_GOAL
	);
	if (!projectId.trim() || normalizedGoal === undefined) {
		throw new Error('dailyWritingGoalInvalid');
	}
	const current = progress[projectId];
	if (current?.goal === normalizedGoal) return progress;
	return {
		...progress,
		[projectId]: {
			goal: normalizedGoal,
			days: current?.days ?? []
		}
	};
}

export function recordDailyWritingDelta(
	progress: WritingProgressMap,
	projectId: string,
	delta: number,
	date = new Date()
): WritingProgressMap {
	if (!projectId.trim() || !Number.isFinite(delta)) return progress;
	const normalizedDelta = Math.trunc(delta);
	if (normalizedDelta === 0) return progress;
	const current = progress[projectId] ?? {
		goal: DEFAULT_DAILY_WRITING_GOAL,
		days: []
	};
	const key = localDateKey(date);
	const existing = current.days.find(entry => entry.date === key)?.words ?? 0;
	const words = Math.max(0, Math.min(MAX_DAILY_PROGRESS_WORDS, existing + normalizedDelta));
	if (words === existing) return progress;
	const days = [
		...current.days.filter(entry => entry.date !== key),
		{ date: key, words }
	].sort((left, right) => left.date.localeCompare(right.date)).slice(-MAX_PROGRESS_DAYS);
	return {
		...progress,
		[projectId]: {
			goal: current.goal,
			days
		}
	};
}

export function selectTodayWritingProgress(
	progress: WritingProgressMap,
	projectId: string | undefined,
	date = new Date()
): TodayWritingProgress {
	const key = localDateKey(date);
	const project = projectId ? progress[projectId] : undefined;
	const goal = project?.goal ?? DEFAULT_DAILY_WRITING_GOAL;
	const words = project?.days.find(entry => entry.date === key)?.words ?? 0;
	return {
		date: key,
		goal,
		words,
		remaining: Math.max(0, goal - words),
		percent: Math.min(100, Math.round((words / goal) * 100)),
		completed: words >= goal
	};
}
