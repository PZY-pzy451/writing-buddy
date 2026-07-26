import type { ResourceDescriptor, ResourceType } from '@writing-buddy/domain';

export interface ResourceEditorDefinition {
	readonly type: ResourceType;
	readonly label: string;
	readonly icon: string;
	readonly editable: boolean;
	readonly extensions: readonly string[];
}

const definitions: readonly ResourceEditorDefinition[] = [
	{ type: 'chapter', label: '章节', icon: 'file-text', editable: true, extensions: ['.md'] },
	{ type: 'note', label: '笔记', icon: 'notebook-pen', editable: true, extensions: ['.md'] },
	{ type: 'character', label: '人物', icon: 'user-round', editable: true, extensions: ['.json'] },
	{ type: 'worldbuilding', label: '世界观', icon: 'globe-2', editable: true, extensions: ['.json', '.md'] },
	{ type: 'timeline', label: '时间线', icon: 'history', editable: true, extensions: ['.json'] },
	{ type: 'item', label: '物品', icon: 'gem', editable: true, extensions: ['.json'] },
	{ type: 'review', label: '审校', icon: 'list-checks', editable: false, extensions: [] },
	{ type: 'version', label: '版本', icon: 'git-compare-arrows', editable: false, extensions: [] },
	{ type: 'trash', label: '回收站', icon: 'trash-2', editable: false, extensions: [] },
	{ type: 'settings', label: '设置', icon: 'settings-2', editable: true, extensions: [] }
];

export class ResourceRegistry {
	private readonly byType = new Map(definitions.map(definition => [definition.type, definition]));

	get(type: ResourceType): ResourceEditorDefinition {
		const definition = this.byType.get(type);
		if (!definition) {
			throw new Error(`Unsupported resource type: ${type}`);
		}
		return definition;
	}

	list(): readonly ResourceEditorDefinition[] {
		return definitions;
	}
}

export function resourceKey(resource: ResourceDescriptor): string {
	return `${resource.projectId}:${resource.type}:${resource.id}`;
}
