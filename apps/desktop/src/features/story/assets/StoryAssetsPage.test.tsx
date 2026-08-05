import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import {
	StorySchemaRegistry,
	parseLocation
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import type { OpenAiEvidence } from '../ai-context/AiChapterSource';
import { StoryAssetsPage } from './StoryAssetsPage';

const timestamp = '2026-07-27T00:00:00.000Z';

function renderEmptyStoryAssetsPage(onOpenEvidence?: OpenAiEvidence): void {
	const character = StorySchemaRegistry.parse('character', {
		id: 'character:xu-qing',
		type: 'character',
		title: '徐青',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1,
		factionIds: [],
		goals: [],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: []
	});
	const location = parseLocation({
		id: 'location:old-station',
		type: 'location',
		title: '旧火车站',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1,
		travelLinks: [],
		factionIds: [],
		rules: [],
		evidenceIds: []
	});
	render(
		<StoryAssetsPage
			projectRoot="browser-fixture"
			loadData={() => Promise.resolve({
				items: [],
				states: [],
				characters: [character as never],
				locations: [location]
			})}
			chapters={[{
				resourceId: 'chapter:chapter-000000a1',
				chapterId: 'chapter-000000a1',
				title: '第一章 · 雨夜旧站',
				path: 'chapters/chapter-001.md',
				narrativeOrder: 0
			}]}
			onOpenEvidence={onOpenEvidence}
		/>
	);
}

describe('StoryAssetsPage', () => {
	afterEach(async () => {
		vi.restoreAllMocks();
		await desktopBridge.deleteDeepSeekKey();
	});

	it('TC-ITEM-AI-001 deduplicates one hundred repeated clicks into one paid request', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		renderEmptyStoryAssetsPage();

		fireEvent.click(await screen.findByRole('button', { name: '用 AI 创建物品' }));
		expect(screen.getByRole('complementary', { name: 'AI 物品助手' })).toBeInTheDocument();
		expect(screen.getAllByTestId('item-ai-action')).toHaveLength(3);
		expect(screen.getByTestId('item-ai-instruction')).toBeEnabled();
		const generate = screen.getByTestId('item-ai-generate');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				generate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(await screen.findByRole('heading', { name: '无字站牌' })).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(screen.getByText('证明零号月台曾经存在，并指向被删去的线路。')).toBeInTheDocument();
		expect(screen.getAllByTestId('item-ai-field').length).toBeGreaterThan(0);
		expect(screen.getAllByTestId('item-ai-accept')).toHaveLength(1);
	});

	it('TC-ITEM-AI-002 shows loading then reports invalid generation failure and succeeds on explicit retry', async () => {
		const originalStart = desktopBridge.startAiGeneration.bind(desktopBridge);
		let requests = 0;
		let finishMalformed = () => undefined;
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => {
				requests += 1;
				if (requests !== 1) return originalStart(request, listener);
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
				return new Promise<void>(resolve => {
					finishMalformed = () => {
						listener({ type: 'content_delta', jobId: request.jobId, text: '{"candidates":[]}' });
						listener({ type: 'completed', jobId: request.jobId, finishReason: 'stop' });
						resolve();
					};
				});
			});
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		renderEmptyStoryAssetsPage();

		fireEvent.click(await screen.findByRole('button', { name: '用 AI 创建物品' }));
		const generate = screen.getByRole('button', { name: '生成物品候选' });
		fireEvent.click(generate);
		expect(await screen.findByRole('button', { name: /正在分析/u })).toBeDisabled();
		await act(async () => {
			finishMalformed();
			await Promise.resolve();
		});

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('AI 返回的物品结构不完整，已安全隔离，请重试。');
		expect(alert).not.toHaveTextContent('invalidItemCandidateCount');
		expect(generate).toBeEnabled();
		fireEvent.click(generate);

		expect(await screen.findByRole('heading', { name: '无字站牌' })).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledTimes(2);
	});

	it('TC-ITEM-AI-003 redacts candidate persistence write failure and preserves one explicit retry', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		const createSnapshot = vi.spyOn(desktopBridge, 'createSnapshot')
			.mockRejectedValueOnce(new Error('C:\\private\\author\\items.json'));
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		renderEmptyStoryAssetsPage();

		fireEvent.click(await screen.findByRole('button', { name: '用 AI 创建物品' }));
		fireEvent.click(screen.getByRole('button', { name: '生成物品候选' }));
		expect(await screen.findByRole('heading', { name: '无字站牌' })).toBeInTheDocument();
		const selectedBefore = screen.getAllByRole('checkbox')
			.filter(control => (control as HTMLInputElement).checked).length;
		const accept = screen.getByRole('button', { name: '创建物品并写入所选内容' });
		fireEvent.click(accept);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('物品候选写入失败，原资料没有改变，请重试。');
		expect(alert).not.toHaveTextContent('C:\\private');
		expect(accept).toBeEnabled();
		expect(screen.getAllByRole('checkbox')
			.filter(control => (control as HTMLInputElement).checked)).toHaveLength(selectedBefore);
		fireEvent.click(accept);

		await waitFor(() => expect(createSnapshot).toHaveBeenCalledTimes(2));
		expect(await screen.findByText(/已创建安全快照，并保存“无字站牌”/u)).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
	});

	it('TC-ITEM-AI-004 renders every accessible control enabled for keyboard focus and opens evidence by pointer', async () => {
		const onOpenEvidence = vi.fn();
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		renderEmptyStoryAssetsPage(onOpenEvidence);

		fireEvent.click(await screen.findByRole('button', { name: '用 AI 创建物品' }));
		fireEvent.click(screen.getByRole('tab', { name: '从正文提取' }));
		fireEvent.click(screen.getByTestId('item-ai-generate'));
		expect(await screen.findByRole('heading', { name: '褪色的行李票' })).toBeInTheDocument();

		const field = screen.getAllByTestId('item-ai-field')[0];
		const fieldEvidence = screen.getAllByTestId('item-ai-field-evidence')[0];
		const state = screen.getByTestId('item-ai-state');
		const stateEvidence = screen.getByTestId('item-ai-state-evidence');
		const controls = [
			screen.getByRole('button', { name: '关闭 AI 物品助手' }),
			screen.getAllByTestId('item-ai-action')[0],
			screen.getByRole('combobox', { name: '选择物品分析章节' }),
			screen.getByTestId('item-ai-instruction'),
			screen.getByTestId('item-ai-generate'),
			field,
			fieldEvidence,
			state,
			stateEvidence,
			screen.getByTestId('item-ai-accept')
		];
		expect(controls).toHaveLength(10);
		for (const control of controls) {
			expect(control).toBeVisible();
			expect(control).toBeEnabled();
			control.focus();
			expect(control).toHaveFocus();
		}

		const fieldWasChecked = (field as HTMLInputElement).checked;
		fireEvent.click(field);
		expect(field).toHaveProperty('checked', !fieldWasChecked);
		fireEvent.click(field);
		const stateWasChecked = (state as HTMLInputElement).checked;
		fireEvent.click(state);
		expect(state).toHaveProperty('checked', !stateWasChecked);
		fireEvent.click(state);
		fireEvent.click(fieldEvidence);
		fireEvent.click(stateEvidence);
		expect(onOpenEvidence).toHaveBeenCalledTimes(2);
	});
});
