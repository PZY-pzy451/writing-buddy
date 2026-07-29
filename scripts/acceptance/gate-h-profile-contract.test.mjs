import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const requiredTasks = [
	'open-app',
	'continue-writing',
	'verify-position',
	'write-300-and-save',
	'focus-roundtrip',
	'workspace-roundtrip',
	'resize-and-close',
	'second-start-continue',
	'save-failure-recovery',
	'verify-no-loss'
];

function loadProfiles() {
	return JSON.parse(readFileSync(
		resolve('scripts/acceptance/gate-h-profiles.json'),
		'utf8'
	));
}

describe('Gate H no-explanation profile contract', () => {
	it('defines five isolated profiles with all ten tasks', () => {
		const profiles = loadProfiles();

		expect(profiles).toHaveLength(5);
		expect(new Set(profiles.map(profile => profile.id)).size).toBe(5);
		for (const profile of profiles) {
			expect(profile.tasks).toEqual(requiredTasks);
		}
	});

	it('covers the exact responsive targets, both themes, reduced motion and keyboard use', () => {
		const profiles = loadProfiles();
		const targets = profiles.map(profile => (
			`${profile.viewport.width}x${profile.viewport.height}`
		));

		expect(targets).toEqual(expect.arrayContaining([
			'1536x992',
			'1280x800',
			'1024x720'
		]));
		expect(profiles.some(profile => profile.theme === 'midnight')).toBe(true);
		expect(profiles.some(profile => profile.reducedMotion)).toBe(true);
		expect(profiles.filter(profile => profile.inputMethod === 'keyboard').length)
			.toBeGreaterThanOrEqual(2);
	});
});
