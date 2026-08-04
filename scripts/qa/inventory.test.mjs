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
});
