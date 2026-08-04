import {
	canUndoCommittedDraft,
	type InlineDraftCommitNotice,
	type InlineDraftCommitTarget
} from './InlineDraftCommitNoticeModel';

const notice: InlineDraftCommitNotice = {
	projectId: 'project-one',
	resourceId: 'chapter-one',
	modelUri: 'writing-buddy://project-one/chapter-one.md',
	contentAfterCommit: 'The same visible manuscript text.',
	message: 'AI draft committed.'
};

const target: InlineDraftCommitTarget = {
	projectId: 'project-one',
	resourceId: 'chapter-one',
	modelUri: 'writing-buddy://project-one/chapter-one.md',
	content: notice.contentAfterCommit
};

describe('inline draft commit notice identity', () => {
	it('allows one-click undo only for the exact project, resource, model and content', () => {
		expect(canUndoCommittedDraft(notice, target)).toBe(true);
		expect(canUndoCommittedDraft(undefined, target)).toBe(false);
		expect(canUndoCommittedDraft(notice, {
			...target,
			content: `${target.content} Author edit.`
		})).toBe(false);
	});

	it('rejects another chapter even when its visible text is identical', () => {
		expect(canUndoCommittedDraft(notice, {
			...target,
			resourceId: 'chapter-two',
			modelUri: 'writing-buddy://project-one/chapter-two.md'
		})).toBe(false);
	});

	it('rejects a recreated Monaco model for the same resource', () => {
		expect(canUndoCommittedDraft(notice, {
			...target,
			modelUri: 'writing-buddy://project-one/chapter-one-reopened.md'
		})).toBe(false);
	});

	it('rejects another project with colliding resource and content values', () => {
		expect(canUndoCommittedDraft(notice, {
			...target,
			projectId: 'project-two'
		})).toBe(false);
	});
});
