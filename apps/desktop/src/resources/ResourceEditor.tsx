import { CalendarClock, Gem, Globe2, Save, UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../app/store';

interface EditableResourceDocument {
	schemaVersion?: number;
	id?: string;
	name?: string;
	age?: number;
	gender?: string;
	personality?: string;
	background?: string;
	notes?: string;
	region?: string;
	faction?: string;
	era?: string;
	rules?: string;
	type?: string;
	status?: string;
	owner?: string;
	location?: string;
	description?: string;
	events?: TimelineEvent[];
	updatedAt?: string;
}

interface TimelineEvent {
	id: string;
	when: string;
	label: string;
	description?: string;
	chapterId?: string;
}

function TextField(props: {
	readonly label: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly multiline?: boolean;
}): React.JSX.Element {
	return (
		<label className={`form-field ${props.multiline ? 'is-multiline' : ''}`}>
			<span>{props.label}</span>
			{props.multiline
				? <textarea value={props.value} onChange={event => props.onChange(event.target.value)} />
				: <input value={props.value} onChange={event => props.onChange(event.target.value)} />}
		</label>
	);
}

export function ResourceEditor(): React.JSX.Element {
	const activeResource = useAppStore(state => state.activeResource);
	const content = useAppStore(state => state.resourceContent) ?? '{}';
	const setContent = useAppStore(state => state.setResourceContent);
	const save = useAppStore(state => state.save);
	const readOnly = useAppStore(state => state.snapshot?.readOnly ?? true);

	const document = useMemo(() => {
		try {
			return JSON.parse(content) as EditableResourceDocument;
		} catch {
			return {};
		}
	}, [content]);

	if (!activeResource) {
		return <div className="canvas-empty">选择一项写作资料。</div>;
	}
	if (activeResource.type === 'note') {
		return <div className="canvas-empty">笔记使用正文编辑器打开。</div>;
	}

	const update = (patch: Partial<EditableResourceDocument>) => {
		if (readOnly) {
			return;
		}
		setContent(`${JSON.stringify({
			...document,
			...patch,
			schemaVersion: document.schemaVersion ?? 1,
			id: document.id ?? activeResource.id,
			updatedAt: new Date().toISOString()
		}, undefined, 2)}\n`);
	};

	const icon = activeResource.type === 'character'
		? <UserRound size={23} />
		: activeResource.type === 'worldbuilding'
			? <Globe2 size={23} />
			: activeResource.type === 'timeline'
				? <CalendarClock size={23} />
				: <Gem size={23} />;

	return (
		<div className="resource-editor">
			<div className="resource-editor-title">
				<div className="resource-editor-icon">{icon}</div>
				<div>
					<span>{activeResource.type === 'character' ? '人物卡' : activeResource.type === 'worldbuilding' ? '世界设定' : activeResource.type === 'timeline' ? '时间线' : '物品卡'}</span>
					<h2>{document.name ?? activeResource.title}</h2>
				</div>
				<button className="primary-button" type="button" onClick={() => void save()} disabled={readOnly}><Save size={17} /> 保存资料</button>
			</div>

			{activeResource.type === 'timeline' ? (
				<div className="timeline-editor">
					{(document.events ?? []).map((event, index) => (
						<article className="timeline-event" key={event.id}>
							<div className="timeline-dot" aria-hidden="true" />
							<TextField
								label="时间"
								value={event.when}
								onChange={value => {
									const events = [...(document.events ?? [])];
									events[index] = { ...event, when: value };
									update({ events });
								}}
							/>
							<TextField
								label="事件"
								value={event.label}
								onChange={value => {
									const events = [...(document.events ?? [])];
									events[index] = { ...event, label: value };
									update({ events });
								}}
							/>
							<TextField
								label="说明"
								value={event.description ?? ''}
								multiline
								onChange={value => {
									const events = [...(document.events ?? [])];
									events[index] = { ...event, description: value };
									update({ events });
								}}
							/>
						</article>
					))}
					{(document.events ?? []).length === 0 && <p className="empty-hint">还没有时间线事件。</p>}
				</div>
			) : (
				<div className="resource-form-grid">
					<TextField label="名称" value={document.name ?? activeResource.title} onChange={name => update({ name })} />
					{activeResource.type === 'character' && (
						<>
							<TextField label="年龄" value={document.age?.toString() ?? ''} onChange={value => update({ age: Number(value) || undefined })} />
							<TextField label="性别" value={document.gender ?? ''} onChange={gender => update({ gender })} />
							<TextField label="性格" value={document.personality ?? ''} onChange={personality => update({ personality })} multiline />
							<TextField label="背景" value={document.background ?? ''} onChange={background => update({ background })} multiline />
						</>
					)}
					{activeResource.type === 'worldbuilding' && (
						<>
							<TextField label="地区" value={document.region ?? ''} onChange={region => update({ region })} />
							<TextField label="势力" value={document.faction ?? ''} onChange={faction => update({ faction })} />
							<TextField label="时代" value={document.era ?? ''} onChange={era => update({ era })} />
							<TextField label="规则" value={document.rules ?? ''} onChange={rules => update({ rules })} multiline />
						</>
					)}
					{activeResource.type === 'item' && (
						<>
							<TextField label="类型" value={document.type ?? ''} onChange={type => update({ type })} />
							<TextField label="状态" value={document.status ?? ''} onChange={status => update({ status })} />
							<TextField label="持有人" value={document.owner ?? ''} onChange={owner => update({ owner })} />
							<TextField label="位置" value={document.location ?? ''} onChange={location => update({ location })} />
							<TextField label="描述" value={document.description ?? ''} onChange={description => update({ description })} multiline />
						</>
					)}
					<TextField label="备注" value={document.notes ?? ''} onChange={notes => update({ notes })} multiline />
				</div>
			)}
		</div>
	);
}
