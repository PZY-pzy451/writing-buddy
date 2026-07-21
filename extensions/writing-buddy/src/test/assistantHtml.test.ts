/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { AssistantHtmlInput, AssistantLabels, renderAssistantHtml } from '../assistantHtml';

const labels: AssistantLabels = {
	currentScene: 'Current Scene',
	location: 'Location',
	time: 'Time',
	pointOfView: 'POV',
	characters: 'Characters',
	sceneGoal: 'Scene Goal',
	notes: 'Notes',
	noChapter: 'Open a chapter to see its writing context.'
};

function render(overrides: Partial<AssistantHtmlInput> = {}): string {
	return renderAssistantHtml({
		nonce: 'safe-nonce',
		language: 'en',
		labels,
		scene: {
			location: 'Old Railway Station',
			time: '23:40',
			pov: 'Lin Mo',
			characters: ['Lin Mo', 'Xu Qing'],
			goal: 'Find the missing notebook.',
			note: 'The station clock stopped at 23:17.'
		},
		...overrides
	});
}

suite('assistantHtml', () => {
	test('renders the frozen writing-assistant sections and scene data', () => {
		const html = render();

		for (const text of [
			'Current Scene', 'Location', 'Old Railway Station', 'Time', '23:40', 'POV', 'Lin Mo',
			'Characters', 'Xu Qing', 'Scene Goal', 'Find the missing notebook.', 'Notes',
			'The station clock stopped at 23:17.'
		]) {
			assert.ok(html.includes(text), `Expected HTML to contain ${text}`);
		}
	});

	test('escapes every label and scene data value', () => {
		const unsafeLabels: AssistantLabels = {
			currentScene: '<scene>',
			location: '<location>',
			time: '<time>',
			pointOfView: '<pov>',
			characters: '<characters>',
			sceneGoal: '<goal>',
			notes: '<notes>',
			noChapter: '<placeholder>'
		};
		const unsafeValues = ['<station>', '<23:40>', '<lin>', '<first>', '<second>', '<find>', '<clock>'];
		const html = render({
			labels: unsafeLabels,
			scene: {
				location: unsafeValues[0],
				time: unsafeValues[1],
				pov: unsafeValues[2],
				characters: [unsafeValues[3], unsafeValues[4]],
				goal: unsafeValues[5],
				note: unsafeValues[6]
			}
		});

		for (const unsafe of [...Object.values(unsafeLabels).slice(0, -1), ...unsafeValues]) {
			assert.ok(!html.includes(unsafe), `Expected HTML to escape ${unsafe}`);
			assert.ok(html.includes(unsafe.replaceAll('<', '&lt;').replaceAll('>', '&gt;')));
		}
	});

	test('escapes the neutral no-chapter placeholder', () => {
		const html = render({ labels: { ...labels, noChapter: '<choose & write>' }, scene: undefined });

		assert.ok(html.includes('&lt;choose &amp; write&gt;'));
		assert.ok(!html.includes('<choose & write>'));
	});

	test('uses a nonce-only style policy with no scripts or remote URLs', () => {
		const html = render();

		assert.ok(html.includes("default-src 'none'; style-src 'nonce-safe-nonce';"));
		assert.ok(html.includes('<style nonce="safe-nonce">'));
		assert.ok(!/<script\b/i.test(html));
		assert.ok(!/https?:\/\//i.test(html));
		assert.ok(!/style-src[^;]*unsafe-inline/i.test(html));
	});

	test('includes a narrow secondary-sidebar layout rule', () => {
		const html = render();

		assert.match(html, /@media\s*\(max-width:\s*260px\)/);
		assert.match(html, /grid-template-columns:\s*1fr/);
	});

	test('uses the escaped application language for assistive technology', () => {
		const html = render({ language: 'zh-cn<unsafe>' });

		assert.ok(html.includes('<html lang="zh-cn&lt;unsafe&gt;">'));
		assert.ok(!html.includes('<html lang="en">'));
	});

	test('uses a complete heading hierarchy for the standalone document', () => {
		const html = render();

		assert.ok(html.includes('<h1>Current Scene</h1>'));
		assert.ok(html.includes('<h2>Characters</h2>'));
		assert.ok(!/<h3\b/i.test(html));
	});
});
