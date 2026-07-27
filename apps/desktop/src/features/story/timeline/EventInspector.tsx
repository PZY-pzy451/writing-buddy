import { BookOpenCheck, Link2, Save, X } from 'lucide-react';
import { useState } from 'react';
import type { TimelineEvent } from '@writing-buddy/story-kernel';

interface EventInspectorProps {
	readonly event: TimelineEvent;
	readonly saving: boolean;
	readonly onSave: (event: TimelineEvent) => Promise<void>;
	readonly onClose: () => void;
}

export function EventInspector({
	event,
	saving,
	onSave,
	onClose
}: EventInspectorProps): React.JSX.Element {
	const [draft, setDraft] = useState(event);
	return (
		<aside className="event-inspector">
			<header>
				<div><span className="eyebrow">EVENT INSPECTOR</span><h2>{event.title}</h2></div>
				<button type="button" aria-label="关闭事件详情" onClick={onClose}><X size={17} /></button>
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
