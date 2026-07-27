import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	parseRelationship,
	parseStoryId,
	parseTimelineEvent,
	type Character
} from '@writing-buddy/story-kernel';
import { useAppStore } from '../../src/app/store';
import { ProjectOpenErrorDialog } from '../../src/features/projects/ui/ProjectOpenErrorDialog';
import { StoryReferenceSidebar } from '../../src/features/story/navigation/StoryReferenceSidebar';
import { RelationshipMatrix } from '../../src/features/story/relationships/RelationshipMatrix';
import { VirtualTimelineList } from '../../src/features/story/timeline/VirtualTimelineList';
import { TopBar } from '../../src/shell/TopBar';

const root = resolve(import.meta.dirname, '../../../..');
const timestamp = '2026-07-27T00:00:00.000Z';

function contrastRatio(foreground: string, background: string): number {
	const luminance = (hex: string) => {
		const channels = [1, 3, 5]
			.map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
			.map(value => value <= 0.03928
				? value / 12.92
				: ((value + 0.055) / 1.055) ** 2.4);
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};
	const first = luminance(foreground);
	const second = luminance(background);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('StoryForge professional layout contract', () => {
	it('keeps the frozen shell geometry and all three responsive tiers', () => {
		const layout = JSON.parse(readFileSync(
			resolve(root, 'docs/design/storyforge-ui-layout-spec-v1.json'),
			'utf8'
		)) as {
			coordinateSystem: { baselineWindow: { width: number; height: number } };
			globalShell: Record<string, { x: number; y: number; w: number; h: number }>;
			responsive: { breakpoints: readonly { name: string }[] };
		};
		expect(layout.coordinateSystem.baselineWindow).toMatchObject({ width: 1536, height: 992 });
		expect(layout.globalShell.topBar).toMatchObject({ x: 0, y: 32, w: 1536, h: 68 });
		expect(layout.globalShell.globalRail).toMatchObject({ x: 0, y: 100, w: 78, h: 852 });
		expect(layout.globalShell.projectPane).toMatchObject({ x: 78, y: 100, w: 304, h: 852 });
		expect(layout.globalShell.workspace).toMatchObject({ x: 382, y: 100, w: 815, h: 852 });
		expect(layout.globalShell.assistant).toMatchObject({ x: 1197, y: 100, w: 339, h: 852 });
		expect(layout.globalShell.statusBar).toMatchObject({ x: 0, y: 952, w: 1536, h: 40 });
		expect(layout.responsive.breakpoints.map(value => value.name))
			.toEqual(['wide', 'desktop', 'compact', 'narrow']);

		const workspaceCss = readFileSync(resolve(root, 'apps/desktop/src/theme/workspace.css'), 'utf8');
		expect(workspaceCss).toContain('@media (max-width: 1279px)');
		expect(workspaceCss).toContain('@media (max-width: 1023px)');
		expect(workspaceCss).toContain('"rail sidebar center" minmax(0, 1fr)');
		expect(workspaceCss).toContain('"rail center" minmax(0, 1fr)');
	});

	it('enforces visible focus, reduced motion and AA muted text contrast', () => {
		const tokens = readFileSync(resolve(root, 'apps/desktop/src/theme/tokens.css'), 'utf8');
		expect(tokens).toContain('select:focus-visible');
		expect(tokens).toContain('@media (prefers-reduced-motion: reduce)');
		expect(tokens).toContain('animation-duration: 0.01ms !important');
		expect(contrastRatio('#756f66', '#ffffff')).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio('#66727c', '#f7f8f8')).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio('#766e64', '#f9f5ec')).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio('#9aa0aa', '#182131')).toBeGreaterThanOrEqual(4.5);
	});

	it('moves through resource navigation with arrows, Home and End', () => {
		useAppStore.setState({ storyView: 'characters', activeMode: 'references' });
		render(createElement(StoryReferenceSidebar));
		const first = screen.getByRole('button', { name: /人物中心/ });
		first.focus();
		fireEvent.keyDown(first, { key: 'ArrowDown' });
		const second = screen.getByRole('button', { name: /人物关系/ });
		expect(second).toHaveFocus();
		expect(useAppStore.getState().storyView).toBe('relationships');
		fireEvent.keyDown(second, { key: 'End' });
		expect(screen.getByRole('button', { name: /一致性审查/ })).toHaveFocus();
	});

	it('moves through directed matrix cells and timeline rows by keyboard', () => {
		const characters: readonly Character[] = [
			{
				id: parseStoryId('character:lin'), type: 'character', title: '林越',
				aliases: [], tags: [], schemaVersion: 1, createdAt: timestamp,
				updatedAt: timestamp, revision: 0, factionIds: [], goals: [],
				desires: [], fears: [], values: [], secrets: [], evidenceIds: []
			},
			{
				id: parseStoryId('character:shen'), type: 'character', title: '沈青',
				aliases: [], tags: [], schemaVersion: 1, createdAt: timestamp,
				updatedAt: timestamp, revision: 0, factionIds: [], goals: [],
				desires: [], fears: [], values: [], secrets: [], evidenceIds: []
			}
		];
		const relationships = [
			parseRelationship({
				id: 'relationship:doubt', type: 'relationship', title: '怀疑',
				aliases: [], tags: [], schemaVersion: 1, createdAt: timestamp,
				updatedAt: timestamp, revision: 0, sourceCharacterId: 'character:lin',
				targetCharacterId: 'character:shen', relationshipType: '怀疑',
				strength: 0.7, visibility: 'private',
				effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: 1 },
				evidenceIds: []
			}),
			parseRelationship({
				id: 'relationship:protect', type: 'relationship', title: '保护',
				aliases: [], tags: [], schemaVersion: 1, createdAt: timestamp,
				updatedAt: timestamp, revision: 0, sourceCharacterId: 'character:shen',
				targetCharacterId: 'character:lin', relationshipType: '保护',
				strength: 0.9, visibility: 'private',
				effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: 1 },
				evidenceIds: []
			})
		];
		const { unmount } = render(createElement(RelationshipMatrix, {
			characters,
			relationships,
			onSelect: () => undefined
		}));
		const firstCell = screen.getByRole('button', { name: /林越 到 沈青/ });
		firstCell.focus();
		fireEvent.keyDown(firstCell, { key: 'ArrowRight' });
		expect(screen.getByRole('button', { name: /沈青 到 林越/ })).toHaveFocus();
		unmount();

		const events = ['相遇', '追踪'].map((title, index) => parseTimelineEvent({
			id: `timeline-event:event-${index}`, type: 'timelineEvent', title,
			aliases: [], tags: [], schemaVersion: 1, createdAt: timestamp,
			updatedAt: timestamp, revision: 0, eventType: '主线',
			narrativePosition: { chapterId: 'chapter:one', narrativeOrder: index + 1 },
			participantIds: [], locationIds: [], itemIds: [], predecessorIds: [],
			consequenceIds: [], plotThreadIds: [], informationIds: [], evidenceIds: []
		}));
		render(createElement(VirtualTimelineList, {
			events,
			labels: {},
			onSelect: () => undefined
		}));
		const firstEvent = screen.getByRole('button', { name: '相遇' });
		firstEvent.focus();
		fireEvent.keyDown(firstEvent, { key: 'ArrowDown' });
		return waitFor(() => expect(screen.getByRole('button', { name: '追踪' })).toHaveFocus());
	});

	it('keeps drawer toggles focused and restores focus after a modal closes', async () => {
		const user = userEvent.setup();
		useAppStore.setState({ assistantOpen: true, activeMode: 'works' });
		const { unmount } = render(createElement(TopBar));
		const drawerToggle = screen.getByRole('button', { name: '收起写作助手' });
		drawerToggle.focus();
		await user.click(drawerToggle);
		expect(screen.getByRole('button', { name: '展开写作助手' })).toHaveFocus();
		unmount();

		function DialogHarness() {
			const [open, setOpen] = useState(false);
			return createElement(
				'div',
				null,
				createElement('button', { type: 'button', onClick: () => setOpen(true) }, '打开诊断'),
				open
					? createElement(ProjectOpenErrorDialog, {
						error: {
							code: 'projectLocked',
							stage: 'acquire-lock',
							canOpenReadOnly: true,
							canRepair: false,
							diagnosticId: 'layout-focus-test'
						},
						onRetry: () => undefined,
						onOpenReadOnly: () => undefined,
						onRepair: () => undefined,
						onOpenDirectory: () => undefined,
						onClose: () => setOpen(false)
					})
					: null
			);
		}
		render(createElement(DialogHarness));
		const trigger = screen.getByRole('button', { name: '打开诊断' });
		await user.click(trigger);
		expect(screen.getByRole('button', { name: '重试' })).toHaveFocus();
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		await waitFor(() => expect(trigger).toHaveFocus());
	});
});
