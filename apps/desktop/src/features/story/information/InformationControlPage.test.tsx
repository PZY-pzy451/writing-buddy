import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseStoryId, type Character, type StoryInformation } from '@writing-buddy/story-kernel';
import { InformationControlPage } from './InformationControlPage';

const base = {
	aliases: [], tags: [], schemaVersion: 1 as const,
	createdAt: '2026-07-27T00:00:00.000Z', updatedAt: '2026-07-27T00:00:00.000Z', revision: 0
};

describe('InformationControlPage', () => {
	it('shows author-secret protection and the knowledge matrix', async () => {
		const information: StoryInformation = {
			...base, id: parseStoryId('information:clock'), type: 'information', title: '停摆的钟',
			truthStatement: '钟在午夜被人为停下。', truthStatus: 'confirmed',
			authorSecret: true, excludeFromAiByDefault: true, evidenceIds: []
		};
		const character: Character = {
			...base, id: parseStoryId('character:lin'), type: 'character', title: '林越',
			factionIds: [], goals: [], desires: [], fears: [], values: [], secrets: [], evidenceIds: []
		};
		render(<InformationControlPage projectRoot="D:\\fixture" loadData={() => Promise.resolve({ information: [information], characters: [character], states: [] })} />);
		await waitFor(() => expect(screen.getByRole('table', { name: '信息权限矩阵' })).toBeInTheDocument());
		expect(screen.getByText('默认不发送给 AI')).toBeInTheDocument();
		expect(screen.getByText('林越')).toBeInTheDocument();
	});
});
