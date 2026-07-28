import {
	BookOpenText,
	Check,
	ChevronDown,
	EyeOff,
	LockKeyhole,
	ShieldCheck
} from 'lucide-react';
import { useState } from 'react';
import {
	contextPriorities,
	withContextItemIncluded,
	type ContextPack,
	type ContextPriority
} from '@writing-buddy/story-kernel';
import './ContextPackPreview.css';

const priorityLabels: Readonly<Record<ContextPriority, string>> = {
	P0: '作者指令',
	P1: '当前选区',
	P2: '当前场景',
	P3: '人物状态',
	P4: '地点、物品与规则',
	P5: '剧情线、伏笔与信息',
	P6: '相邻章节摘要'
};

export function ContextPackPreview({
	pack,
	onChange
}: {
	readonly pack: ContextPack;
	readonly onChange: (pack: ContextPack) => void;
}): React.JSX.Element {
	const [expanded, setExpanded] = useState<string>();
	const percentage = Math.min(100, Math.round(pack.estimatedTokens / pack.budgetTokens * 100));

	return (
		<section className="context-pack-preview" aria-label="AI Context Pack 预览">
			<header>
				<div>
					<span className="eyebrow">GROUNDED CONTEXT</span>
					<h3>将发送的资料</h3>
					<p>仅发送已勾选项目；作者秘密默认关闭。</p>
				</div>
				<span className="context-pack-safe"><ShieldCheck size={16} />路径与密钥未包含</span>
			</header>
			<div className="context-budget" aria-label={`Token 预算已使用 ${percentage}%`}>
				<div>
					<span>预计 {pack.estimatedTokens.toLocaleString()} tokens</span>
					<strong>预算 {pack.budgetTokens.toLocaleString()}</strong>
				</div>
				<div className="context-budget-track"><span style={{ width: `${percentage}%` }} /></div>
			</div>
			<div className="context-priority-groups">
				{contextPriorities.map(priority => {
					const items = pack.items.filter(item => item.priority === priority);
					if (items.length === 0) return null;
					const groupLabel = priority === 'P1'
						? items[0]?.title ?? priorityLabels[priority]
						: priorityLabels[priority];
					return (
						<section key={priority}>
							<header><span>{priority}</span><strong>{groupLabel}</strong><em>{items.filter(item => item.included).length}/{items.length}</em></header>
							{items.map(item => (
								<article className={item.included ? 'is-included' : 'is-excluded'} key={item.id}>
									<label>
										<input
											type="checkbox"
											checked={item.included}
											disabled={item.required}
											onChange={event => onChange(withContextItemIncluded(pack, item.id, event.target.checked))}
										/>
										<span aria-hidden="true">{item.included ? <Check size={14} /> : null}</span>
										<div><strong>{item.title}</strong><small>{item.estimatedTokens} tokens</small></div>
										{item.required ? <em><LockKeyhole size={13} />必选</em> : null}
										{item.authorSecret ? <em className="is-secret"><EyeOff size={13} />作者秘密</em> : null}
									</label>
									<button
										type="button"
										aria-label={`${expanded === item.id ? '收起' : '展开'}${item.title}`}
										aria-expanded={expanded === item.id}
										onClick={() => setExpanded(current => current === item.id ? undefined : item.id)}
									>
										<BookOpenText size={15} /><span>查看内容</span><ChevronDown size={14} />
									</button>
									{expanded === item.id ? <pre>{item.content}</pre> : null}
									{item.excludedReason === 'token-budget' ? <p>已按 Token 预算从低优先级自动裁剪。</p> : null}
								</article>
							))}
						</section>
					);
				})}
			</div>
		</section>
	);
}
