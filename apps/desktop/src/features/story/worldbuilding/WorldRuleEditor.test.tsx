import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseWorldRule, type WorldRule } from '@writing-buddy/story-kernel';
import { WorldRuleEditor } from './WorldRuleEditor';

const timestamp = '2026-08-04T00:00:00.000Z';

function createRule(revision = 0): WorldRule {
	return parseWorldRule({
		id: 'world-rule:clock',
		type: 'worldRule',
		title: '停摆规则',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision,
		evidenceIds: [],
		category: 'technology',
		statement: '机械钟会在午夜停止。',
		scope: '旧城区',
		exceptions: ['医院使用的计时器'],
		consequences: ['公共交通停止运行']
	});
}

describe('WorldRuleEditor save lifecycle', () => {
	it('exposes distinct stable handles for all eight form operations', () => {
		render(<WorldRuleEditor rule={createRule()} saving={false} onSave={vi.fn()} />);

		expect(screen.getByTestId('world-rule-editor-form')).toBeVisible();
		expect(screen.getByTestId('world-rule-title')).toHaveAccessibleName('规则名称');
		expect(screen.getByTestId('world-rule-category')).toHaveAccessibleName('分类');
		expect(screen.getByTestId('world-rule-statement')).toHaveAccessibleName('规则陈述');
		expect(screen.getByTestId('world-rule-scope')).toHaveAccessibleName('适用范围');
		expect(screen.getByTestId('world-rule-exceptions')).toHaveAccessibleName('例外（每行一项）');
		expect(screen.getByTestId('world-rule-consequences')).toHaveAccessibleName('违反后果（每行一项）');
		expect(screen.getByTestId('world-rule-save')).toHaveAccessibleName('保存规则');
	});

	it('deduplicates one hundred repeated same-frame save submissions while loading', async () => {
		let resolveSave: (() => void) | undefined;
		const pendingSave = new Promise<void>(resolve => {
			resolveSave = resolve;
		});
		const onSave = vi.fn(() => pendingSave);
		render(<WorldRuleEditor rule={createRule()} saving={false} onSave={onSave} />);
		const saveButton = screen.getByRole('button', { name: '保存规则' });
		const form = saveButton.closest('form');
		expect(form).not.toBeNull();

		act(() => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				fireEvent.submit(form as HTMLFormElement);
			}
		});

		expect(onSave).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
		await act(async () => {
			resolveSave?.();
			await pendingSave;
		});
		await waitFor(() => expect(screen.getByRole('button', { name: '保存规则' })).toBeEnabled());
	});

	it('redacts a failed save and releases one explicit retry', async () => {
		const user = userEvent.setup();
		const rejectedSave = Promise.reject(new Error('staleWrite C:\\private\\draft.json'));
		void rejectedSave.catch(() => undefined);
		const onSave = vi.fn()
			.mockReturnValueOnce(rejectedSave)
			.mockResolvedValueOnce(undefined);
		render(<WorldRuleEditor rule={createRule()} saving={false} onSave={onSave} />);

		await user.click(screen.getByRole('button', { name: '保存规则' }));
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('世界规则保存失败，请重试。');
		expect(alert).not.toHaveTextContent('staleWrite');
		expect(alert).not.toHaveTextContent('private');

		await user.click(screen.getByRole('button', { name: '保存规则' }));
		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
	});

	it('restores the saved revision after rerender for the next edit of the same rule', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn(() => Promise.resolve());
		const initialRule = createRule(0);
		const { rerender } = render(
			<WorldRuleEditor key={initialRule.revision} rule={initialRule} saving={false} onSave={onSave} />
		);

		await user.clear(screen.getByLabelText('规则名称'));
		await user.type(screen.getByLabelText('规则名称'), '第一次保存');
		await user.click(screen.getByRole('button', { name: '保存规则' }));
		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

		const savedRule = { ...initialRule, title: '第一次保存', revision: 1 };
		rerender(<WorldRuleEditor key={savedRule.revision} rule={savedRule} saving={false} onSave={onSave} />);
		await user.clear(screen.getByLabelText('规则名称'));
		await user.type(screen.getByLabelText('规则名称'), '第二次保存');
		await user.click(screen.getByRole('button', { name: '保存规则' }));

		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
		expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
			title: '第二次保存',
			revision: 1
		}));
	});
});
