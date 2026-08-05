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

	it('TC-QA-INVENTORY-016 retains distinct selector values for every relationship inspector control', () => {
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
			=== 'apps/desktop/src/features/story/relationships/RelationshipInspector.tsx'
		));

		expect(inspectorControls).toHaveLength(4);
		expect(inspectorControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(inspectorControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'relationship-inspector-save',
			'relationship-inspector-strength',
			'relationship-inspector-type',
			'relationship-inspector-visibility'
		]);
	});

	it('TC-QA-INVENTORY-017 maps every story association control to a stable selector', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const associationControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/associations/StoryAssociationPage.tsx'
		));

		expect(associationControls).toHaveLength(9);
		expect(associationControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(associationControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'association-chapter-toggle',
			'association-confirm-save',
			'association-draggable-source',
			'association-foreshadowing-action',
			'association-retry-load',
			'association-transfer-narrative-order',
			'association-transfer-quantity',
			'取消',
			'选择物品转交生效场景'
		]);
		const entityPeekControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/manuscript/EntityPeekCard.tsx'
		));

		expect(entityPeekControls).toHaveLength(5);
		expect(entityPeekControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(entityPeekControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'entity-peek-backlink',
			'entity-peek-candidate',
			'entity-peek-dialog',
			'关闭资料速览',
			'打开完整资料'
		]);
		const selectionActionControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/manuscript/SelectionActionMenu.tsx'
		));

		expect(selectionActionControls).toHaveLength(7);
		expect(selectionActionControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(selectionActionControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'AI 选区操作',
			'AI 选区操作',
			'selection-action-ai-disclosure',
			'selection-action-create-resource',
			'selection-action-link-existing',
			'selection-action-rewrite',
			'记录想法'
		]);
		const contextPackControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/ai-context/ContextPackPreview.tsx'
		));

		expect(contextPackControls).toHaveLength(2);
		expect(contextPackControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(contextPackControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'context-pack-item-disclosure',
			'context-pack-item-toggle'
		]);
		const sceneNavigatorControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/manuscript/SceneNavigator.tsx'
		));

		expect(sceneNavigatorControls).toHaveLength(6);
		expect(sceneNavigatorControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(sceneNavigatorControls.map(control => control.stableSelectorValue)).toContain(
			'scene-navigator-scene'
		);
		const timelineReorderControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/timeline/TimelineReorderRail.tsx'
		));

		expect(timelineReorderControls).toHaveLength(2);
		expect(timelineReorderControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(timelineReorderControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'timeline-reorder-event',
			'timeline-reorder-handle'
		]);
		const continuityReviewControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/continuity/ContinuityReviewPage.tsx'
		));

		expect(continuityReviewControls).toHaveLength(3);
		expect(continuityReviewControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(continuityReviewControls.map(control => control.stableSelectorValue)).toEqual(
			expect.arrayContaining([
				'continuity-issue',
				'按严重程度筛选',
				'重新打开'
			])
		);
		const resizeHandleControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/shell/ResizeHandle.tsx'
		));

		expect(resizeHandleControls).toHaveLength(1);
		expect(resizeHandleControls[0]?.stableSelectorStatus).toBe('MAPPED');
		expect(resizeHandleControls[0]?.stableSelectorValue).toBe('workspace-resize-handle');
		const dashboardControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/dashboard/StoryDashboardPage.tsx'
		));

		expect(dashboardControls).toHaveLength(5);
		expect(dashboardControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(dashboardControls.map(control => control.stableSelectorValue)).toEqual(expect.arrayContaining([
			'story-dashboard-creation-journey',
			'story-dashboard-next-step',
			'story-dashboard-recent-chapter'
		]));
		const closeProtectionControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/save/CloseProtectionDialog.tsx'
		));

		expect(closeProtectionControls).toHaveLength(6);
		expect(closeProtectionControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(closeProtectionControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'close-protection-cancel',
			'close-protection-continue-writing',
			'close-protection-discard',
			'close-protection-resolve-conflict',
			'close-protection-save-copy',
			'close-protection-save-exit'
		]);
		const projectOpenRecoveryControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/projects/ui/ProjectOpenErrorDialog.tsx'
		));

		expect(projectOpenRecoveryControls).toHaveLength(7);
		expect(projectOpenRecoveryControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(projectOpenRecoveryControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'project-open-close',
			'project-open-copy-path',
			'project-open-diagnostics',
			'project-open-directory',
			'project-open-read-only',
			'project-open-repair',
			'project-open-retry'
		]);
		const relationshipGraphControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/relationships/RelationshipGraphPage.tsx'
		));

		expect(relationshipGraphControls).toHaveLength(7);
		expect(relationshipGraphControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(relationshipGraphControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'AI 关系助手',
			'relationship-graph-candidate-edge',
			'relationship-graph-character',
			'relationship-graph-edge',
			'relationship-graph-narrative-position',
			'关系矩阵',
			'重试'
		]);
		const informationControlPageControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/information/InformationControlPage.tsx'
		));

		expect(informationControlPageControls).toHaveLength(5);
		expect(informationControlPageControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(informationControlPageControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'information-fact',
			'information-filter',
			'information-narrative-position',
			'information-retry-load',
			'information-search'
		]);
		const topBarControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/shell/TopBar.tsx'
		));

		expect(topBarControls).toHaveLength(16);
		expect(topBarControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(topBarControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'topbar-ai-quick-actions',
			'topbar-ai-settings',
			'topbar-focus-exit',
			'topbar-focus-toggle',
			'topbar-more-menu',
			'topbar-more-menu-items',
			'topbar-quick-capture',
			'topbar-save',
			'topbar-search',
			'topbar-settings',
			'topbar-workspace-assistant',
			'topbar-workspace-reset-layout',
			'topbar-workspace-sidebar',
			'topbar-writer-assistant',
			'topbar-writer-reset-layout',
			'topbar-writer-sidebar'
		]);
		const quickCaptureControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/quick-capture/QuickCaptureDialog.tsx'
		));

		expect(quickCaptureControls).toHaveLength(5);
		expect(quickCaptureControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(quickCaptureControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'quick-capture-close',
			'quick-capture-dialog',
			'quick-capture-save',
			'quick-capture-text',
			'quick-capture-type'
		]);
		const itemTransferControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/assets/ItemTransferDialog.tsx'
		));

		expect(itemTransferControls).toHaveLength(6);
		expect(itemTransferControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(itemTransferControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'item-transfer-close',
			'item-transfer-commit',
			'item-transfer-holder',
			'item-transfer-location',
			'item-transfer-order',
			'item-transfer-quantity'
		]);
		const dailyWritingGoalControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/progress/DailyWritingGoalControl.tsx'
		));

		expect(dailyWritingGoalControls).toHaveLength(3);
		expect(dailyWritingGoalControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(dailyWritingGoalControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'daily-writing-goal-form',
			'dailyGoal',
			'保存目标'
		]);
		const scenePlotGridControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/plots/ScenePlotGrid.tsx'
		));

		expect(scenePlotGridControls).toHaveLength(5);
		expect(scenePlotGridControls.every(control => control.stableSelectorStatus === 'MAPPED')).toBe(true);
		expect(scenePlotGridControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'scene-plot-grid-filter',
			'scene-plot-grid-link',
			'scene-plot-grid-scene',
			'scene-plot-grid-search',
			'清除筛选'
		]);
		const virtualTimelineControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/timeline/VirtualTimelineList.tsx'
		));

		expect(virtualTimelineControls).toHaveLength(1);
		expect(virtualTimelineControls[0]?.stableSelectorStatus).toBe('MAPPED');
		expect(virtualTimelineControls[0]?.stableSelectorValue).toBe('timeline-list-event');
		const contextPreviewControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/ai/context/ContextPreview.tsx'
		));

		expect(contextPreviewControls).toHaveLength(1);
		expect(contextPreviewControls[0]?.stableSelectorStatus).toBe('MAPPED');
		expect(contextPreviewControls[0]?.stableSelectorValue).toBe('ai-context-record-toggle');
		const highlightControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/manuscript/EntityHighlightControls.tsx'
		));

		expect(highlightControls).toHaveLength(1);
		expect(highlightControls[0]?.stableSelectorStatus).toBe('MAPPED');
		expect(highlightControls[0]?.stableSelectorValue).toBe('entity-highlight-kind-toggle');
	});

	it('TC-QA-INVENTORY-018 maps every Character, Item, Relationship, Consistency, Selection Rewrite, Manuscript Continuation AI, Project Welcome and Review Center control to stable selectors', () => {
		execFileSync(process.execPath, ['scripts/qa/inventory.mjs'], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		const inventory = JSON.parse(readFileSync(
			resolve(repositoryRoot, 'artifacts/qa/control-inventory.json'),
			'utf8'
		));
		const characterCenterControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/characters/CharacterCenterPage.tsx'
		));

		expect(characterCenterControls).toHaveLength(6);
		expect(characterCenterControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(characterCenterControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'character-detail-tab',
			'character-list-item',
			'character-role-filter',
			'全部',
			'搜索人物',
			'用 AI 创建人物'
		]);
		const characterAiControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/characters/CharacterAiPanel.tsx'
		));

		expect(characterAiControls).toHaveLength(8);
		expect(characterAiControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(characterAiControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'character-ai-accept',
			'character-ai-action',
			'character-ai-field',
			'character-ai-generate',
			'character-ai-instruction',
			'关闭 AI 人物助手',
			'证据',
			'选择人物分析章节'
		]);
		const itemAiControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/assets/ItemAiPanel.tsx'
		));

		expect(itemAiControls).toHaveLength(10);
		expect(itemAiControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(itemAiControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'item-ai-accept',
			'item-ai-action',
			'item-ai-field',
			'item-ai-field-evidence',
			'item-ai-generate',
			'item-ai-instruction',
			'item-ai-state',
			'item-ai-state-evidence',
			'关闭 AI 物品助手',
			'选择物品分析章节'
		]);
		const relationshipAiControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/relationships/RelationshipAiPanel.tsx'
		));

		expect(relationshipAiControls).toHaveLength(9);
		expect(relationshipAiControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(relationshipAiControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'relationship-ai-accept',
			'relationship-ai-action',
			'relationship-ai-evidence',
			'relationship-ai-generate',
			'relationship-ai-instruction',
			'relationship-ai-source-character',
			'relationship-ai-target-character',
			'关闭 AI 关系助手',
			'选择关系分析章节'
		]);
		const consistencyAiControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/continuity/StoryConsistencyAiPanel.tsx'
		));

		expect(consistencyAiControls).toHaveLength(7);
		expect(consistencyAiControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(consistencyAiControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'story-consistency-chapter',
			'story-consistency-instruction',
			'story-consistency-run',
			'story-consistency-scope-selected',
			'story-consistency-scope-whole',
			'story-consistency-stop',
			'关闭 AI 对照审查'
		]);
		const selectionRewriteControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/ai-context/SelectionRewritePanel.tsx'
		));

		expect(selectionRewriteControls).toHaveLength(7);
		expect(selectionRewriteControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(selectionRewriteControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'selection-rewrite-accept-all',
			'selection-rewrite-draft',
			'selection-rewrite-generate',
			'selection-rewrite-save-note',
			'selection-rewrite-undo',
			'拒绝',
			'接受编辑内容'
		]);
		const continuationControls = inventory.controls.filter(control => (
			control.source
			=== 'apps/desktop/src/features/story/ai-context/ManuscriptContinuationPanel.tsx'
		));

		expect(continuationControls).toHaveLength(7);
		expect(continuationControls.map(control => control.stableSelectorStatus)).not.toContain('UNMAPPED');
		expect(continuationControls.map(control => control.stableSelectorValue).sort()).toEqual([
			'manuscript-continuation-generate',
			'manuscript-continuation-insert',
			'manuscript-continuation-undo',
			'全部放弃',
			'告诉 AI 接下来发生什么',
			'拒绝',
			'查看差异'
		]);
		const settingsControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/ai/AiSettingsSection.tsx'
		));

		expect(settingsControls).toHaveLength(7);
		expect(settingsControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(settingsControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'ai-settings-api-key-input',
				'ai-settings-generation-select',
				'ai-settings-inline-feature-toggle'
			]));
		const projectWelcomeControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/projects/ui/ProjectWelcome.tsx'
		));

		expect(projectWelcomeControls).toHaveLength(4);
		expect(projectWelcomeControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(projectWelcomeControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'project-welcome-start-route',
				'project-welcome-recent-project',
				'打开已有 Writing Buddy 作品'
			]));
		const reviewCenterControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/review/ReviewPage.tsx'
		));

		expect(reviewCenterControls).toHaveLength(5);
		expect(reviewCenterControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(reviewCenterControls.map(control => control.stableSelectorValue).sort())
			.toEqual([
				'publish-readiness-action',
				'publish-readiness-toggle',
				'review-mode-tab',
				'回到正文处理',
				'打开 AI 设置'
			]);
		const assistantPanelControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/assistant/AssistantPanel.tsx'
		));

		expect(assistantPanelControls).toHaveLength(5);
		expect(assistantPanelControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(assistantPanelControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'assistant-panel-pin',
				'assistant-panel-close',
				'assistant-rewrite-action'
			]));
		const settingsPageControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/settings/SettingsPage.tsx'
		));

		expect(settingsPageControls).toHaveLength(3);
		expect(settingsPageControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(settingsPageControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'settings-theme-choice',
				'settings-accent-choice'
			]));
		const aiPlaygroundControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/ai/AiPlaygroundPage.tsx'
		));

		expect(aiPlaygroundControls).toHaveLength(3);
		expect(aiPlaygroundControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(aiPlaygroundControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'ai-playground-prompt'
			]));
		const plotAiControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/plots/PlotAiPanel.tsx'
		));

		expect(plotAiControls).toHaveLength(10);
		expect(plotAiControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(plotAiControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'plot-ai-action',
				'plot-ai-generate',
				'plot-ai-toggle',
				'plot-ai-instruction'
			]));
		const plotBoardControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/plots/PlotBoardPage.tsx'
		));

		expect(plotBoardControls).toHaveLength(9);
		expect(plotBoardControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(plotBoardControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'plot-board-ai-open',
				'plot-scene-open-manuscript',
				'plot-thread-select',
				'plot-thread-status',
				'plot-thread-save'
			]));
		const locationTreeControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/worldbuilding/LocationTree.tsx'
		));

		expect(locationTreeControls).toHaveLength(1);
		expect(locationTreeControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(locationTreeControls.map(control => control.stableSelectorValue))
			.toContain('world-location-select');
		const worldbuildingControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/worldbuilding/WorldbuildingPage.tsx'
		));

		expect(worldbuildingControls).toHaveLength(6);
		expect(worldbuildingControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(worldbuildingControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'world-map-location-select',
				'world-resource-select',
				'worldbuilding-ai-open'
			]));
		const worldAiControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/worldbuilding/WorldAiPanel.tsx'
		));

		expect(worldAiControls).toHaveLength(9);
		expect(worldAiControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(worldAiControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'world-ai-action',
				'world-ai-target',
				'world-ai-instruction',
				'world-ai-generate',
				'world-ai-field-toggle',
				'world-ai-apply'
			]));
		const timelineCanvasControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/timeline/TimelineCanvas.tsx'
		));

		expect(timelineCanvasControls).toHaveLength(1);
		expect(timelineCanvasControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(timelineCanvasControls.map(control => control.stableSelectorValue))
			.toContain('timeline-event-select');
		const timelinePageControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/timeline/TimelinePage.tsx'
		));

		expect(timelinePageControls).toHaveLength(11);
		expect(timelinePageControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(timelinePageControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'timeline-causality-confirm',
				'timeline-ai-open'
			]));
		const timelineAiControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/timeline/TimelineAiPanel.tsx'
		));

		expect(timelineAiControls).toHaveLength(12);
		expect(timelineAiControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(timelineAiControls.map(control => control.stableSelectorValue))
			.toEqual(expect.arrayContaining([
				'timeline-ai-action',
				'timeline-ai-scope',
				'timeline-ai-chapter-toggle',
				'timeline-ai-instruction',
				'timeline-ai-generate',
				'timeline-ai-candidate-toggle',
				'timeline-ai-edge-toggle',
				'timeline-ai-apply'
			]));
		const relationshipMatrixControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/relationships/RelationshipMatrix.tsx'
		));

		expect(relationshipMatrixControls).toHaveLength(1);
		expect(relationshipMatrixControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(relationshipMatrixControls.map(control => control.stableSelectorValue))
			.toContain('relationship-matrix-cell');
		const characterStateControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/characters/CharacterStateTimeline.tsx'
		));

		expect(characterStateControls).toHaveLength(1);
		expect(characterStateControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(characterStateControls.map(control => control.stableSelectorValue))
			.toContain('character-state-order');
		const storyReferenceControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/navigation/StoryReferenceSidebar.tsx'
		));

		expect(storyReferenceControls).toHaveLength(1);
		expect(storyReferenceControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(storyReferenceControls.map(control => control.stableSelectorValue))
			.toContain('story-reference-navigation-item');
		const inlineDraftControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/story/ai-context/InlineDraftCard.tsx'
		));

		expect(inlineDraftControls).toHaveLength(3);
		expect(inlineDraftControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(inlineDraftControls.map(control => control.stableSelectorValue))
			.toContain('inline-draft-write');
		const undoToastControls = inventory.controls.filter(control => (
			control.source === 'apps/desktop/src/features/shared/interaction/UndoToast.tsx'
		));

		expect(undoToastControls).toHaveLength(2);
		expect(undoToastControls.map(control => control.stableSelectorStatus))
			.not.toContain('UNMAPPED');
		expect(undoToastControls.map(control => control.stableSelectorValue))
			.toContain('undo-toast-undo');
	});
});
