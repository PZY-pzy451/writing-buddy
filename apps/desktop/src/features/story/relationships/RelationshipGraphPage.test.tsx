import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	parseRelationship,
	parseStoryId,
	type Character
} from '@writing-buddy/story-kernel';
import {
	RelationshipGraphPage,
	type RelationshipPageData
} from './RelationshipGraphPage';
import { desktopBridge } from '../../../platform/bridge';

const timestamp = '2026-07-27T00:00:00.000Z';
const characters: readonly Character[] = ['林越', '沈青'].map((title, index) => ({
	id: parseStoryId(index === 0 ? 'character:lin-yue' : 'character:shen-qing'),
	type: 'character',
	title,
	aliases: [],
	tags: [],
	schemaVersion: 1,
	createdAt: timestamp,
	updatedAt: timestamp,
	revision: 0,
	factionIds: [],
	goals: [],
	desires: [],
	fears: [],
	values: [],
	secrets: [],
	evidenceIds: []
}));
const data: RelationshipPageData = {
	characters,
	relationships: [
		parseRelationship({
			id: 'relationship:lin-doubts-shen',
			type: 'relationship',
			title: '林越怀疑沈青',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			sourceCharacterId: 'character:lin-yue',
			targetCharacterId: 'character:shen-qing',
			relationshipType: '怀疑',
			strength: 0.7,
			visibility: 'private',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				narrativeOrder: 3
			},
			evidenceIds: ['evidence:rain-dialogue']
		}),
		parseRelationship({
			id: 'relationship:shen-protects-lin',
			type: 'relationship',
			title: '沈青保护林越',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			sourceCharacterId: 'character:shen-qing',
			targetCharacterId: 'character:lin-yue',
			relationshipType: '保护',
			strength: 0.9,
			visibility: 'secret',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				narrativeOrder: 8
			},
			evidenceIds: ['evidence:station-rescue']
		})
	]
};

describe('RelationshipGraphPage', () => {
	afterEach(async () => {
		vi.restoreAllMocks();
		await desktopBridge.deleteDeepSeekKey();
	});

	it('provides an accessible directional matrix, moves by keyboard and selects inspector evidence by pointer', async () => {
		render(
			<RelationshipGraphPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		fireEvent.click(await screen.findByRole('tab', { name: '关系矩阵' }));
		expect(screen.getByRole('table', { name: '人物有向关系矩阵' })).toBeInTheDocument();

		const matrixCells = screen.getAllByTestId('relationship-matrix-cell');
		expect(matrixCells.map(cell => cell.dataset.relationshipId).sort()).toEqual([
			'relationship:lin-doubts-shen',
			'relationship:shen-protects-lin'
		]);
		const directedCell = matrixCells.find(cell => (
			cell.dataset.relationshipId === 'relationship:lin-doubts-shen'
		))!;
		directedCell.focus();
		fireEvent.keyDown(directedCell, { key: 'ArrowRight' });
		expect(matrixCells[1]).toHaveFocus();
		fireEvent.click(directedCell);
		expect(screen.getByRole('heading', { name: '怀疑' })).toBeInTheDocument();
		expect(screen.getByText('evidence:rain-dialogue')).toBeInTheDocument();
	});

	it('TC-RELATIONSHIP-AI-002 shows loading, isolates invalid generation and succeeds on explicit restart', async () => {
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
						listener({
							type: 'content_delta',
							jobId: request.jobId,
							text: '{"candidates":[{"sourceCharacterId":"character:lin-yue"}]}'
						});
						listener({ type: 'completed', jobId: request.jobId, finishReason: 'stop' });
						resolve();
					};
				});
			});
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<RelationshipGraphPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve(data)}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 3
				}]}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'AI 关系助手' }));
		fireEvent.click(screen.getByRole('tab', { name: '生成双向关系' }));
		const generate = screen.getByRole('button', { name: '生成关系候选' });
		fireEvent.click(generate);
		expect(await screen.findByRole('button', { name: /正在分析/u })).toBeDisabled();
		await act(async () => {
			finishMalformed();
			await Promise.resolve();
		});

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('AI 返回的关系结构不完整，已安全隔离，请重试。');
		expect(alert).not.toHaveTextContent(/Zod|sourceCharacterId|invalidRelationship/u);
		expect(generate).toBeEnabled();
		fireEvent.click(generate);

		expect(await screen.findByRole('button', {
			name: 'AI 候选关系：林越到沈青，谨慎结盟'
		})).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledTimes(2);
	});

	it('TC-RELATIONSHIP-AI-003 redacts permission-sensitive candidate write details and retries without regenerating', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		const createSnapshot = vi.spyOn(desktopBridge, 'createSnapshot')
			.mockRejectedValueOnce(new Error('C:\\private\\author\\relationships.json'));
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<RelationshipGraphPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve({ ...data, relationships: [] })}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 3
				}]}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'AI 关系助手' }));
		fireEvent.click(screen.getByRole('tab', { name: '生成双向关系' }));
		fireEvent.click(screen.getByRole('button', { name: '生成关系候选' }));
		expect(await screen.findByRole('button', {
			name: 'AI 候选关系：林越到沈青，谨慎结盟'
		})).toBeInTheDocument();
		const accept = screen.getAllByTestId('relationship-ai-accept')[0];
		fireEvent.click(accept);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('关系候选写入失败，原资料没有改变，请重试。');
		expect(alert).not.toHaveTextContent('C:\\private');
		expect(accept).toBeEnabled();
		fireEvent.click(accept);

		await waitFor(() => expect(createSnapshot).toHaveBeenCalledTimes(2));
		expect(await screen.findByText('已创建安全快照，候选边已进入正式关系图。')).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
	});

	it('TC-RELATIONSHIP-AI-004 exposes every enabled control to keyboard focus and opens evidence by pointer', async () => {
		const sourceContent = '林越把钥匙交给沈青。';
		const onOpenEvidence = vi.fn();
		vi.spyOn(desktopBridge, 'readText').mockResolvedValue({
			content: sourceContent,
			hash: 'hash:relationship-evidence',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
		vi.spyOn(desktopBridge, 'startAiGeneration').mockImplementation((request, listener) => {
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
			listener({
				type: 'content_delta',
				jobId: request.jobId,
				text: JSON.stringify({
					candidates: [{
						sourceCharacterId: 'character:lin-yue',
						targetCharacterId: 'character:shen-qing',
						relationshipType: '信任',
						strength: 0.8,
						visibility: 'private',
						description: '林越把钥匙交给沈青。',
						confidence: 0.9,
						rationale: '正文明确发生了信任变化。',
						evidence: { start: 0, end: sourceContent.length, quote: sourceContent }
					}]
				})
			});
			listener({ type: 'completed', jobId: request.jobId, finishReason: 'stop' });
			return Promise.resolve();
		});
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<RelationshipGraphPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve(data)}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 3
				}]}
				onOpenEvidence={onOpenEvidence}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'AI 关系助手' }));
		fireEvent.click(screen.getByTestId('relationship-ai-generate'));
		const evidence = await screen.findByTestId('relationship-ai-evidence');
		const firstStateControls = [
			screen.getByRole('button', { name: '关闭 AI 关系助手' }),
			screen.getAllByTestId('relationship-ai-action')[0],
			screen.getByRole('combobox', { name: '选择关系分析章节' }),
			screen.getByTestId('relationship-ai-instruction'),
			screen.getByTestId('relationship-ai-generate'),
			evidence,
			screen.getByTestId('relationship-ai-accept')
		];
		for (const control of firstStateControls) {
			expect(control).toBeVisible();
			expect(control).toBeEnabled();
			control.focus();
			expect(control).toHaveFocus();
		}
		fireEvent.click(evidence);
		expect(onOpenEvidence).toHaveBeenCalledOnce();

		fireEvent.click(screen.getByRole('tab', { name: '生成双向关系' }));
		const pairControls = [
			screen.getByTestId('relationship-ai-source-character'),
			screen.getByTestId('relationship-ai-target-character')
		];
		for (const control of pairControls) {
			expect(control).toBeVisible();
			expect(control).toBeEnabled();
			control.focus();
			expect(control).toHaveFocus();
		}
		expect([...firstStateControls, ...pairControls]).toHaveLength(9);
	});

	it('shows a localized relationship save failure and lets the author retry successfully', async () => {
		const saveStoryResources = vi.spyOn(desktopBridge, 'saveStoryResources')
			.mockRejectedValueOnce(new Error('D:/private/project/story/relationship.json failed'))
			.mockResolvedValueOnce([{
				...data.relationships[0],
				revision: 1,
				updatedAt: '2026-08-04T01:00:00.000Z'
			}]);
		render(
			<RelationshipGraphPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		expect(await screen.findAllByTestId('relationship-graph-character')).toHaveLength(2);
		expect(await screen.findAllByTestId('relationship-graph-edge')).toHaveLength(2);
		fireEvent.click(await screen.findByRole('tab', { name: '关系矩阵' }));
		fireEvent.click(screen.getByRole('button', { name: '林越 到 沈青：怀疑，强度 70%' }));
		fireEvent.click(screen.getByRole('button', { name: '保存关系' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('关系保存失败，请重试。');
		expect(screen.queryByText(/private\/project/u)).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '保存关系' }));
		await waitFor(() => expect(saveStoryResources).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
	});

	it('TC-RELATIONSHIP-AI-001 deduplicates repeated generation clicks and renders separate virtual graph edges', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<RelationshipGraphPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve(data)}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 3
				}]}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'AI 关系助手' }));
		fireEvent.click(screen.getByRole('tab', { name: '生成双向关系' }));
		const generate = screen.getByRole('button', { name: '生成关系候选' });
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				generate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(await screen.findByRole('button', {
			name: 'AI 候选关系：林越到沈青，谨慎结盟'
		})).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', {
			name: 'AI 候选关系：沈青到林越，暗中保护'
		})).toBeInTheDocument();
		expect(screen.getAllByTestId('relationship-graph-candidate-edge')).toHaveLength(2);
	});
});
