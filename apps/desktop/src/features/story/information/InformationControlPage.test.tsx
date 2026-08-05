import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseStoryId, type Character, type StoryInformation } from '@writing-buddy/story-kernel';
import {
	InformationControlPage,
	type InformationControlData
} from './InformationControlPage';

const base = {
	aliases: [], tags: [], schemaVersion: 1 as const,
	createdAt: '2026-07-27T00:00:00.000Z', updatedAt: '2026-07-27T00:00:00.000Z', revision: 0
};

describe('InformationControlPage', () => {
	it('TC-INFORMATION-CONTROL-001 shows accessible controls, deduplicates repeated retries after failed loading, selects and filters author secrets, and isolates late project reloads', async () => {
		const information: StoryInformation = {
			...base, id: parseStoryId('information:clock'), type: 'information', title: '停摆的钟',
			truthStatement: '钟在午夜被人为停下。', truthStatus: 'confirmed',
			authorSecret: true, excludeFromAiByDefault: true, evidenceIds: []
		};
		const character: Character = {
			...base, id: parseStoryId('character:lin'), type: 'character', title: '林越',
			factionIds: [], goals: [], desires: [], fears: [], values: [], secrets: [], evidenceIds: []
		};
		const fixtureData: InformationControlData = {
			information: [information], characters: [character], states: []
		};
		const latestInformation: StoryInformation = {
			...information,
			id: parseStoryId('information:latest-project'),
			title: '最新项目事实',
			truthStatement: '最新项目只保留当前选择。'
		};
		const latestData: InformationControlData = {
			information: [latestInformation], characters: [character], states: []
		};
		let resolveRetry: (value: InformationControlData | PromiseLike<InformationControlData>) => void
			= () => undefined;
		let resolveStale: (value: InformationControlData | PromiseLike<InformationControlData>) => void
			= () => undefined;
		const loadData = vi.fn((root: string) => {
			if (root === 'D:/fixture' && loadData.mock.calls.length === 1) {
				return Promise.reject(new Error('C:\\private\\author\\knowledge-states.json'));
			}
			if (root === 'D:/fixture') {
				return new Promise<InformationControlData>(resolve => {
					resolveRetry = resolve;
				});
			}
			if (root === 'D:/older') {
				return new Promise<InformationControlData>(resolve => {
					resolveStale = resolve;
				});
			}
			return Promise.resolve(latestData);
		});
		const view = render(
			<InformationControlPage projectRoot="D:/fixture" loadData={loadData} />
		);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('信息权限资料读取失败，请重试。');
		expect(alert).not.toHaveTextContent(/private|knowledge-states\.json/u);
		const retry = screen.getByRole('button', { name: '重试' });
		expect(retry).toHaveAttribute('data-testid', 'information-retry-load');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				retry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});
		expect(loadData).toHaveBeenCalledTimes(2);
		await act(async () => {
			resolveRetry(fixtureData);
			await Promise.resolve();
		});

		await waitFor(() => expect(screen.getByRole('table', { name: '信息权限矩阵' })).toBeInTheDocument());
		expect(screen.getByText('默认不发送给 AI')).toBeInTheDocument();
		expect(screen.getByText('林越')).toBeInTheDocument();
		const search = screen.getByRole('searchbox', { name: '搜索事实与秘密' });
		expect(search).toHaveAttribute('data-testid', 'information-search');
		const secretFilter = screen.getByRole('button', { name: '作者秘密' });
		expect(secretFilter).toHaveAttribute('data-testid', 'information-filter');
		fireEvent.click(secretFilter);
		const fact = screen.getByRole('button', { name: /停摆的钟/u });
		expect(fact).toHaveAttribute('data-testid', 'information-fact');
		const narrativePosition = screen.getByRole('spinbutton', { name: '叙事位置' });
		expect(narrativePosition).toHaveAttribute(
			'data-testid',
			'information-narrative-position'
		);
		fireEvent.change(search, { target: { value: '不存在的事实' } });
		expect(screen.getByText('当前筛选下没有故事事实。')).toBeInTheDocument();
		fireEvent.change(search, { target: { value: '停摆' } });
		expect(screen.getByRole('button', { name: /停摆的钟/u })).toBeInTheDocument();

		view.rerender(
			<InformationControlPage projectRoot="D:/older" loadData={loadData} />
		);
		await waitFor(() => expect(loadData).toHaveBeenCalledWith('D:/older'));
		view.rerender(
			<InformationControlPage projectRoot="D:/latest" loadData={loadData} />
		);
		expect(await screen.findByRole('heading', { name: '最新项目事实' })).toBeInTheDocument();
		await act(async () => {
			resolveStale(fixtureData);
			await Promise.resolve();
		});
		expect(screen.getByRole('heading', { name: '最新项目事实' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: '停摆的钟' })).not.toBeInTheDocument();
	});
});
