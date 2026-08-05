import {
	BookmarkPlus,
	Eye,
	Gem,
	Lightbulb,
	Link2,
	MapPin,
	Sparkles,
	UserPlus
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	createStoryId,
	type MentionLink,
	type SelectionRewriteActionType,
	type StoryRepository,
	type StoryResourceType
} from '@writing-buddy/story-kernel';
import { resolveContextualWriterActions } from '../../ai/contextual/ContextualActionResolver';
import type { MentionService } from './MentionService';

interface SelectionActionMenuProps {
	readonly repository: StoryRepository;
	readonly mentionService: MentionService;
	readonly chapterId: string;
	readonly sceneId?: string;
	readonly manuscript: string;
	readonly selection: { readonly start: number; readonly end: number; readonly text: string };
	readonly readOnly: boolean;
	readonly onLinked: (mention: MentionLink) => void;
	readonly onRewrite: (actionType: SelectionRewriteActionType) => void;
	readonly onAiMenuClosed?: () => void;
	readonly onQuickCapture?: () => void;
	readonly onGenerateResource?: (type: StoryResourceType) => void;
}

const creationActions = [
	{ type: 'character', label: '创建人物', icon: UserPlus },
	{ type: 'location', label: '创建地点', icon: MapPin },
	{ type: 'item', label: '创建物品', icon: Gem },
	{ type: 'information', label: '标记为信息揭示', icon: Eye },
	{ type: 'foreshadowing', label: '创建伏笔', icon: BookmarkPlus }
] as const;

function selectionActionErrorMessage(reason: unknown, fallback: string): string {
	const code = reason instanceof Error ? reason.message : String(reason);
	const messages: Readonly<Record<string, string>> = {
		mentionLinkFailed: '无法链接所选资源。请确认资源 ID 后重试。',
		mentionResourceNotFound: '没有找到该 Story 资源，请检查资源 ID。',
		storyResourceNotFound: '没有找到该 Story 资源，请检查资源 ID。',
		invalidMentionRange: '当前选区已经变化，请重新选择正文后再链接。',
		mentionRevisionConflict: '正文或链接已发生变化，请重新选择正文后再试。',
		storyResourceCreateFailed: '资料候选创建失败，本次没有写入项目。请重试。',
		storyRevisionConflict: '资料已在其他位置修改，请刷新后再试。'
	};
	const exact = messages[code];
	if (exact) return exact;
	const prefix = Object.keys(messages).find(item => code.startsWith(`${item}:`));
	return prefix ? messages[prefix] ?? fallback : fallback;
}

export function SelectionActionMenu({
	repository,
	mentionService,
	chapterId,
	sceneId,
	manuscript,
	selection,
	readOnly,
	onLinked,
	onRewrite,
	onAiMenuClosed,
	onQuickCapture,
	onGenerateResource
}: SelectionActionMenuProps): React.JSX.Element {
	const aiMenuRef = useRef<HTMLDetailsElement>(null);
	const aiMenuPopupRef = useRef<HTMLDivElement>(null);
	const aiMenuWasOpenRef = useRef(false);
	const [aiMenuOpen, setAiMenuOpen] = useState(false);
	const [aiMenuPosition, setAiMenuPosition] = useState({ left: 12, bottom: 12 });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const selectedTitle = selection.text.trim().slice(0, 160);
	const contextualActions = resolveContextualWriterActions({
		workspace: 'writing',
		hasProject: true,
		activeResourceType: 'chapter',
		selectionText: selection.text,
		cursorAtParagraphEnd: false,
		chapterHasDraft: manuscript.trim().length > 0,
		chapterHasPendingExtraction: false
	});

	useEffect(() => {
		if (!aiMenuOpen) return;
		aiMenuPopupRef.current
			?.querySelector<HTMLButtonElement>('[role="menuitem"]')
			?.focus();
	}, [aiMenuOpen]);

	const closeAiMenu = (restoreDisclosureFocus: boolean) => {
		if (!aiMenuRef.current?.open) return;
		aiMenuRef.current.open = false;
		if (restoreDisclosureFocus) {
			aiMenuRef.current.querySelector<HTMLElement>('summary')?.focus();
		}
	};

	const link = async (resourceId: string) => {
		const mention = await mentionService.linkSelection({
			resourceId,
			chapterId,
			...(sceneId ? { sceneId } : {}),
			manuscript,
			start: selection.start,
			end: selection.end,
			textRevision: 0
		});
		onLinked(mention);
	};

	const linkExisting = async () => {
		const resourceId = window.prompt('输入要链接的 Story 资源 ID，例如 character:lin-yue');
		if (!resourceId) {
			return;
		}
		setBusy(true);
		try {
			await link(resourceId.trim());
			setError(undefined);
		} catch (reason) {
			setError(selectionActionErrorMessage(
				reason,
				'无法链接所选资源。请检查资源 ID 和当前选区后重试。'
			));
		} finally {
			setBusy(false);
		}
	};

	const createAndLink = async (type: StoryResourceType) => {
		if (!selectedTitle) {
			return;
		}
		setBusy(true);
		try {
			const prefix = type === 'information'
				? 'information'
				: type;
			const timestamp = new Date().toISOString();
			const base = {
				id: createStoryId(prefix),
				type,
				title: selectedTitle,
				aliases: [],
				tags: [],
				schemaVersion: 1 as const,
				createdAt: timestamp,
				updatedAt: timestamp,
				revision: 0,
				evidenceIds: []
			};
			const resource = type === 'item'
				? { ...base, unique: true, restrictions: [] }
				: type === 'information'
					? { ...base, truthStatement: selectedTitle, authorSecret: false }
					: base;
			const saved = await repository.save(resource, 0);
			await link(saved.id);
			setError(undefined);
		} catch (reason) {
			setError(selectionActionErrorMessage(
				reason,
				'资料候选创建失败，本次没有写入项目。请重试。'
			));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="selection-action-menu" role="toolbar" aria-label="选区 Story 操作">
			<span className="selection-action-preview" title={selection.text}>{selection.text}</span>
			<button
				data-testid="selection-action-link-existing"
				type="button"
				disabled={readOnly || busy}
				onClick={() => void linkExisting()}
			>
				<Link2 size={16} />链接已有资源
			</button>
			{onQuickCapture && (
				<button
					type="button"
					disabled={readOnly || busy}
					onClick={onQuickCapture}
				>
					<Lightbulb size={16} />记录想法
				</button>
			)}
			<details
				ref={aiMenuRef}
				data-testid="selection-action-ai-disclosure"
				className="selection-contextual-ai"
				onToggle={event => {
					const open = event.currentTarget.open;
					setAiMenuOpen(open);
					if (aiMenuWasOpenRef.current && !open) onAiMenuClosed?.();
					aiMenuWasOpenRef.current = open;
				}}
				onKeyDown={event => {
					if (event.key !== 'Escape' || !aiMenuRef.current?.open) return;
					closeAiMenu(true);
				}}
			>
				<summary
					role="button"
					aria-label="AI 选区操作"
					aria-disabled={readOnly || busy || !selectedTitle}
					onClick={event => {
						if (readOnly || busy || !selectedTitle) {
							event.preventDefault();
							return;
						}
						if (!aiMenuRef.current?.open) {
							const rect = event.currentTarget.getBoundingClientRect();
							const menuWidth = Math.min(330, window.innerWidth - 24);
							setAiMenuPosition({
								left: Math.max(
									12,
									Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)
								),
								bottom: Math.max(12, window.innerHeight - rect.top + 10)
							});
						}
					}}
				>
					<Sparkles size={16} />AI 选区操作
				</summary>
			</details>
			{aiMenuOpen && createPortal(
				<div
					ref={aiMenuPopupRef}
					className="selection-contextual-ai-menu"
					role="menu"
					aria-label="AI 选区操作"
					style={aiMenuPosition}
					onKeyDown={event => {
						if (event.key === 'Escape') {
							event.preventDefault();
							closeAiMenu(true);
							return;
						}
						const items = Array.from(
							event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
						);
						const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
						let nextIndex: number | undefined;
						if (event.key === 'ArrowDown') {
							nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
						} else if (event.key === 'ArrowUp') {
							nextIndex = currentIndex < 0
								? items.length - 1
								: (currentIndex - 1 + items.length) % items.length;
						} else if (event.key === 'Home') {
							nextIndex = 0;
						} else if (event.key === 'End') {
							nextIndex = items.length - 1;
						}
						if (nextIndex === undefined || items.length === 0) return;
						event.preventDefault();
						items[nextIndex]?.focus();
					}}
				>
					{contextualActions.primary.map(action => action.kind === 'rewrite' && (
						<button
							key={action.id}
							data-testid="selection-action-rewrite"
							type="button"
							role="menuitem"
							aria-label={action.label}
							data-contextual-ai="primary"
							onClick={() => {
								onRewrite(action.actionType);
								if (aiMenuRef.current) aiMenuRef.current.open = false;
							}}
						>
							<strong>{action.label}</strong>
							<span>{action.description}</span>
						</button>
					))}
					{contextualActions.secondary.length > 0 && (
						<div className="selection-contextual-ai-more">
							<span>更多</span>
							{contextualActions.secondary.map(action => action.kind === 'rewrite' && (
								<button
									key={action.id}
									data-testid="selection-action-rewrite"
									type="button"
									role="menuitem"
									aria-label={action.label}
									data-contextual-ai="secondary"
									onClick={() => {
										onRewrite(action.actionType);
										if (aiMenuRef.current) aiMenuRef.current.open = false;
									}}
								>
									<strong>{action.label}</strong>
									<span>{action.description}</span>
								</button>
							))}
						</div>
					)}
				</div>,
				document.body
			)}
			{creationActions.map(action => {
				const Icon = action.icon;
				return (
					<button
						key={action.type}
						data-testid="selection-action-create-resource"
						type="button"
						className="selection-action-create"
						data-resource-action={action.type}
						disabled={readOnly || busy || !selectedTitle}
						onClick={() => {
							if (onGenerateResource) {
								onGenerateResource(action.type);
							} else {
								void createAndLink(action.type);
							}
						}}
					>
						<Icon size={16} />{action.label}
					</button>
				);
			})}
			{error && <span className="selection-action-error" role="status">{error}</span>}
		</div>
	);
}
