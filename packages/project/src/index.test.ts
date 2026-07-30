import type { ResourceDescriptor } from '@writing-buddy/domain';
import { FakeFileSystem } from '@writing-buddy/test-support';
import {
	DocumentSession,
	DocumentSessionService,
	EditTransactionService,
	ResourceTabManager
} from './index';

describe('document sessions', () => {
	it('tracks dirty state, preserves EOL and rejects external changes', async () => {
		const files = new FakeFileSystem();
		files.add('project', 'chapters/one.md', '第一行\r\n第二行', 'crlf', true);
		const service = new DocumentSessionService(files);
		const resource: ResourceDescriptor = { id: 'one', type: 'chapter', title: '第一章', path: 'chapters/one.md', projectId: 'project' };
		const session = await service.open('project', resource);
		session.updateContent('第一行\r\n第二行\r\n第三行');
		expect(session.state).toMatchObject({ dirty: true, originalEol: 'crlf', hasBom: true, version: 2 });
		const dirtyCopy = session.copy();
		expect(dirtyCopy).not.toBe(session);
		expect(dirtyCopy.content).toBe(session.content);
		expect(dirtyCopy.originalContent).toBe(session.originalContent);
		expect(dirtyCopy.state).toEqual(session.state);
		await service.save('project', resource.id);
		expect(session.state.dirty).toBe(false);
		files.add('project', 'chapters/one.md', '外部修改');
		session.updateContent('本地修改');
		await expect(service.save('project', resource.id)).rejects.toThrow('externalChange');
	});
});

describe('resource tabs and edit transactions', () => {
	it('restores an active tab and supports undo/redo', () => {
		const tabs = new ResourceTabManager();
		const chapter: ResourceDescriptor = { id: 'one', type: 'chapter', title: '第一章', path: 'one.md', projectId: 'project' };
		const note: ResourceDescriptor = { id: 'note', type: 'note', title: '笔记', path: 'note.md', projectId: 'project' };
		tabs.open(chapter);
		tabs.open(note);
		tabs.close('note');
		expect(tabs.state).toEqual({ resources: [chapter], activeId: 'one' });
		const edits = new EditTransactionService();
		edits.apply('one', '旧文本', '新文本');
		expect(edits.undo('新文本')?.content).toBe('旧文本');
		expect(edits.redo('旧文本')?.content).toBe('新文本');
	});

	it('treats Monaco LF normalization as the same edit without ignoring text changes', () => {
		const edits = new EditTransactionService();
		edits.apply('one', '第一段\r\n\r\n第二段', '第一段\r\n\r\n第二段\r\n\r\nAI 候选');

		expect(edits.undo('第一段\n\n第二段\n\nAI 候选')?.content)
			.toBe('第一段\n\n第二段');

		const changed = new EditTransactionService();
		changed.apply('one', '第一段\r\n\r\n第二段', '第一段\r\n\r\n第二段\r\n\r\nAI 候选');
		expect(changed.undo('第一段\n\n第二段\n\nAI 候选！')).toBeUndefined();
	});
});

describe('document save completion', () => {
	it('keeps edits made during an in-flight write dirty', () => {
		const session = new DocumentSession('chapter-one', 'chapters/one.md', {
			content: '初稿',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false,
			hash: 'hash-0'
		});
		session.updateContent('发送到磁盘的版本');
		const request = session.toWriteRequest('D:/fixture');

		session.updateContent('写入期间继续输入的版本');
		session.markSaved({
			hash: 'hash-1',
			modifiedAt: '2026-07-29T11:00:00.000Z',
			byteLength: 24
		}, request.content);

		expect(session.content).toBe('写入期间继续输入的版本');
		expect(session.originalContent).toBe('发送到磁盘的版本');
		expect(session.state.diskHash).toBe('hash-1');
		expect(session.state.dirty).toBe(true);
	});
});
