import { readFileSync } from 'node:fs';
import {
	CHAPTER_REVIEW_SYSTEM_PROMPT,
	CHARACTER_ANALYSIS_SYSTEM_PROMPT,
	ITEM_ANALYSIS_SYSTEM_PROMPT,
	MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT,
	PLOT_ANALYSIS_SYSTEM_PROMPT,
	RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT,
	SCENE_PLAN_SYSTEM_PROMPT,
	SELECTION_REWRITE_SYSTEM_PROMPT,
	STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT,
	STORY_EXTRACTION_SYSTEM_PROMPT,
	STORY_KERNEL_GENERATION_SYSTEM_PROMPT,
	STORYFORGE_SYSTEM_PROMPT,
	TIMELINE_ANALYSIS_SYSTEM_PROMPT,
	WORLD_ANALYSIS_SYSTEM_PROMPT
} from '@writing-buddy/ai';
import { describe, expect, it } from 'vitest';

const rustAiModule = readFileSync(
	'apps/desktop/src-tauri/src/ai/mod.rs',
	'utf8'
);

function rustConcatConstant(name: string): string {
	const declaration = new RegExp(
		String.raw`pub const ${name}: &str = concat!\(([\s\S]*?)\r?\n\);`,
		'u'
	).exec(rustAiModule);
	if (!declaration?.[1]) {
		throw new Error(`Rust AI prompt constant not found: ${name}`);
	}
	const literals = declaration[1].match(/"(?:\\.|[^"\\])*"/gu) ?? [];
	return literals.map(literal => {
		const decoded = JSON.parse(literal) as unknown;
		if (typeof decoded !== 'string') {
			throw new Error(`Rust AI prompt constant contains a non-string literal: ${name}`);
		}
		return decoded;
	}).join('');
}

const promptContracts = {
	STORYFORGE_SYSTEM_PROMPT,
	CHAPTER_REVIEW_SYSTEM_PROMPT,
	STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT,
	SELECTION_REWRITE_SYSTEM_PROMPT,
	MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT,
	SCENE_PLAN_SYSTEM_PROMPT,
	CHARACTER_ANALYSIS_SYSTEM_PROMPT,
	RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT,
	WORLD_ANALYSIS_SYSTEM_PROMPT,
	ITEM_ANALYSIS_SYSTEM_PROMPT,
	TIMELINE_ANALYSIS_SYSTEM_PROMPT,
	PLOT_ANALYSIS_SYSTEM_PROMPT,
	STORY_EXTRACTION_SYSTEM_PROMPT,
	STORY_KERNEL_GENERATION_SYSTEM_PROMPT
} as const;

describe('AI prompt contract parity', () => {
	for (const [name, prompt] of Object.entries(promptContracts)) {
		it(`keeps ${name} identical in TypeScript and Rust`, () => {
			expect(rustConcatConstant(name)).toBe(prompt);
		});
	}
});
