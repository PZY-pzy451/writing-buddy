import { Database, FileQuestion, RefreshCw, RotateCcw } from 'lucide-react';
import type {
	StoryOpenResult,
	StoryResourceReference
} from '../application/StoryResourceOpenService';

interface StoryResourceViewProps {
	readonly result?: StoryOpenResult;
	readonly onRetry: (reference: StoryResourceReference) => void;
	readonly onRestore: () => void;
	readonly backlinks?: React.ReactNode;
}

export function StoryResourceView({
	result,
	onRetry,
	onRestore,
	backlinks
}: StoryResourceViewProps): React.JSX.Element {
	if (!result) {
		return (
			<section className="story-resource-state" aria-live="polite">
				<Database size={28} />
				<h2>正在读取 Story Kernel 资源</h2>
			</section>
		);
	}

	if (result.status === 'missing') {
		return (
			<section className="story-resource-state is-missing" role="alert">
				<FileQuestion size={34} />
				<span className="story-resource-eyebrow">{result.registration.label}</span>
				<h2>资源不存在</h2>
				<p>该资源可能已被移入回收区，或由其他设备删除。标签已保留，项目正文未被修改。</p>
				<code>{result.reference.id}</code>
				<div className="story-resource-actions">
					<button type="button" onClick={onRestore}>
						<RotateCcw size={18} />从回收区恢复
					</button>
					<button type="button" className="secondary" onClick={() => onRetry(result.reference)}>
						<RefreshCw size={18} />重新检查
					</button>
				</div>
			</section>
		);
	}

	return (
		<section className="story-resource-state is-ready">
			<Database size={30} />
			<span className="story-resource-eyebrow">{result.registration.label}</span>
			<h2>{result.resource.title}</h2>
			<p>
				该资源已通过 Story Kernel 加载。当前 Gate 提供稳定的打开、标签恢复和缺失恢复状态；
				专业编辑视图将在对应功能 Gate 中启用。
			</p>
			<dl className="story-resource-facts">
				<div><dt>类型</dt><dd>{result.reference.type}</dd></div>
				<div><dt>资源 ID</dt><dd>{result.reference.id}</dd></div>
				<div><dt>Revision</dt><dd>{result.resource.revision}</dd></div>
			</dl>
			{backlinks}
		</section>
	);
}
