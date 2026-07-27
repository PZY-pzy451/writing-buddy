import type { StoryId } from '../ids/StoryId';
import type { StoryResourceBase } from './StoryResourceBase';

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';

export interface Character extends StoryResourceBase {
	readonly type: 'character';
	readonly role?: CharacterRole;
	readonly pronouns?: string;
	readonly birth?: string;
	readonly appearance?: string;
	readonly occupation?: string;
	readonly factionIds: readonly StoryId[];
	readonly goals: readonly string[];
	readonly desires: readonly string[];
	readonly fears: readonly string[];
	readonly values: readonly string[];
	readonly secrets: readonly string[];
	readonly speechStyle?: string;
	readonly evidenceIds: readonly StoryId[];
}

export const characterRoleLabels: Readonly<Record<CharacterRole, string>> = {
	protagonist: '主角',
	antagonist: '对手',
	supporting: '配角',
	minor: '次要人物'
};
