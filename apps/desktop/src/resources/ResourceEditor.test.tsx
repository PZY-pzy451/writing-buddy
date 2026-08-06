import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../app/store';
import { resetWriterWorkspaceFixture } from '../app/WriterWorkspaceTestHarness.test-utils';
import { desktopBridge } from '../platform/bridge';
import { ResourceEditor } from './ResourceEditor';

describe('ResourceEditor', () => {
	beforeEach(resetWriterWorkspaceFixture);

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('edits and persists exact resource input and textarea fields by keyboard', async () => {
		const user = userEvent.setup();
		const snapshot = await desktopBridge.openProject('browser-fixture');
		const resource = snapshot.resources.find(candidate => candidate.type === 'character');
		if (!resource?.path) throw new Error('resource editor fixture missing');
		const file = await desktopBridge.readText(snapshot.root, resource.path);
		const write = vi.spyOn(desktopBridge, 'writeTextAtomic');
		act(() => {
			useAppStore.setState({
				snapshot,
				activeResource: {
					...resource,
					projectId: snapshot.project.projectId
				},
				activeResourceId: resource.id,
				resourceContent: file.content,
				resourceHash: file.hash,
				session: undefined
			});
		});
		render(<ResourceEditor />);

		const fields = screen.getAllByTestId('resource-editor-field');
		const name = fields.find(field => field.getAttribute('data-resource-field') === 'name');
		const notes = fields.find(field => field.getAttribute('data-resource-field') === 'notes');
		if (!name || !notes) throw new Error('named resource fields missing');
		expect(name.tagName).toBe('INPUT');
		expect(notes.tagName).toBe('TEXTAREA');
		await user.clear(name);
		await user.type(name, '林墨（修订）');
		await user.clear(notes);
		await user.type(notes, '先观察出口，再决定是否行动。');
		await user.click(screen.getByRole('button', { name: /保存资料/ }));

		await waitFor(() => expect(write).toHaveBeenCalledOnce());
		const saved = JSON.parse(useAppStore.getState().resourceContent ?? '{}') as {
			readonly name?: string;
			readonly notes?: string;
		};
		expect(saved).toMatchObject({
			name: '林墨（修订）',
			notes: '先观察出口，再决定是否行动。'
		});
	});
});
