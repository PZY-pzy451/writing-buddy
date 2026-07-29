import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { desktopBridge } from '../../../platform/bridge';
import { ManuscriptExtractionCenterPage } from './ManuscriptExtractionCenterPage';

const chapters = [{
	resourceId: 'chapter:chapter-a11ce001',
	chapterId: 'chapter-a11ce001',
	title: '第一章 停摆的时钟',
	path: 'chapters/chapter-001.md',
	narrativeOrder: 0,
	volumeId: 'volume-a11ce001',
	volumeTitle: '第一卷'
}, {
	resourceId: 'chapter:chapter-a11ce002',
	chapterId: 'chapter-a11ce002',
	title: '第二章 迷路的旅人',
	path: 'chapters/chapter-002.md',
	narrativeOrder: 1,
	volumeId: 'volume-a11ce001',
	volumeTitle: '第一卷'
}];

describe('ManuscriptExtractionCenterPage', () => {
	beforeEach(async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture-key');
	});

	it('plans without AI, then runs only after explicit confirmation', async () => {
		render(
			<ManuscriptExtractionCenterPage
				projectRoot="browser-fixture"
				chapters={chapters}
				activeChapterId={chapters[0]?.resourceId}
			/>
		);

		expect(screen.getByRole('radio', { name: '当前章' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		fireEvent.click(screen.getByRole('button', { name: '计算 Token 并创建批次' }));
		await screen.findByText(/已规划 1 个章节/u);

		expect(screen.getByText(/创建计划不会调用 AI/u)).toBeInTheDocument();
		expect(screen.getByText(/只有点击“开始”或“继续”才会调用 DeepSeek/u)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '开始逐章整理' })).toBeEnabled();

		fireEvent.click(screen.getByRole('button', { name: '开始逐章整理' }));
		await screen.findByText(/全部章节已整理完成/u, {}, { timeout: 8_000 });
		await waitFor(() => {
			expect(screen.getAllByText('AI 识别人物').length).toBeGreaterThan(0);
		});
		expect(screen.getAllByText('待作者确认').length).toBeGreaterThan(0);
		expect(screen.getByRole('heading', { name: '人物' })).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: '查看正文依据' }).length)
			.toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: '稍后整理' }).length)
			.toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: '拒绝候选' }).length)
			.toBeGreaterThan(0);
		const candidateCheckboxes = screen.getAllByRole('checkbox').filter(element => (
			element.getAttribute('aria-label')?.startsWith('选择 ')
		));
		expect(candidateCheckboxes.every(element => (
			!(element as HTMLInputElement).checked
		))).toBe(true);
		const confirmable = candidateCheckboxes.find(element => (
			!(element as HTMLInputElement).disabled
		));
		expect(confirmable).toBeDefined();
		if (!confirmable) throw new Error('confirmableCandidateMissing');
		fireEvent.click(confirmable);
		fireEvent.click(screen.getByRole('button', { name: /创建快照并确认 1/u }));
		const undo = await screen.findByRole('button', { name: '撤销刚才确认' });
		fireEvent.click(undo);
		await screen.findByText(/已撤销刚才的确认/u);
	});
});
