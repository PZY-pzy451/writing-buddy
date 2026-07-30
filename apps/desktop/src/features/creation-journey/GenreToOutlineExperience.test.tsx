import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { parseCreationJourneyState } from './CreationJourneyModel';
import { CreationJourneyPage } from './CreationJourneyPage';

describe('genre-to-outline journey experience', () => {
	it('saves the brief, discloses context, and writes only a validated outline draft', async () => {
		const user = userEvent.setup();
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		let persisted = '';
		let writeIndex = 0;
		vi.spyOn(desktopBridge, 'readCreationJourneyState').mockResolvedValue(undefined);
		vi.spyOn(desktopBridge, 'writeCreationJourneyState').mockImplementation(
			(_root, content) => {
				persisted = content;
				writeIndex += 1;
				return Promise.resolve({
					hash: `genre-hash-${writeIndex}`,
					byteLength: content.length,
					modifiedAt: '2026-07-30T03:04:05.000Z'
				});
			}
		);
		const aiSpy = vi.spyOn(desktopBridge, 'startAiGeneration');
		useAppStore.setState({
			creationJourneyStartRoute: 'genre',
			snapshot: {
				root: 'D:/GenreNovel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-genre',
					title: '无日期的人',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			}
		});

		render(<CreationJourneyPage />);
		expect(await screen.findByRole('heading', { name: '创建你的故事' }))
			.toBeInTheDocument();
		await user.type(screen.getByLabelText('选择题材'), '都市悬疑');
		await user.type(
			screen.getByLabelText('用一句话描述你的故事（可选）'),
			'记者追查一座会重置记忆的车站。'
		);
		await user.click(screen.getByRole('button', { name: '查看生成依据' }));
		const preview = screen.getByRole('dialog', { name: '生成依据' });
		expect(within(preview).getByText('全部正文')).toBeInTheDocument();
		await user.click(within(preview).getByRole('button', { name: '确认并生成' }));

		expect(await screen.findByRole('region', { name: '结构化大纲工作区' }))
			.toBeInTheDocument();
		expect(aiSpy).toHaveBeenCalledTimes(1);
		const request = aiSpy.mock.calls[0]?.[0];
		const userPayload = request?.messages.find(message => message.role === 'user')?.content ?? '';
		expect(userPayload).toContain('都市悬疑');
		expect(userPayload).not.toMatch(/projectId|D:|apiKey|credential/iu);
		expect(screen.getAllByTestId('outline-card-title')).toHaveLength(5);
		const tree = screen.getByRole('navigation', { name: '故事结构树' });
		await user.click(within(tree).getAllByRole('button')[1]);
		expect(screen.getByLabelText('节点标题')).toBeInTheDocument();

		await waitFor(() => {
			const restored = parseCreationJourneyState(persisted);
			expect(restored.storyOutline?.genre).toBe('都市悬疑');
			expect(restored.outline).toHaveLength(5);
			expect(restored.chapters).toEqual([]);
		});
	});
});
