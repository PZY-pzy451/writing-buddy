import {
	ProjectTemplateRegistry,
	builtInProjectTemplates,
	projectTemplateRegistry
} from './ProjectTemplateRegistry';

describe('ProjectTemplateRegistry', () => {
	it('publishes the six versioned built-in templates without manuscript prose', () => {
		expect(projectTemplateRegistry.list().map(template => template.title)).toEqual([
			'空白长篇',
			'悬疑长篇',
			'奇幻长篇',
			'科幻长篇',
			'现实题材',
			'自定义模板'
		]);
		for (const template of projectTemplateRegistry.list()) {
			expect(template.version).toBe(1);
			expect(template.initialResources.length).toBe(8);
			expect(template).not.toHaveProperty('manuscript');
			expect(template).not.toHaveProperty('generatedContent');
		}
	});

	it('rejects duplicate template IDs and unknown lookups', () => {
		expect(() => new ProjectTemplateRegistry([
			builtInProjectTemplates[0],
			{ ...builtInProjectTemplates[0] }
		])).toThrow('duplicateProjectTemplateId');
		expect(() => projectTemplateRegistry.get('missing')).toThrow('unknownProjectTemplate');
	});

	it('keeps sample content off and required blank-project structure on by default', () => {
		const blank = projectTemplateRegistry.get('blank-longform');
		const selected = blank.initialResources
			.filter(resource => resource.defaultSelected)
			.map(resource => resource.id);
		expect(selected).toContain('first-volume');
		expect(selected).toContain('first-chapter');
		expect(selected).toContain('ai-quick-actions');
		expect(selected).not.toContain('sample-content');
	});
});
