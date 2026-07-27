import {
	BookmarkPlus,
	Eye,
	Gem,
	Link2,
	MapPin,
	UserPlus
} from 'lucide-react';
import { useState } from 'react';
import {
	createStoryId,
	type MentionLink,
	type StoryRepository,
	type StoryResourceType
} from '@writing-buddy/story-kernel';
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
}

const creationActions = [
	{ type: 'character', label: '创建人物', icon: UserPlus },
	{ type: 'location', label: '创建地点', icon: MapPin },
	{ type: 'item', label: '创建物品', icon: Gem },
	{ type: 'information', label: '标记为信息揭示', icon: Eye },
	{ type: 'foreshadowing', label: '创建伏笔', icon: BookmarkPlus }
] as const;

export function SelectionActionMenu({
	repository,
	mentionService,
	chapterId,
	sceneId,
	manuscript,
	selection,
	readOnly,
	onLinked
}: SelectionActionMenuProps): React.JSX.Element {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const selectedTitle = selection.text.trim().slice(0, 160);

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
			setError(reason instanceof Error ? reason.message : 'mentionLinkFailed');
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
				: base;
			const saved = await repository.save(resource, 0);
			await link(saved.id);
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'storyResourceCreateFailed');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="selection-action-menu" role="toolbar" aria-label="选区 Story 操作">
			<span className="selection-action-preview" title={selection.text}>{selection.text}</span>
			<button type="button" disabled={readOnly || busy} onClick={() => void linkExisting()}>
				<Link2 size={15} />链接已有资源
			</button>
			{creationActions.map(action => {
				const Icon = action.icon;
				return (
					<button
						key={action.type}
						type="button"
						disabled={readOnly || busy || !selectedTitle}
						onClick={() => void createAndLink(action.type)}
					>
						<Icon size={15} />{action.label}
					</button>
				);
			})}
			{error && <span className="selection-action-error" role="status">{error}</span>}
		</div>
	);
}
