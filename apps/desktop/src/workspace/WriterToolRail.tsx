import {
	BookOpenText,
	ClipboardCheck,
	ListTree,
	Sparkles
} from 'lucide-react';
import { useAppStore } from '../app/store';
import type { WriterToolId } from '../app/writerWorkspace';

const tools: readonly {
	readonly id: WriterToolId;
	readonly label: string;
	readonly description: string;
	readonly icon: typeof ListTree;
}[] = [
	{
		id: 'outline',
		label: '细纲',
		description: '查看当前场景和章节细纲',
		icon: ListTree
	},
	{
		id: 'references',
		label: '资料',
		description: '查看当前场景相关资料',
		icon: BookOpenText
	},
	{
		id: 'ai',
		label: 'AI',
		description: '打开现有情境化写作工具',
		icon: Sparkles
	},
	{
		id: 'review',
		label: '检查',
		description: '运行本地检查并查看问题',
		icon: ClipboardCheck
	}
];

export function WriterToolRail(): React.JSX.Element {
	const assistantOpen = useAppStore(state => state.assistantOpen);
	const writerTool = useAppStore(state => state.writerTool);
	const openWriterTool = useAppStore(state => state.openWriterTool);
	const closeWriterTool = useAppStore(state => state.closeWriterTool);

	return (
		<nav className="writer-tool-rail" aria-label="写作工具">
			{tools.map(tool => {
				const Icon = tool.icon;
				const active = assistantOpen && writerTool === tool.id;
				return (
					<button
						key={tool.id}
						type="button"
						className={active ? 'is-active' : ''}
						aria-pressed={active}
						aria-label={tool.id === 'review' ? '检查工具' : tool.label}
						title={`${tool.label}：${tool.description}`}
						onClick={() => {
							if (active) closeWriterTool();
							else openWriterTool(tool.id);
						}}
					>
						<Icon size={20} aria-hidden="true" />
						<span>{tool.label}</span>
					</button>
				);
			})}
		</nav>
	);
}
