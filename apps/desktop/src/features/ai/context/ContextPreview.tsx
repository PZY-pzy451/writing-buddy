import {
	Check,
	EyeOff,
	FileText,
	LockKeyhole,
	ShieldCheck
} from 'lucide-react';
import {
	listAiContextRecords,
	type AiContextPack
} from '@writing-buddy/ai-actions';
import './ContextPreview.css';

const kindLabels = {
	project: '作品',
	'current-resource': '当前资料',
	selection: '当前选区',
	scene: '场景',
	entity: '人物与实体',
	event: '事件',
	'plot-thread': '剧情线',
	foreshadowing: '伏笔',
	'world-rule': '世界规则',
	'knowledge-rule': '信息权限',
	'style-profile': '文风'
} as const;

export function ContextPreview({
	pack,
	onToggle
}: {
	readonly pack?: AiContextPack;
	readonly onToggle: (key: string, included: boolean) => void;
}): React.JSX.Element {
	const records = pack ? listAiContextRecords(pack) : [];
	if (!pack || records.length === 0) {
		return (
			<section className="ai-context-preview ai-context-empty">
				<FileText size={22} />
				<div>
					<strong>尚未打开作品</strong>
					<p>打开作品和章节后，这里会列出真正发送给 DeepSeek 的资料。</p>
				</div>
			</section>
		);
	}
	const percentage = Math.min(
		100,
		Math.round(pack.tokenEstimate / pack.budgetTokens * 100)
	);
	return (
		<section className="ai-context-preview" aria-label="AI 参考上下文">
			<header>
				<div>
					<span>参考上下文</span>
					<strong>将发送给 DeepSeek</strong>
				</div>
				<em><ShieldCheck size={15} />路径与密钥未包含</em>
			</header>
			<div className="ai-context-meter">
				<div><span>预计 {pack.tokenEstimate.toLocaleString()} Tokens</span><span>{percentage}%</span></div>
				<div><span style={{ width: `${percentage}%` }} /></div>
			</div>
			<div className="ai-context-records">
				{records.map(record => (
					<label key={record.key} className={record.included ? 'is-included' : 'is-excluded'}>
						<input
							type="checkbox"
							checked={record.included}
							disabled={record.required}
							onChange={event => onToggle(record.key, event.target.checked)}
						/>
						<span className="ai-context-check" aria-hidden="true">
							{record.included ? <Check size={14} /> : null}
						</span>
						<div>
							<strong>{record.title}</strong>
							<small>{kindLabels[record.kind]} · {record.tokenEstimate} tokens</small>
						</div>
						{record.required ? <em><LockKeyhole size={13} />必选</em> : null}
						{record.authorSecret ? <em className="is-secret"><EyeOff size={13} />作者秘密</em> : null}
					</label>
				))}
			</div>
			<p className="ai-context-footnote">
				作者秘密默认关闭；取消勾选的资料不会进入请求。
			</p>
		</section>
	);
}
