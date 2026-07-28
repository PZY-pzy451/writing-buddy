import { AlertTriangle, BookOpenCheck, Link2, Save, X } from 'lucide-react';
import { useState } from 'react';
import type { RuleIssue, TimelineEvent } from '@writing-buddy/story-kernel';

interface EventInspectorProps {
	readonly event: TimelineEvent;
	readonly saving: boolean;
	readonly labels: Readonly<Record<string, string>>;
	readonly ruleIssues: readonly RuleIssue[];
	readonly onSave: (event: TimelineEvent) => Promise<void>;
	readonly onClose: () => void;
}

export function EventInspector({
	event,
	saving,
	labels,
	ruleIssues,
	onSave,
	onClose
}: EventInspectorProps): React.JSX.Element {
	const [draft, setDraft] = useState(event);
	return (
		<aside className="event-inspector">
			<header>
				<div><span className="eyebrow">EVENT INSPECTOR</span><h2>{event.title}</h2></div>
				<button type="button" aria-label="关闭事件详情" onClick={onClose}><X size={18} /></button>
			</header>
			<div className="event-form-grid">
				<label>
					<span>事件标题</span>
					<input
						aria-label="事件标题"
						value={draft.title}
						onChange={change => setDraft(current => ({ ...current, title: change.target.value }))}
					/>
				</label>
				<label>
					<span>事件类型</span>
					<input
						value={draft.eventType}
						onChange={change => setDraft(current => ({ ...current, eventType: change.target.value }))}
					/>
				</label>
				<label>
					<span>实际开始</span>
					<input
						value={draft.storyStart ?? ''}
						placeholder="ISO 时间、日期或留空"
						onChange={change => setDraft(current => ({
							...current,
							storyStart: change.target.value || undefined,
							storyTimeKind: change.target.value ? 'exact' : 'unknown'
						}))}
					/>
				</label>
				<label>
					<span>实际结束</span>
					<input
						value={draft.storyEnd ?? ''}
						onChange={change => setDraft(current => ({
							...current,
							storyEnd: change.target.value || undefined
						}))}
					/>
				</label>
				<label>
					<span>叙事位置</span>
					<input
						type="number"
						min={0}
						value={draft.narrativePosition.narrativeOrder}
						onChange={change => setDraft(current => ({
							...current,
							narrativePosition: {
								...current.narrativePosition,
								narrativeOrder: Math.max(0, Number(change.target.value))
							}
						}))}
					/>
				</label>
			</div>
			<div className="event-inspector-meta">
				<span><Link2 size={13} />前置事件 {event.predecessorIds.length}</span>
				<span><Link2 size={13} />后果事件 {event.consequenceIds.length}</span>
				<span><BookOpenCheck size={13} />来源 {event.evidenceIds.length}</span>
			</div>
			<section className="event-inspector-section">
				<h3>前置与结果</h3>
				<p>{event.predecessorIds.length
					? event.predecessorIds.map(id => labels[id] ?? id).join('、')
					: '无前置事件'}</p>
				<ul>{event.directResults.map(result => <li key={result}>{result}</li>)}</ul>
			</section>
			<section className="event-inspector-section">
				<h3>后续影响</h3>
				{event.impacts.length
					? <ul>{event.impacts.map(impact => <li key={impact}>{impact}</li>)}</ul>
					: <p>尚未记录影响。</p>}
			</section>
			<section className="event-inspector-section">
				<h3>剧情线与伏笔</h3>
				<p>{[...event.plotThreadIds, ...event.foreshadowingIds]
					.map(id => labels[id] ?? id).join('、') || '尚未关联'}</p>
			</section>
			<section className="event-inspector-section">
				<h3>确定性检查</h3>
				{ruleIssues.length ? ruleIssues.map(issue => (
					<p className="event-rule-issue" key={issue.id}><AlertTriangle size={13} />{issue.title}</p>
				)) : <p>本地规则通过。</p>}
			</section>
			{event.evidenceIds.map(id => <code key={id}>{id}</code>)}
			<button
				type="button"
				className="event-save"
				disabled={saving || !draft.title.trim() || !draft.eventType.trim()}
				onClick={() => void onSave({ ...draft, updatedAt: new Date().toISOString() })}
			>
				<Save size={16} />{saving ? '保存中…' : '保存事件'}
			</button>
		</aside>
	);
}
