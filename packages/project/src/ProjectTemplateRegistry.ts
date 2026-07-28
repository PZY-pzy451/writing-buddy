export type ProjectType = 'longform' | 'novella' | 'short' | 'series';
export type ProjectThemeId = 'paper' | 'midnight' | 'fog' | 'focus';
export type ProjectAccentId = 'gold' | 'blue' | 'purple';
export type InitialResourceId =
	| 'first-volume'
	| 'first-chapter'
	| 'character-category'
	| 'worldbuilding-category'
	| 'timeline'
	| 'plot-and-foreshadowing'
	| 'sample-content'
	| 'ai-quick-actions';

export interface InitialResourceDefinition {
	readonly id: InitialResourceId;
	readonly title: string;
	readonly description: string;
	readonly defaultSelected: boolean;
}

export interface ProjectTemplateDefinition {
	readonly id: string;
	readonly version: number;
	readonly title: string;
	readonly description: string;
	readonly projectType: ProjectType;
	readonly initialResources: readonly InitialResourceDefinition[];
	readonly defaultThemeId: ProjectThemeId;
	readonly defaultAccentId: ProjectAccentId;
	readonly aiQuickActionsEnabled: boolean;
}

const initialResources: readonly InitialResourceDefinition[] = [
	{ id: 'first-volume', title: '创建第一卷', description: '建立可继续扩展的卷结构。', defaultSelected: true },
	{ id: 'first-chapter', title: '创建第一章草稿', description: '创建空白章节并在完成后打开。', defaultSelected: true },
	{ id: 'character-category', title: '人物分类', description: '准备人物资料目录。', defaultSelected: true },
	{ id: 'worldbuilding-category', title: '世界观分类', description: '准备地点与设定资料目录。', defaultSelected: true },
	{ id: 'timeline', title: '时间线', description: '准备结构化时间事件目录。', defaultSelected: false },
	{ id: 'plot-and-foreshadowing', title: '剧情线与伏笔', description: '准备剧情线和伏笔资源目录。', defaultSelected: true },
	{ id: 'sample-content', title: '示例内容', description: '只创建使用提示，不生成小说正文。', defaultSelected: false },
	{ id: 'ai-quick-actions', title: 'StoryForge AI 快速入口', description: '显示 AI 工作流入口，不自动发起请求。', defaultSelected: true }
];

function resources(overrides: Partial<Record<InitialResourceId, boolean>> = {}): readonly InitialResourceDefinition[] {
	return initialResources.map(resource => ({
		...resource,
		defaultSelected: overrides[resource.id] ?? resource.defaultSelected
	}));
}

export const builtInProjectTemplates: readonly ProjectTemplateDefinition[] = [
	{
		id: 'blank-longform',
		version: 1,
		title: '空白长篇',
		description: '保留最少结构，从第一章开始自由创作。',
		projectType: 'longform',
		initialResources: resources(),
		defaultThemeId: 'paper',
		defaultAccentId: 'gold',
		aiQuickActionsEnabled: true
	},
	{
		id: 'mystery-longform',
		version: 1,
		title: '悬疑长篇',
		description: '预备时间线、剧情线和伏笔结构，不生成正文。',
		projectType: 'longform',
		initialResources: resources({ timeline: true }),
		defaultThemeId: 'midnight',
		defaultAccentId: 'blue',
		aiQuickActionsEnabled: true
	},
	{
		id: 'fantasy-longform',
		version: 1,
		title: '奇幻长篇',
		description: '优先准备人物与世界观资料结构。',
		projectType: 'longform',
		initialResources: resources(),
		defaultThemeId: 'paper',
		defaultAccentId: 'purple',
		aiQuickActionsEnabled: true
	},
	{
		id: 'science-fiction-longform',
		version: 1,
		title: '科幻长篇',
		description: '预备世界规则、时间线与剧情规划结构。',
		projectType: 'longform',
		initialResources: resources({ timeline: true }),
		defaultThemeId: 'fog',
		defaultAccentId: 'blue',
		aiQuickActionsEnabled: true
	},
	{
		id: 'realist-fiction',
		version: 1,
		title: '现实题材',
		description: '以正文、人物和现实场景资料为主。',
		projectType: 'longform',
		initialResources: resources(),
		defaultThemeId: 'focus',
		defaultAccentId: 'gold',
		aiQuickActionsEnabled: true
	},
	{
		id: 'custom',
		version: 1,
		title: '自定义模板',
		description: '从最少默认项开始，自行选择初始结构。',
		projectType: 'longform',
		initialResources: resources({
			'character-category': false,
			'worldbuilding-category': false,
			'plot-and-foreshadowing': false,
			'ai-quick-actions': false
		}),
		defaultThemeId: 'paper',
		defaultAccentId: 'gold',
		aiQuickActionsEnabled: false
	}
];

export class ProjectTemplateRegistry {
	private readonly templates: ReadonlyMap<string, ProjectTemplateDefinition>;

	constructor(definitions: readonly ProjectTemplateDefinition[] = builtInProjectTemplates) {
		const templates = new Map<string, ProjectTemplateDefinition>();
		for (const definition of definitions) {
			if (!definition.id.trim() || templates.has(definition.id)) {
				throw new Error('duplicateProjectTemplateId');
			}
			if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
				throw new Error('invalidProjectTemplateVersion');
			}
			if (!definition.initialResources.length) {
				throw new Error('missingProjectTemplateResources');
			}
			const resourceIds = new Set<string>();
			for (const resource of definition.initialResources) {
				if (resourceIds.has(resource.id)) {
					throw new Error('duplicateInitialResourceId');
				}
				resourceIds.add(resource.id);
			}
			templates.set(definition.id, Object.freeze({
				...definition,
				initialResources: Object.freeze(definition.initialResources.map(resource => Object.freeze({ ...resource })))
			}));
		}
		this.templates = templates;
	}

	list(): readonly ProjectTemplateDefinition[] {
		return [...this.templates.values()];
	}

	get(id: string): ProjectTemplateDefinition {
		const template = this.templates.get(id);
		if (!template) {
			throw new Error('unknownProjectTemplate');
		}
		return template;
	}
}

export const projectTemplateRegistry = new ProjectTemplateRegistry();

