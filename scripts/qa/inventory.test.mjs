import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');

describe('control inventory rendered-element boundary', () => {
	it('TC-QA-INVENTORY-004 excludes React composite component declarations', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const compositeControls = inventory.controls.filter(control => (
			/^[A-Z]/u.test(control.controlType)
		));

		expect(compositeControls.map(control => control.controlType)).toEqual([]);
		expect(inventory.controls.some(control => control.controlType === 'button')).toBe(true);
		expect(inventory.controls.some(control => control.controlType === 'article')).toBe(true);
	});

	it('TC-QA-INVENTORY-005 requires stable selectors for the zero-to-draft creation journey', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const creationJourneyControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/creation-journey/CreationJourneyPage.tsx'
		));
		const missingSelectors = creationJourneyControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(creationJourneyControls.length).toBeGreaterThan(0);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-006 requires stable selectors for the structured outline workspace', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const outlineControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/creation-journey/StructuredOutlineWorkspace.tsx'
		));
		const missingSelectors = outlineControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(outlineControls.length).toBeGreaterThan(0);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-007 requires stable selectors for the project creation wizard', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const wizardControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/projects/ui/ProjectCreationWizard.tsx'
		));
		const missingSelectors = wizardControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(wizardControls.length).toBeGreaterThan(0);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-008 requires stable selectors for the project structure tree', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const structureTreeControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/projects/ui/ProjectStructureTree.tsx'
		));
		const missingSelectors = structureTreeControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(structureTreeControls).toHaveLength(6);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-009 requires distinct stable controls for the world rule editor', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const editorControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/worldbuilding/WorldRuleEditor.tsx'
		));
		const missingSelectors = editorControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(editorControls).toHaveLength(8);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-010 requires distinct stable controls for the character editor', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const editorControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/characters/CharacterEditor.tsx'
		));
		const missingSelectors = editorControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(editorControls).toHaveLength(11);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-011 requires distinct stable controls for the writer header', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const headerControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/workspace/WriterHeader.tsx'
		));
		const missingSelectors = headerControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(headerControls).toHaveLength(12);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-012 requires stable controls for manuscript extraction actions', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const extractionControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/extraction/ManuscriptExtractionCenterPage.tsx'
		));
		const missingSelectors = extractionControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(extractionControls).toHaveLength(19);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-013 requires distinct stable controls for the global create menu', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const createControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/projects/ui/GlobalCreateMenu.tsx'
		));
		const missingSelectors = createControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(createControls).toHaveLength(7);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-014 requires distinct stable controls for chapter creation', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const chapterControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/projects/ui/ChapterCreationDialog.tsx'
		));
		const missingSelectors = chapterControls.filter(control => (
			control.stableSelectorStatus !== 'MAPPED'
		));

		expect(chapterControls).toHaveLength(6);
		expect(missingSelectors.map(control => control.id)).toEqual([]);
	});

	it('TC-QA-INVENTORY-015 retains distinct selector values for every event inspector control', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const inspectorControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/timeline/EventInspector.tsx'
		));

		expect(inspectorControls).toHaveLength(7);
		expect(inspectorControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(inspectorControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'event-inspector-close',
			'event-inspector-event-type',
			'event-inspector-narrative-order',
			'event-inspector-save',
			'event-inspector-story-end',
			'event-inspector-story-start',
			'event-inspector-title'
		]);
	});
});
