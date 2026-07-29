import type { TimelineEvent } from '@writing-buddy/story-kernel';

export function timelineDropPreview(
	events: readonly TimelineEvent[],
	overId: string
): string | undefined {
	const targetIndex = events.findIndex(event => event.id === overId);
	if (targetIndex < 0) return undefined;
	return `移动到叙事顺序第 ${targetIndex + 1} 位；只改变顺序，不改变实际时间`;
}
